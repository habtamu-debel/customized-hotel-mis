import pool from '../config/database.js';
import { getSettings } from './settings.js';
import { assignGuests, quoteStay } from './pricing.js';
import { availabilityForTypes } from './availability.js';
import { HttpError, money, parseJson } from './http.js';
import { asDate, todayISO } from './dates.js';

const OPEN_STATUSES = ['pending', 'confirmed', 'checked_in'];
const STAFF_ROLES = ['owner', 'manager', 'front_desk'];

function nextRef() {
  const day = todayISO().replace(/-/g, '');
  const tail = String(Math.floor(Math.random() * 9000) + 1000);
  return `FP-${day}-${tail}`;
}

async function loadTypes(db, ids) {
  const [types] = await db.query('SELECT * FROM room_types WHERE id IN (?) AND is_active = 1', [ids]);
  const map = Object.fromEntries(types.map((type) => [Number(type.id), type]));
  return map;
}

async function loadPlans(db, ids, checkIn, checkOut) {
  const [plans] = await db.query(
    `SELECT * FROM rate_plans
     WHERE room_type_id IN (?) AND is_active = 1
       AND start_date <= ? AND end_date >= ?`,
    [ids, checkOut, checkIn]
  );
  return plans;
}

async function loadPromo(db, code, checkIn, { lock = false } = {}) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  if (!normalized) return null;
  const [rows] = await db.query(
    `SELECT * FROM promotions WHERE code = ? AND is_active = 1 ${lock ? 'FOR UPDATE' : ''}`,
    [normalized]
  );
  const promo = rows[0];
  if (!promo) throw new HttpError(400, 'Promo code is not valid.');
  if (promo.valid_from && checkIn < asDate(promo.valid_from)) throw new HttpError(400, 'Promo code is not valid for these dates.');
  if (promo.valid_to && checkIn > asDate(promo.valid_to)) throw new HttpError(400, 'Promo code has expired.');
  if (promo.usage_limit && Number(promo.used_count) >= Number(promo.usage_limit)) {
    throw new HttpError(400, 'Promo code has been fully used.');
  }
  return promo;
}

function assertAvailability(items, typeMap, avail) {
  for (const item of items) {
    const type = typeMap[Number(item.room_type_id)];
    if (!type) throw new HttpError(400, 'Unknown room type.');
    const qty = Number(item.quantity || 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 8) throw new HttpError(400, 'Room quantity looks wrong.');
    const free = avail[type.id]?.available ?? 0;
    if (qty > free) throw new HttpError(409, `${type.name} is no longer available for those dates.`);
  }
}

export async function buildQuote(db, input, { lockPromo = false } = {}) {
  const items = input.rooms || [];
  if (!items.length) throw new HttpError(400, 'Choose at least one room.');
  const typeIds = [...new Set(items.map((item) => Number(item.room_type_id)))];
  const typeMap = await loadTypes(db, typeIds);
  const settings = await getSettings(db);
  const plans = await loadPlans(db, typeIds, input.check_in, input.check_out);
  const avail = await availabilityForTypes(db, {
    checkIn: input.check_in,
    checkOut: input.check_out,
    typeIds,
    ignoreReservationId: input.ignoreReservationId || null,
  });
  assertAvailability(items, typeMap, avail);
  const expanded = assignGuests(
    items.map((item) => ({ type: typeMap[Number(item.room_type_id)], quantity: Number(item.quantity) })),
    input.adults,
    input.children || 0
  );
  const promo = await loadPromo(db, input.promo_code, input.check_in, { lock: lockPromo });
  const quote = quoteStay({
    rooms: expanded,
    plans,
    checkIn: input.check_in,
    checkOut: input.check_out,
    promo,
    settings,
  });
  return { quote, promo, settings, avail };
}

async function syncPaid(db, reservationId) {
  await db.query(
    `UPDATE reservations
     SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE reservation_id = ?)
     WHERE id = ?`,
    [reservationId, reservationId]
  );
}

