import { Router } from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { addDays, eachNight, nightsBetween, todayISO } from '../lib/dates.js';
import { money } from '../lib/http.js';

const router = Router();
router.use(authenticate);

router.get('/dashboard', asyncHandler(async (req, res) => {
  const today = todayISO();
  const [arrivals] = await pool.query(
    `SELECT r.id, r.booking_ref, r.status, r.check_in, r.check_out, r.adults, r.children, r.payment_preference,
            g.first_name, g.last_name, g.phone,
            GROUP_CONCAT(DISTINCT rt.name SEPARATOR ', ') AS room_types,
            GROUP_CONCAT(DISTINCT rm.room_number SEPARATOR ', ') AS room_numbers
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     LEFT JOIN reservation_rooms rr ON rr.reservation_id = r.id
     LEFT JOIN room_types rt ON rt.id = rr.room_type_id
     LEFT JOIN rooms rm ON rm.id = rr.room_id
     WHERE r.check_in = ? AND r.status IN ('confirmed','pending')
     GROUP BY r.id
     ORDER BY g.last_name`,
    [today]
  );
  const [departures] = await pool.query(
    `SELECT r.id, r.booking_ref, r.status, r.total_amount, r.paid_amount,
            (SELECT COALESCE(SUM(fi.amount * fi.quantity), 0) FROM folio_items fi WHERE fi.reservation_id = r.id) AS extras,
            g.first_name, g.last_name,
            GROUP_CONCAT(DISTINCT rm.room_number SEPARATOR ', ') AS room_numbers
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     LEFT JOIN reservation_rooms rr ON rr.reservation_id = r.id
     LEFT JOIN rooms rm ON rm.id = rr.room_id
     WHERE r.check_out = ? AND r.status = 'checked_in'
     GROUP BY r.id`,
    [today]
  );
  const [[inHouse]] = await pool.query(`SELECT COUNT(*) AS count FROM reservations WHERE status = 'checked_in'`);
  const [[sold]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM reservation_rooms rr JOIN reservations r ON r.id = rr.reservation_id
     WHERE r.status IN ('pending','confirmed','checked_in') AND r.check_in <= ? AND r.check_out > ?`,
    [today, today]
  );
  const [roomCounts] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM rooms WHERE is_active = 1 GROUP BY status`
  );
  const counts = Object.fromEntries(roomCounts.map((row) => [row.status, Number(row.count)]));
  const sellable = Object.entries(counts).reduce((sum, [status, count]) => (
    ['out_of_order', 'maintenance'].includes(status) ? sum : sum + count
  ), 0);
  const [[collected]] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE DATE(paid_at) = ?`,
    [today]
  );
  const [messages] = await pool.query(
    'SELECT id, name, email, topic, body, created_at, is_read FROM messages ORDER BY created_at DESC LIMIT 5'
  );
  const forecast = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(today, i);
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS count FROM reservations WHERE check_in = ? AND status IN ('confirmed','pending','checked_in')`,
      [date]
    );
    forecast.push({ date, arrivals: Number(row.count) });
  }
  const [[unread]] = await pool.query('SELECT COUNT(*) AS count FROM messages WHERE is_read = 0');
  res.json({
    success: true,
    data: {
      today,
      arrivals,
      departures,
      in_house: Number(inHouse.count),
      sold_tonight: Number(sold.count),
      sellable_rooms: sellable,
      occupancy_percent: sellable ? Math.round((Number(sold.count) / sellable) * 1000) / 10 : 0,
      room_counts: counts,
      dirty_rooms: counts.dirty || 0,
      collected_today: Number(collected.amount),
      forecast,
      messages,
      unread_messages: Number(unread.count),
    },
  });
}));

