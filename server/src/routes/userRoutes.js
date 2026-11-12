import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../lib/http.js';

const router = Router();
router.use(authenticate, authorize('owner'));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name');
  res.json({ success: true, data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    password: z.string().min(8, 'Use at least 8 characters.'),
    role: z.enum(['owner', 'manager', 'front_desk', 'housekeeping']),
  }).parse(req.body || {});
  const hash = await bcrypt.hash(body.password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
    [body.name, body.email.toLowerCase(), hash, body.role]
  );
  res.status(201).json({ success: true, data: { id: result.insertId } });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(120),
    role: z.enum(['owner', 'manager', 'front_desk', 'housekeeping']),
    is_active: z.boolean(),
    password: z.string().min(8).optional().or(z.literal('')),
  }).parse(req.body || {});
  if (Number(req.params.id) === Number(req.user.id) && !body.is_active) {
    throw new HttpError(400, 'You cannot deactivate your own account.');
  }
  await pool.query('UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?', [
    body.name, body.role, body.is_active ? 1 : 0, req.params.id,
  ]);
  if (body.password) {
    const hash = await bcrypt.hash(body.password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
  }
  res.json({ success: true });
}));

export default router;
