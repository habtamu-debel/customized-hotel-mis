import { Router } from 'express';
import { z } from 'zod';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getSettings() });
}));

router.put('/', authorize('owner', 'manager'), asyncHandler(async (req, res) => {
  const body = z.object({
    hotel_name: z.string().min(2).max(120),
    tagline: z.string().max(180),
    address: z.string().max(180),
    city: z.string().max(80),
    phone: z.string().max(40),
    email: z.string().email(),
    tin: z.string().max(40),
    description: z.string().max(500),
    check_in_time: z.string().max(10),
    check_out_time: z.string().max(10),
    currency: z.string().max(8),
    vat_rate: z.coerce.number().min(0).max(40),
    service_charge_rate: z.coerce.number().min(0).max(40),
    weekend_percent: z.coerce.number().min(0).max(100),
    cancel_hours: z.coerce.number().int().min(0).max(240),
    cancellation_policy: z.string().max(500),
    about: z.string().max(1000),
  }).parse(req.body || {});
  for (const [key, value] of Object.entries(body)) {
    await pool.query(
      'INSERT INTO settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)',
      [key, String(value)]
    );
  }
  res.json({ success: true, data: await getSettings() });
}));

router.get('/messages', authorize('owner', 'manager', 'front_desk'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 50');
  res.json({ success: true, data: rows });
}));

router.post('/messages/:id/read', authorize('owner', 'manager', 'front_desk'), asyncHandler(async (req, res) => {
  await pool.query('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

export default router;
