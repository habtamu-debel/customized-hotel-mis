import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import pool from '../config/database.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { getSettings, publicSettings } from '../lib/settings.js';
import { presentType } from '../lib/present.js';
import { availabilityForTypes } from '../lib/availability.js';
import { quoteStay } from '../lib/pricing.js';
import { buildQuote, cancelReservation, createReservation, getReservationByRef } from '../lib/booking.js';
import { nightsBetween } from '../lib/dates.js';

const router = Router();

const searchLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking attempts. Please wait a few minutes.' },
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.');
const staySchema = z.object({
  check_in: dateString,
  check_out: dateString,
  adults: z.coerce.number().int().min(1).max(16),
  children: z.coerce.number().int().min(0).max(12).default(0),
});

const roomsSchema = z.array(z.object({
  room_type_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(8),
})).min(1);

function assertStay(input) {
  const nights = nightsBetween(input.check_in, input.check_out);
  if (!Number.isFinite(nights) || nights < 1 || nights > 60) {
    throw new HttpError(400, 'Check-out must be after check-in, up to 60 nights.');
  }
}

router.get('/property', asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ success: true, data: publicSettings(settings) });
}));

router.get('/room-types', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM room_types WHERE is_active = 1 ORDER BY sort_order, id');
  res.json({ success: true, data: rows.map(presentType) });
}));

router.get('/room-types/:slug', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM room_types WHERE slug = ? AND is_active = 1', [req.params.slug]);
  if (!rows[0]) throw new HttpError(404, 'Room not found.');
  res.json({ success: true, data: presentType(rows[0]) });
}));

router.get('/offers', asyncHandler(async (req, res) => {
  const [promos] = await pool.query(
    `SELECT code, description, type, value, valid_from, valid_to
     FROM promotions WHERE is_active = 1 ORDER BY id`
  );
  res.json({
    success: true,
    data: promos.map((promo) => ({ ...promo, value: Number(promo.value) })),
  });
}));

router.post('/availability', searchLimit, asyncHandler(async (req, res) => {
  const input = staySchema.parse(req.body || {});
  assertStay(input);
  const settings = await getSettings();
  const [types] = await pool.query('SELECT * FROM room_types WHERE is_active = 1 ORDER BY sort_order, id');
  const [plans] = await pool.query(
    `SELECT * FROM rate_plans WHERE is_active = 1 AND start_date <= ? AND end_date >= ?`,
    [input.check_out, input.check_in]
  );
  const avail = await availabilityForTypes(pool, { checkIn: input.check_in, checkOut: input.check_out });
  const data = types.map((row) => {
    const type = presentType(row);
    const stock = avail[type.id] || { available: 0, total: 0 };
    const fits = input.adults <= type.max_adults
      && input.children <= type.max_children
      && input.adults + input.children <= type.max_occupancy;
    let sample = null;
    if (stock.available > 0) {
      try {
        const rooms = [{
          type: row,
          adults: fits ? input.adults : Math.min(type.base_occupancy, type.max_adults),
          children: fits ? input.children : 0,
        }];
        sample = quoteStay({ rooms, plans, checkIn: input.check_in, checkOut: input.check_out, promo: null, settings });
      } catch {
        sample = null;
      }
    }
    return {
      ...type,
      available: stock.available,
      total: stock.total,
      fits,
      sample: sample ? {
        nights: sample.nights,
        nightly: sample.lines[0]?.rate_per_night || type.base_rate,
        subtotal: sample.subtotal,
        total: sample.total,
        vat: sample.vat,
        service_charge: sample.service_charge,
      } : null,
    };
  });
  res.json({ success: true, data });
}));

router.post('/quote', searchLimit, asyncHandler(async (req, res) => {
  const input = staySchema.extend({
    rooms: roomsSchema,
    promo_code: z.string().max(40).optional().or(z.literal('')),
  }).parse(req.body || {});
  assertStay(input);
  const { quote } = await buildQuote(pool, input);
  res.json({ success: true, data: quote });
}));

router.post('/bookings', searchLimit, asyncHandler(async (req, res) => {
  const input = staySchema.extend({
    rooms: roomsSchema,
    promo_code: z.string().max(40).optional().or(z.literal('')),
    payment_preference: z.enum(['pay_at_hotel', 'pay_now', 'request']).default('pay_at_hotel'),
    special_requests: z.string().max(500).optional().or(z.literal('')),
    guest: z.object({
      first_name: z.string().trim().min(1, 'First name is required.').max(80),
      last_name: z.string().trim().min(1, 'Last name is required.').max(80),
      email: z.string().trim().email('Enter a valid email.'),
      phone: z.string().trim().min(6, 'Phone is required.').max(40),
      nationality: z.string().max(80).optional().or(z.literal('')),
      id_type: z.string().max(40).optional().or(z.literal('')),
      id_number: z.string().max(80).optional().or(z.literal('')),
    }),
  }).parse(req.body || {});
  assertStay(input);
  const booking = await createReservation({ ...input, source: 'website' });
  res.status(201).json({ success: true, data: await getReservationByRef(booking.booking_ref, booking.email) });
}));

router.get('/bookings/:ref', asyncHandler(async (req, res) => {
  const data = await getReservationByRef(req.params.ref, req.query.email);
  res.json({ success: true, data });
}));

router.post('/bookings/:ref/cancel', searchLimit, asyncHandler(async (req, res) => {
  const body = z.object({
    email: z.string().email(),
    reason: z.string().max(200).optional(),
  }).parse(req.body || {});
  const [rows] = await pool.query('SELECT id FROM reservations WHERE booking_ref = ?', [req.params.ref.trim().toUpperCase()]);
  if (!rows[0]) throw new HttpError(404, 'Booking not found.');
  const data = await cancelReservation(rows[0].id, { reason: body.reason || 'Cancelled by guest', email: body.email });
  res.json({ success: true, data });
}));

router.post('/messages', searchLimit, asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email(),
    phone: z.string().max(40).optional().or(z.literal('')),
    topic: z.string().max(80).optional().or(z.literal('')),
    body: z.string().trim().min(5).max(2000),
  }).parse(req.body || {});
  await pool.query(
    'INSERT INTO messages (name, email, phone, topic, body) VALUES (?,?,?,?,?)',
    [body.name, body.email, body.phone || null, body.topic || 'General', body.body]
  );
  res.status(201).json({ success: true, message: 'Message received. The hotel will reply shortly.' });
}));

export default router;