router.get('/overview', authorize('owner', 'manager'), asyncHandler(async (req, res) => {
  const today = todayISO();
  const from = String(req.query.from || addDays(today, -29));
  const to = String(req.query.to || addDays(today, 1));
  const [rooms] = await pool.query(`SELECT status FROM rooms WHERE is_active = 1`);
  const sellable = rooms.filter((room) => !['out_of_order', 'maintenance'].includes(room.status)).length;
  const [reservations] = await pool.query(
    `SELECT r.id, r.status, r.check_in, r.check_out, r.subtotal, r.discount, r.source,
            g.nationality
     FROM reservations r JOIN guests g ON g.id = r.guest_id
     WHERE r.check_in < ? AND r.check_out > ?`,
    [to, from]
  );
  const definite = reservations.filter((row) => ['confirmed', 'checked_in', 'checked_out'].includes(row.status));
  const [lines] = await pool.query(
    `SELECT rr.reservation_id, rr.nights FROM reservation_rooms rr`
  );
  const roomsByRes = {};
  for (const line of lines) roomsByRes[line.reservation_id] = (roomsByRes[line.reservation_id] || 0) + 1;

  const days = eachNight(from, Math.max(0, nightsBetween(from, to)));
  let roomRevenue = 0;
  let roomNightsSold = 0;
  const byDay = days.map((date) => ({ date, sold: 0, available: sellable, percent: 0 }));
  const dayIndex = Object.fromEntries(byDay.map((day, index) => [day.date, index]));

  for (const reservation of definite) {
    const nights = Math.max(1, nightsBetween(reservation.check_in, reservation.check_out));
    const roomCount = roomsByRes[reservation.id] || 1;
    const net = Number(reservation.subtotal) - Number(reservation.discount);
    const perRoomNight = net / nights / roomCount;
    const stayNights = eachNight(reservation.check_in, nights);
    for (const date of stayNights) {
      if (dayIndex[date] == null) continue;
      byDay[dayIndex[date]].sold += roomCount;
      roomRevenue += perRoomNight * roomCount;
      roomNightsSold += roomCount;
    }
  }
  for (const day of byDay) {
    day.percent = sellable ? Math.round((day.sold / sellable) * 1000) / 10 : 0;
  }

  const [[extras]] = await pool.query(
    `SELECT COALESCE(SUM(amount * quantity),0) AS amount
     FROM folio_items WHERE DATE(posted_at) >= ? AND DATE(posted_at) < ?`,
    [from, to]
  );
  const [payments] = await pool.query(
    `SELECT method, COALESCE(SUM(amount),0) AS amount
     FROM payments WHERE DATE(paid_at) >= ? AND DATE(paid_at) < ?
     GROUP BY method`,
    [from, to]
  );
  const sources = countBy(definite, (row) => row.source || 'website');
  const nationalities = countBy(definite, (row) => row.nationality || 'Unspecified');
  const availableNights = sellable * days.length;
  const [house] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM rooms WHERE is_active = 1 GROUP BY status`
  );

  res.json({
    success: true,
    data: {
      from,
      to,
      occupancy: {
        room_nights_sold: roomNightsSold,
        room_nights_available: availableNights,
        percent: availableNights ? Math.round((roomNightsSold / availableNights) * 1000) / 10 : 0,
        by_day: byDay,
      },
      revenue: {
        room: money(roomRevenue),
        extras: money(extras.amount),
        total: money(roomRevenue + Number(extras.amount)),
        adr: roomNightsSold ? money(roomRevenue / roomNightsSold) : 0,
        revpar: availableNights ? money(roomRevenue / availableNights) : 0,
      },
      payments: payments.map((row) => ({ method: row.method, amount: Number(row.amount) })),
      sources,
      nationalities,
      cancellations: reservations.filter((row) => row.status === 'cancelled').length,
      no_shows: reservations.filter((row) => row.status === 'no_show').length,
      housekeeping: house.map((row) => ({ status: row.status, count: Number(row.count) })),
    },
  });
}));

function countBy(rows, pick) {
  const map = {};
  for (const row of rows) {
    const key = pick(row);
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default router;
