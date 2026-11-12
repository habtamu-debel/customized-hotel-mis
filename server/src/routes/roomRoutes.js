import { Router } from 'express';
import { z } from 'zod';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { presentType } from '../lib/present.js';
import { todayISO } from '../lib/dates.js';

const router = Router();
router.use(authenticate);

const managers = authorize('owner', 'manager');
const desk = authorize('owner', 'manager', 'front_desk');

router.get('/types', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM room_types ORDER BY sort_order, id');
  res.json({ success: true, data: rows.map(presentType) });
}));

router.post('/types', managers, asyncHandler(async (req, res) => {
  const body = typeSchema.parse(req.body || {});
  const [result] = await pool.query(
    `INSERT INTO room_types
      (slug, name, tagline, description, base_occupancy, max_occupancy, max_adults, max_children,
       bed_config, size_sqm, base_rate, extra_adult_rate, extra_child_rate, amenities_json, photos_json, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      body.slug, body.name, body.tagline, body.description || '', body.base_occupancy, body.max_occupancy,
      body.max_adults, body.max_children, body.bed_config, body.size_sqm, body.base_rate, body.extra_adult_rate,
      body.extra_child_rate, JSON.stringify(body.amenities || []), JSON.stringify(body.photos || []), body.sort_order || 0,
    ]
  );
  const [rows] = await pool.query('SELECT * FROM room_types WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, data: presentType(rows[0]) });
}));

router.patch('/types/:id', managers, asyncHandler(async (req, res) => {
  const body = typeSchema.partial().parse(req.body || {});
  const [existing] = await pool.query('SELECT * FROM room_types WHERE id = ?', [req.params.id]);
  if (!existing[0]) throw new HttpError(404, 'Room type not found.');
  const next = { ...presentType(existing[0]), ...body };
  await pool.query(
    `UPDATE room_types SET slug=?, name=?, tagline=?, description=?, base_occupancy=?, max_occupancy=?, max_adults=?,
      max_children=?, bed_config=?, size_sqm=?, base_rate=?, extra_adult_rate=?, extra_child_rate=?, amenities_json=?, photos_json=?
     WHERE id=?`,
    [
      next.slug, next.name, next.tagline, next.description, next.base_occupancy, next.max_occupancy, next.max_adults,
      next.max_children, next.bed_config, next.size_sqm, next.base_rate, next.extra_adult_rate, next.extra_child_rate,
      JSON.stringify(next.amenities || []), JSON.stringify(next.photos || []), req.params.id,
    ]
  );
  const [rows] = await pool.query('SELECT * FROM room_types WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: presentType(rows[0]) });
}));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT rm.*, rt.name AS type_name, rt.slug AS type_slug
     FROM rooms rm JOIN room_types rt ON rt.id = rm.room_type_id
     ORDER BY rm.floor, rm.room_number`
  );
  const today = todayISO();
  const [arrivals] = await pool.query(
    `SELECT rr.room_id, rr.room_type_id, r.booking_ref, g.first_name, g.last_name
     FROM reservations r
     JOIN reservation_rooms rr ON rr.reservation_id = r.id
     JOIN guests g ON g.id = r.guest_id
     WHERE r.status IN ('confirmed','pending') AND r.check_in = ?`,
    [today]
  );
  const arrivalByRoom = Object.fromEntries(arrivals.filter((row) => row.room_id).map((row) => [row.room_id, row]));
  const arrivalByType = {};
  for (const row of arrivals) arrivalByType[row.room_type_id] = (arrivalByType[row.room_type_id] || 0) + 1;
  res.json({
    success: true,
    data: rows.map((room) => ({
      ...room,
      arrival: arrivalByRoom[room.id] || null,
      arrivals_for_type: arrivalByType[room.room_type_id] || 0,
    })),
  });
}));

