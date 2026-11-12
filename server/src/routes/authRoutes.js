import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../config/database.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const body = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }).parse(req.body || {});
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [body.email.trim().toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    },
  });
}));

router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Account is inactive.');
  res.json({ success: true, data: rows[0] });
}));

export default router;