export async function createReservation(input, { userId = null } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const typeIds = [...new Set((input.rooms || []).map((item) => Number(item.room_type_id)))].sort((a, b) => a - b);
    if (!typeIds.length) throw new HttpError(400, 'Choose at least one room.');
    await conn.query('SELECT id FROM room_types WHERE id IN (?) FOR UPDATE', [typeIds]);

    const { quote, promo } = await buildQuote(conn, input, { lockPromo: true });
    const guestId = await upsertGuest(conn, input.guest, input.guest_id);

    let ref = nextRef();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const [exists] = await conn.query('SELECT id FROM reservations WHERE booking_ref = ?', [ref]);
      if (!exists.length) break;
      ref = nextRef();
    }

    const status = input.status
      || (input.payment_preference === 'pay_at_hotel' ? 'confirmed' : 'pending');

    const [created] = await conn.query(
      `INSERT INTO reservations
        (booking_ref, guest_id, status, check_in, check_out, adults, children, source,
         payment_preference, special_requests, promo_code, subtotal, discount, service_charge,
         vat, total_amount, price_snapshot, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ref, guestId, status, input.check_in, input.check_out, Number(input.adults), Number(input.children || 0),
        input.source || 'website', input.payment_preference || 'pay_at_hotel', input.special_requests || null,
        promo?.code || null, quote.subtotal, quote.discount, quote.service_charge, quote.vat, quote.total,
        JSON.stringify(quote), userId,
      ]
    );

    for (const line of quote.lines) {
      await conn.query(
        `INSERT INTO reservation_rooms
          (reservation_id, room_type_id, rate_per_night, nights, adults, children, extra_adult_charge, extra_child_charge, line_total)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          created.insertId, line.room_type_id, line.rate_per_night, line.nights, line.adults, line.children,
          line.extra_adult, line.extra_child, line.each_total,
        ]
      );
    }

    await conn.query(
      `INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note)
       VALUES (?,?,?,?,?)`,
      [created.insertId, null, status, userId, input.source === 'website' ? 'Online request' : 'Created by staff']
    );

    if (promo) {
      await conn.query('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [promo.id]);
    }

    await conn.commit();
    return getReservation(created.insertId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function upsertGuest(conn, guest, guestId) {
  if (guestId) {
    const [rows] = await conn.query('SELECT * FROM guests WHERE id = ?', [guestId]);
    if (!rows[0]) throw new HttpError(400, 'Guest record was not found.');
    if (rows[0].is_blacklisted) throw new HttpError(403, 'This guest is blocked from new bookings.');
    return guestId;
  }
  if (!guest?.email || !guest.first_name || !guest.last_name || !guest.phone) {
    throw new HttpError(400, 'Guest name, email, and phone are required.');
  }
  const email = guest.email.trim().toLowerCase();
  const [existing] = await conn.query('SELECT * FROM guests WHERE email = ? LIMIT 1', [email]);
  if (existing[0]?.is_blacklisted) throw new HttpError(403, 'This guest is blocked from new bookings.');
  if (existing[0]) {
    await conn.query(
      `UPDATE guests
       SET first_name = ?, last_name = ?, phone = ?,
           nationality = COALESCE(NULLIF(?, ''), nationality),
           id_type = COALESCE(NULLIF(?, ''), id_type),
           id_number = COALESCE(NULLIF(?, ''), id_number)
       WHERE id = ?`,
      [guest.first_name.trim(), guest.last_name.trim(), guest.phone.trim(), guest.nationality || '', guest.id_type || '', guest.id_number || '', existing[0].id]
    );
    return existing[0].id;
  }
  const [inserted] = await conn.query(
    `INSERT INTO guests (first_name, last_name, email, phone, nationality, id_type, id_number, company_name)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      guest.first_name.trim(), guest.last_name.trim(), email, guest.phone.trim(),
      guest.nationality || null, guest.id_type || null, guest.id_number || null, guest.company_name || null,
    ]
  );
  return inserted.insertId;
}

export async function getReservation(id) {
  const [rows] = await pool.query(
    `SELECT r.*, g.first_name, g.last_name, g.email, g.phone, g.nationality, g.id_type, g.id_number,
            g.is_vip, g.is_blacklisted, g.company_name, g.notes AS guest_notes
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     WHERE r.id = ?`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  return hydrate(rows[0]);
}

export async function getReservationByRef(ref, email) {
  const [rows] = await pool.query(
    `SELECT r.*, g.first_name, g.last_name, g.email, g.phone, g.nationality
     FROM reservations r JOIN guests g ON g.id = r.guest_id
     WHERE r.booking_ref = ?`,
    [String(ref || '').trim().toUpperCase()]
  );
  const row = rows[0];
  if (!row || String(row.email || '').toLowerCase() !== String(email || '').trim().toLowerCase()) {
    throw new HttpError(404, 'Booking not found. Check the reference and email.');
  }
  const full = await hydrate(row);
  return {
    booking_ref: full.booking_ref,
    status: full.status,
    check_in: full.check_in,
    check_out: full.check_out,
    adults: full.adults,
    children: full.children,
    guest_name: `${full.first_name} ${full.last_name}`,
    email: full.email,
    payment_preference: full.payment_preference,
    special_requests: full.special_requests,
    subtotal: full.subtotal,
    discount: full.discount,
    service_charge: full.service_charge,
    vat: full.vat,
    total_amount: full.total_amount,
    paid_amount: full.paid_amount,
    balance: full.balance,
    promo_code: full.promo_code,
    rooms: full.rooms.map((room) => ({
      type_name: room.type_name,
      rate_per_night: room.rate_per_night,
      nights: room.nights,
      line_total: room.line_total,
      room_number: room.room_number,
    })),
    cancellation_policy: (await getSettings()).cancellation_policy,
  };
}

async function hydrate(row) {
  const [rooms] = await pool.query(
    `SELECT rr.*, rt.name AS type_name, rt.slug AS type_slug, rm.room_number, rm.floor, rm.status AS live_status
     FROM reservation_rooms rr
     JOIN room_types rt ON rt.id = rr.room_type_id
     LEFT JOIN rooms rm ON rm.id = rr.room_id
     WHERE rr.reservation_id = ?
     ORDER BY rr.id`,
    [row.id]
  );
  const [folio] = await pool.query(
    'SELECT * FROM folio_items WHERE reservation_id = ? ORDER BY posted_at, id',
    [row.id]
  );
  const [payments] = await pool.query(
    'SELECT * FROM payments WHERE reservation_id = ? ORDER BY paid_at, id',
    [row.id]
  );
  const [logs] = await pool.query(
    `SELECT l.*, u.name AS user_name
     FROM reservation_status_log l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.reservation_id = ?
     ORDER BY l.created_at, l.id`,
    [row.id]
  );
  const extras = money(folio.reduce((sum, item) => sum + Number(item.amount) * Number(item.quantity), 0));
  const total = money(Number(row.total_amount) + extras);
  const paid = money(row.paid_amount);
  return {
    ...row,
    adults: Number(row.adults),
    children: Number(row.children),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    service_charge: Number(row.service_charge),
    vat: Number(row.vat),
    total_amount: Number(row.total_amount),
    paid_amount: paid,
    extras,
    grand_total: total,
    balance: money(total - paid),
    price_snapshot: parseJson(row.price_snapshot, null),
    rooms,
    folio,
    payments,
    logs,
  };
}

export async function listReservations({ q, status, from, to, limit = 80 }) {
  const where = [];
  const params = [];
  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }
  if (from) {
    where.push('r.check_out > ?');
    params.push(from);
  }
  if (to) {
    where.push('r.check_in < ?');
    params.push(to);
  }
  if (q) {
    where.push('(r.booking_ref LIKE ? OR g.first_name LIKE ? OR g.last_name LIKE ? OR g.phone LIKE ? OR g.email LIKE ? OR rm.room_number = ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like, q);
  }
  const sql = `
    SELECT DISTINCT r.id, r.booking_ref, r.status, r.check_in, r.check_out, r.adults, r.children,
           r.source, r.total_amount, r.paid_amount, r.created_at, r.payment_preference,
           g.first_name, g.last_name, g.phone, g.email, g.is_vip
    FROM reservations r
    JOIN guests g ON g.id = r.guest_id
    LEFT JOIN reservation_rooms rr ON rr.reservation_id = r.id
    LEFT JOIN rooms rm ON rm.id = rr.room_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY r.check_in DESC, r.id DESC
    LIMIT ?`;
  params.push(Number(limit));
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function setRoomStatus(conn, roomId, status, userId, note) {
  await conn.query('UPDATE rooms SET status = ?, ooo_reason = IF(? IN ("out_of_order","maintenance"), ooo_reason, NULL) WHERE id = ?', [status, status, roomId]);
  await conn.query(
    'INSERT INTO room_status_log (room_id, status, user_id, note) VALUES (?,?,?,?)',
    [roomId, status, userId, note || null]
  );
}

async function assertRoomFree(conn, roomId, checkIn, checkOut, reservationId) {
  const [rows] = await conn.query(
    `SELECT r.booking_ref FROM reservation_rooms rr
     JOIN reservations r ON r.id = rr.reservation_id
     WHERE rr.room_id = ?
       AND r.status IN ('pending','confirmed','checked_in')
       AND r.check_in < ? AND r.check_out > ?
       AND r.id <> ?`,
    [roomId, checkOut, checkIn, reservationId]
  );
  if (rows.length) throw new HttpError(409, `Room is already held by ${rows[0].booking_ref}.`);
}

export async function checkIn(reservationId, { assignments = [], userId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
    const reservation = rows[0];
    if (!reservation) throw new HttpError(404, 'Booking not found.');
    if (!['confirmed', 'pending'].includes(reservation.status)) {
      throw new HttpError(400, 'Only a confirmed or pending booking can be checked in.');
    }
    const [roomRows] = await conn.query(
      'SELECT * FROM reservation_rooms WHERE reservation_id = ? ORDER BY id FOR UPDATE',
      [reservationId]
    );
    const assignmentMap = Object.fromEntries((assignments || []).map((item) => [Number(item.reservation_room_id), Number(item.room_id)]));

    for (const line of roomRows) {
      let roomId = line.room_id || assignmentMap[line.id] || null;
      if (roomId) {
        const [found] = await conn.query('SELECT * FROM rooms WHERE id = ? AND is_active = 1 FOR UPDATE', [roomId]);
        const room = found[0];
        if (!room || Number(room.room_type_id) !== Number(line.room_type_id)) {
          throw new HttpError(400, 'Selected room does not match the booked room type.');
        }
        if (!['inspected', 'clean', 'available'].includes(room.status)) {
          throw new HttpError(400, `Room ${room.room_number} is ${room.status.replaceAll('_', ' ')} and cannot be checked in.`);
        }
        await assertRoomFree(conn, room.id, reservation.check_in, reservation.check_out, reservationId);
      } else {
        const [candidates] = await conn.query(
          `SELECT id, room_number FROM rooms
           WHERE room_type_id = ? AND is_active = 1 AND status IN ('inspected','clean','available')
             AND id NOT IN (
               SELECT rr.room_id FROM reservation_rooms rr
               JOIN reservations r ON r.id = rr.reservation_id
               WHERE rr.room_id IS NOT NULL
                 AND r.status IN ('pending','confirmed','checked_in')
                 AND r.check_in < ? AND r.check_out > ?
                 AND r.id <> ?
             )
           ORDER BY FIELD(status, 'inspected', 'clean', 'available'), room_number
           LIMIT 1
           FOR UPDATE`,
          [line.room_type_id, reservation.check_out, reservation.check_in, reservationId]
        );
        if (!candidates[0]) throw new HttpError(409, 'No clean room is ready for this booking. Assign one from housekeeping first.');
        roomId = candidates[0].id;
      }
      await conn.query('UPDATE reservation_rooms SET room_id = ? WHERE id = ?', [roomId, line.id]);
      await setRoomStatus(conn, roomId, 'occupied', userId, `Check-in ${reservation.booking_ref}`);
    }

    await conn.query('UPDATE reservations SET status = "checked_in" WHERE id = ?', [reservationId]);
    await conn.query(
      'INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note) VALUES (?,?,?,?,?)',
      [reservationId, reservation.status, 'checked_in', userId, 'Guest checked in']
    );
    await conn.commit();
    return getReservation(reservationId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function checkOut(reservationId, { userId, force = false, role }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const reservation = await lockReservation(conn, reservationId);
    if (reservation.status !== 'checked_in') throw new HttpError(400, 'Only an in-house guest can be checked out.');
    const balance = await balanceOf(conn, reservationId);
    if (balance.balance > 0.5 && !(force && ['owner', 'manager'].includes(role))) {
      throw new HttpError(400, `Outstanding balance of ETB ${balance.balance.toFixed(2)} must be collected first.`);
    }
    const [roomRows] = await conn.query('SELECT room_id FROM reservation_rooms WHERE reservation_id = ?', [reservationId]);
    for (const line of roomRows) {
      if (line.room_id) await setRoomStatus(conn, line.room_id, 'dirty', userId, `Check-out ${reservation.booking_ref}`);
    }
    await conn.query('UPDATE reservations SET status = "checked_out" WHERE id = ?', [reservationId]);
    await conn.query(
      'INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note) VALUES (?,?,?,?,?)',
      [reservationId, 'checked_in', 'checked_out', userId, 'Guest checked out']
    );
    await conn.commit();
    return getReservation(reservationId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function lockReservation(conn, id) {
  const [rows] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [id]);
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  return rows[0];
}

async function balanceOf(conn, reservationId) {
  const [[reservation]] = await conn.query('SELECT total_amount, paid_amount FROM reservations WHERE id = ?', [reservationId]);
  const [[folio]] = await conn.query(
    'SELECT COALESCE(SUM(amount * quantity), 0) AS extras FROM folio_items WHERE reservation_id = ?',
    [reservationId]
  );
  const total = money(Number(reservation.total_amount) + Number(folio.extras));
  const paid = money(reservation.paid_amount);
  return { total, paid, balance: money(total - paid) };
}

export async function cancelReservation(reservationId, { userId = null, reason, email = null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const reservation = await lockReservation(conn, reservationId);
    if (email) {
      const [guest] = await conn.query('SELECT email FROM guests WHERE id = ?', [reservation.guest_id]);
      if (String(guest[0]?.email || '').toLowerCase() !== String(email).trim().toLowerCase()) {
        throw new HttpError(404, 'Booking not found.');
      }
      const settings = await getSettings(conn);
      const limit = new Date(`${asDate(reservation.check_in)}T00:00:00`);
      limit.setHours(limit.getHours() - Number(settings.cancel_hours || 48));
      if (new Date() > limit) throw new HttpError(400, 'This booking is inside the cancellation window. Call the hotel.');
      if (!['pending', 'confirmed'].includes(reservation.status)) {
        throw new HttpError(400, 'This booking can no longer be cancelled online.');
      }
    } else if (!['pending', 'confirmed', 'checked_in'].includes(reservation.status)) {
      throw new HttpError(400, 'This booking cannot be cancelled.');
    }
    if (reservation.status === 'checked_in') {
      const [roomRows] = await conn.query('SELECT room_id FROM reservation_rooms WHERE reservation_id = ?', [reservationId]);
      for (const line of roomRows) {
        if (line.room_id) await setRoomStatus(conn, line.room_id, 'dirty', userId, 'Stay cancelled');
      }
    }
    await conn.query('UPDATE reservations SET status = "cancelled", cancellation_reason = ? WHERE id = ?', [reason || null, reservationId]);
    await conn.query(
      'INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note) VALUES (?,?,?,?,?)',
      [reservationId, reservation.status, 'cancelled', userId, reason || 'Cancelled']
    );
    await conn.commit();
    return email ? { booking_ref: reservation.booking_ref, status: 'cancelled' } : getReservation(reservationId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function markNoShow(reservationId, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const reservation = await lockReservation(conn, reservationId);
    if (!['confirmed', 'pending'].includes(reservation.status)) throw new HttpError(400, 'Only an expected arrival can be marked as a no-show.');
    await conn.query('UPDATE reservation_rooms SET room_id = NULL WHERE reservation_id = ?', [reservationId]);
    await conn.query('UPDATE reservations SET status = "no_show" WHERE id = ?', [reservationId]);
    await conn.query(
      'INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note) VALUES (?,?,?,?,?)',
      [reservationId, reservation.status, 'no_show', userId, 'Marked no-show']
    );
    await conn.commit();
    return getReservation(reservationId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function confirmReservation(reservationId, userId) {
  const [rows] = await pool.query('SELECT status FROM reservations WHERE id = ?', [reservationId]);
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  if (rows[0].status !== 'pending') throw new HttpError(400, 'Only a pending booking can be confirmed.');
  await pool.query('UPDATE reservations SET status = "confirmed" WHERE id = ?', [reservationId]);
  await pool.query(
    'INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note) VALUES (?,?,?,?,?)',
    [reservationId, 'pending', 'confirmed', userId, 'Confirmed by staff']
  );
  return getReservation(reservationId);
}

export async function changeDates(reservationId, { checkIn, checkOut, userId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const reservation = await lockReservation(conn, reservationId);
    if (['cancelled', 'checked_out', 'no_show'].includes(reservation.status)) {
      throw new HttpError(400, 'This booking can no longer be modified.');
    }
    const [roomRows] = await conn.query('SELECT * FROM reservation_rooms WHERE reservation_id = ? ORDER BY id', [reservationId]);
    const typeIds = [...new Set(roomRows.map((row) => Number(row.room_type_id)))].sort((a, b) => a - b);
    await conn.query('SELECT id FROM room_types WHERE id IN (?) FOR UPDATE', [typeIds]);
    const counts = {};
    for (const row of roomRows) counts[row.room_type_id] = (counts[row.room_type_id] || 0) + 1;
    const items = Object.entries(counts).map(([room_type_id, quantity]) => ({ room_type_id: Number(room_type_id), quantity }));
    const typeMap = await loadTypes(conn, typeIds);
    const settings = await getSettings(conn);
    const plans = await loadPlans(conn, typeIds, checkIn, checkOut);
    const avail = await availabilityForTypes(conn, {
      checkIn, checkOut, typeIds, ignoreReservationId: reservationId,
    });
    assertAvailability(items, typeMap, avail);

    for (const row of roomRows) {
      if (!row.room_id) continue;
      await assertRoomFree(conn, row.room_id, checkIn, checkOut, reservationId);
    }

    const promo = reservation.promo_code
      ? (await conn.query('SELECT * FROM promotions WHERE code = ?', [reservation.promo_code]))[0][0] || null
      : null;
    const quote = quoteStay({
      rooms: roomRows.map((row) => ({ type: typeMap[row.room_type_id], adults: row.adults, children: row.children })),
      plans,
      checkIn,
      checkOut,
      promo,
      settings,
    });
    if (quote.lines.length !== roomRows.length) throw new HttpError(500, 'Could not reprice this stay.');

    for (let i = 0; i < roomRows.length; i += 1) {
      const line = quote.lines[i];
      await conn.query(
        `UPDATE reservation_rooms
         SET rate_per_night = ?, nights = ?, extra_adult_charge = ?, extra_child_charge = ?, line_total = ?
         WHERE id = ?`,
        [line.rate_per_night, line.nights, line.extra_adult, line.extra_child, line.each_total, roomRows[i].id]
      );
    }
    await conn.query(
      `UPDATE reservations
       SET check_in = ?, check_out = ?, subtotal = ?, discount = ?, service_charge = ?, vat = ?, total_amount = ?, price_snapshot = ?
       WHERE id = ?`,
      [checkIn, checkOut, quote.subtotal, quote.discount, quote.service_charge, quote.vat, quote.total, JSON.stringify(quote), reservationId]
    );
    await conn.query(
      'INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note) VALUES (?,?,?,?,?)',
      [reservationId, reservation.status, reservation.status, userId, `Dates changed to ${checkIn} – ${checkOut}`]
    );
    await conn.commit();
    return getReservation(reservationId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function moveRoom(reservationId, reservationRoomId, roomId, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const reservation = await lockReservation(conn, reservationId);
    if (['cancelled', 'checked_out', 'no_show'].includes(reservation.status)) {
      throw new HttpError(400, 'This booking can no longer be modified.');
    }
    const [lines] = await conn.query(
      'SELECT * FROM reservation_rooms WHERE id = ? AND reservation_id = ? FOR UPDATE',
      [reservationRoomId, reservationId]
    );
    const line = lines[0];
    if (!line) throw new HttpError(404, 'Room line not found.');
    const [rooms] = await conn.query('SELECT * FROM rooms WHERE id = ? AND is_active = 1 FOR UPDATE', [roomId]);
    const room = rooms[0];
    if (!room || Number(room.room_type_id) !== Number(line.room_type_id)) {
      throw new HttpError(400, 'Choose a room of the same type, or upgrade the room type first.');
    }
    await assertRoomFree(conn, room.id, reservation.check_in, reservation.check_out, reservationId);
    if (reservation.status === 'checked_in') {
      if (!['inspected', 'clean', 'available'].includes(room.status)) {
        throw new HttpError(400, `Room ${room.room_number} is not ready.`);
      }
      if (line.room_id) await setRoomStatus(conn, line.room_id, 'dirty', userId, `Moved ${reservation.booking_ref}`);
      await setRoomStatus(conn, room.id, 'occupied', userId, `Moved ${reservation.booking_ref}`);
    }
    await conn.query('UPDATE reservation_rooms SET room_id = ? WHERE id = ?', [room.id, line.id]);
    await conn.query(
      'INSERT INTO reservation_status_log (reservation_id, old_status, new_status, user_id, note) VALUES (?,?,?,?,?)',
      [reservationId, reservation.status, reservation.status, userId, `Assigned room ${room.room_number}`]
    );
    await conn.commit();
    return getReservation(reservationId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function addPayment(reservationId, payload, userId) {
  const amount = money(payload.amount);
  if (amount <= 0) throw new HttpError(400, 'Payment amount must be greater than zero.');
  const [rows] = await pool.query('SELECT id, status FROM reservations WHERE id = ?', [reservationId]);
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  if (['cancelled'].includes(rows[0].status)) throw new HttpError(400, 'Cannot take payment on a cancelled booking.');
  await pool.query(
    `INSERT INTO payments (reservation_id, amount, method, reference, note, received_by)
     VALUES (?,?,?,?,?,?)`,
    [reservationId, amount, payload.method, payload.reference || null, payload.note || null, userId]
  );
  await syncPaid(pool, reservationId);
  return getReservation(reservationId);
}

export async function addCharge(reservationId, payload, userId) {
  let amount = money(payload.amount);
  if (payload.item_type === 'discount' && amount > 0) amount = -amount;
  if (!payload.description?.trim()) throw new HttpError(400, 'Describe the charge.');
  if (!Number.isFinite(amount) || amount === 0) throw new HttpError(400, 'Enter a charge amount.');
  const [rows] = await pool.query('SELECT id, status FROM reservations WHERE id = ?', [reservationId]);
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  if (['cancelled', 'no_show'].includes(rows[0].status)) throw new HttpError(400, 'This booking is closed for new charges.');
  await pool.query(
    `INSERT INTO folio_items (reservation_id, description, amount, quantity, item_type, posted_by)
     VALUES (?,?,?,?,?,?)`,
    [reservationId, payload.description.trim(), amount, Number(payload.quantity || 1), payload.item_type || 'other', userId]
  );
  return getReservation(reservationId);
}

export { STAFF_ROLES };