router.post('/', managers, asyncHandler(async (req, res) => {
  const body = z.object({
    room_type_id: z.coerce.number().int().positive(),
    room_number: z.string().trim().min(1).max(20),
    floor: z.coerce.number().int().min(0).max(80),
    view_type: z.string().max(60).optional().or(z.literal('')),
    is_accessible: z.boolean().optional(),
    notes: z.string().max(255).optional().or(z.literal('')),
  }).parse(req.body || {});
  const [result] = await pool.query(
    `INSERT INTO rooms (room_type_id, room_number, floor, view_type, is_accessible, notes, status)
     VALUES (?,?,?,?,?,?,'inspected')`,
    [body.room_type_id, body.room_number, body.floor, body.view_type || null, body.is_accessible ? 1 : 0, body.notes || null]
  );
  res.status(201).json({ success: true, data: { id: result.insertId } });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(['available', 'dirty', 'clean', 'inspected', 'out_of_order', 'maintenance']),
    note: z.string().max(255).optional().or(z.literal('')),
    ooo_reason: z.string().max(255).optional().or(z.literal('')),
    ooo_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  }).parse(req.body || {});
  if (req.user.role === 'housekeeping' && !['dirty', 'clean', 'inspected'].includes(body.status)) {
    throw new HttpError(403, 'Housekeeping can mark a room dirty, clean, or inspected.');
  }
  if (!['owner', 'manager', 'front_desk', 'housekeeping'].includes(req.user.role)) {
    throw new HttpError(403, 'You do not have permission for this action.');
  }
  const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  const room = rows[0];
  if (!room) throw new HttpError(404, 'Room not found.');
  if (room.status === 'occupied' && ['available', 'out_of_order', 'maintenance'].includes(body.status)) {
    throw new HttpError(400, 'Check the guest out before taking this room out of service.');
  }
  const blocking = ['out_of_order', 'maintenance'].includes(body.status);
  await pool.query(
    'UPDATE rooms SET status = ?, ooo_reason = ?, ooo_until = ?, notes = COALESCE(NULLIF(?, ""), notes) WHERE id = ?',
    [body.status, blocking ? (body.ooo_reason || body.note || null) : null, blocking ? (body.ooo_until || null) : null, body.note || '', req.params.id]
  );
  await pool.query(
    'INSERT INTO room_status_log (room_id, status, user_id, note) VALUES (?,?,?,?)',
    [req.params.id, body.status, req.user.id, body.note || null]
  );
  res.json({ success: true });
}));

router.get('/:id/history', desk, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.*, u.name AS user_name
     FROM room_status_log l LEFT JOIN users u ON u.id = l.user_id
     WHERE l.room_id = ? ORDER BY l.created_at DESC LIMIT 30`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

router.get('/rates/list', managers, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT rp.*, rt.name AS type_name
     FROM rate_plans rp JOIN room_types rt ON rt.id = rp.room_type_id
     ORDER BY rp.start_date DESC`
  );
  res.json({ success: true, data: rows.map((row) => ({ ...row, price: Number(row.price) })) });
}));

router.post('/rates', managers, asyncHandler(async (req, res) => {
  const body = z.object({
    room_type_id: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(140),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    price: z.coerce.number().positive(),
    min_stay: z.coerce.number().int().min(1).max(30).default(1),
  }).parse(req.body || {});
  if (body.end_date < body.start_date) throw new HttpError(400, 'End date must be on or after the start date.');
  const [result] = await pool.query(
    `INSERT INTO rate_plans (room_type_id, name, start_date, end_date, price, min_stay) VALUES (?,?,?,?,?,?)`,
    [body.room_type_id, body.name, body.start_date, body.end_date, body.price, body.min_stay]
  );
  res.status(201).json({ success: true, data: { id: result.insertId } });
}));

router.delete('/rates/:id', managers, asyncHandler(async (req, res) => {
  await pool.query('UPDATE rate_plans SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

const typeSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, 'Use lowercase letters and dashes.'),
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().min(1).max(180),
  description: z.string().max(2000).optional(),
  base_occupancy: z.coerce.number().int().min(1).max(10),
  max_occupancy: z.coerce.number().int().min(1).max(12),
  max_adults: z.coerce.number().int().min(1).max(10),
  max_children: z.coerce.number().int().min(0).max(8),
  bed_config: z.string().trim().min(1).max(140),
  size_sqm: z.coerce.number().int().min(8).max(400),
  base_rate: z.coerce.number().positive(),
  extra_adult_rate: z.coerce.number().min(0).default(0),
  extra_child_rate: z.coerce.number().min(0).default(0),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string()).optional(),
  sort_order: z.coerce.number().int().optional(),
});

export default router;
