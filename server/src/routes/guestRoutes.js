import { Router } from 'express';
import { z } from 'zod';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate, authorize('owner', 'manager', 'front_desk'));

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [];
  let where = '';
  if (q) {
    where = 'WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR company_name LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, nationality, is_vip, is_blacklisted, company_name, created_at
     FROM guests ${where} ORDER BY created_at DESC LIMIT 80`,
    params
  );
  res.json({ success: true, data: rows });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const [guests] = await pool.query('SELECT * FROM guests WHERE id = ?', [req.params.id]);
  if (!guests[0]) throw new HttpError(404, 'Guest not found.');
  const [stays] = await pool.query(
    `SELECT id, booking_ref, status, check_in, check_out, total_amount, paid_amount, source
     FROM reservations WHERE guest_id = ? ORDER BY check_in DESC`,
    [req.params.id]
  );
  const spend = stays
    .filter((stay) => !['cancelled', 'inquiry'].includes(stay.status))
    .reduce((sum, stay) => sum + Number(stay.total_amount), 0);
  res.json({ success: true, data: { ...guests[0], stays, spend } });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    email: z.string().trim().email(),
    phone: z.string().trim().min(6).max(40),
    nationality: z.string().max(80).optional().or(z.literal('')),
    id_type: z.string().max(40).optional().or(z.literal('')),
    id_number: z.string().max(80).optional().or(z.literal('')),
    notes: z.string().max(1000).optional().or(z.literal('')),
    company_name: z.string().max(160).optional().or(z.literal('')),
    is_vip: z.boolean().optional(),
    is_blacklisted: z.boolean().optional(),
    blacklist_reason: z.string().max(255).optional().or(z.literal('')),
  }).parse(req.body || {});
  const [existing] = await pool.query('SELECT id FROM guests WHERE id = ?', [req.params.id]);
  if (!existing[0]) throw new HttpError(404, 'Guest not found.');
  await pool.query(
    `UPDATE guests SET first_name=?, last_name=?, email=?, phone=?, nationality=?, id_type=?, id_number=?,
      notes=?, company_name=?, is_vip=?, is_blacklisted=?, blacklist_reason=? WHERE id=?`,
    [
      body.first_name, body.last_name, body.email.toLowerCase(), body.phone, body.nationality || null,
      body.id_type || null, body.id_number || null, body.notes || null, body.company_name || null,
      body.is_vip ? 1 : 0, body.is_blacklisted ? 1 : 0, body.is_blacklisted ? (body.blacklist_reason || null) : null,
      req.params.id,
    ]
  );
  res.json({ success: true });
}));

export default router;
