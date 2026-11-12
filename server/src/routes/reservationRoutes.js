import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { nightsBetween } from '../lib/dates.js';
import { HttpError } from '../lib/http.js';
import {
  addCharge,
  addPayment,
  cancelReservation,
  changeDates,
  checkIn,
  checkOut,
  confirmReservation,
  createReservation,
  getReservation,
  listReservations,
  markNoShow,
  moveRoom,
} from '../lib/booking.js';

const router = Router();
const staff = [authenticate, authorize('owner', 'manager', 'front_desk')];
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

router.use(...staff);

router.get('/', asyncHandler(async (req, res) => {
  const data = await listReservations({
    q: req.query.q ? String(req.query.q) : '',
    status: req.query.status ? String(req.query.status) : '',
    from: req.query.from ? String(req.query.from) : '',
    to: req.query.to ? String(req.query.to) : '',
  });
  res.json({ success: true, data });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getReservation(req.params.id) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = z.object({
    check_in: dateString,
    check_out: dateString,
    adults: z.coerce.number().int().min(1).max(16),
    children: z.coerce.number().int().min(0).max(12).default(0),
    rooms: z.array(z.object({
      room_type_id: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().min(1).max(8),
    })).min(1),
    source: z.enum(['website', 'walk_in', 'phone', 'agent', 'ota']).default('walk_in'),
    payment_preference: z.enum(['pay_at_hotel', 'pay_now', 'request']).default('pay_at_hotel'),
    special_requests: z.string().max(500).optional().or(z.literal('')),
    promo_code: z.string().max(40).optional().or(z.literal('')),
    guest_id: z.coerce.number().int().positive().optional(),
    guest: z.object({
      first_name: z.string().trim().min(1).max(80),
      last_name: z.string().trim().min(1).max(80),
      email: z.string().trim().email(),
      phone: z.string().trim().min(6).max(40),
      nationality: z.string().max(80).optional().or(z.literal('')),
      id_type: z.string().max(40).optional().or(z.literal('')),
      id_number: z.string().max(80).optional().or(z.literal('')),
      company_name: z.string().max(160).optional().or(z.literal('')),
    }).optional(),
  }).parse(req.body || {});
  const nights = nightsBetween(input.check_in, input.check_out);
  if (!Number.isFinite(nights) || nights < 1) throw new HttpError(400, 'Check-out must be after check-in.');
  const status = input.payment_preference === 'request' ? 'pending' : 'confirmed';
  const data = await createReservation({ ...input, status }, { userId: req.user.id });
  res.status(201).json({ success: true, data });
}));

router.post('/:id/confirm', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await confirmReservation(req.params.id, req.user.id) });
}));

router.post('/:id/check-in', asyncHandler(async (req, res) => {
  const body = z.object({
    assignments: z.array(z.object({
      reservation_room_id: z.coerce.number().int().positive(),
      room_id: z.coerce.number().int().positive(),
    })).optional(),
  }).parse(req.body || {});
  res.json({ success: true, data: await checkIn(req.params.id, { assignments: body.assignments || [], userId: req.user.id }) });
}));

router.post('/:id/check-out', asyncHandler(async (req, res) => {
  const body = z.object({ force: z.boolean().optional() }).parse(req.body || {});
  res.json({
    success: true,
    data: await checkOut(req.params.id, { userId: req.user.id, force: body.force, role: req.user.role }),
  });
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const body = z.object({ reason: z.string().max(200).optional() }).parse(req.body || {});
  res.json({ success: true, data: await cancelReservation(req.params.id, { userId: req.user.id, reason: body.reason || 'Cancelled by staff' }) });
}));

router.post('/:id/no-show', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await markNoShow(req.params.id, req.user.id) });
}));

router.post('/:id/dates', asyncHandler(async (req, res) => {
  const body = z.object({ check_in: dateString, check_out: dateString }).parse(req.body || {});
  res.json({ success: true, data: await changeDates(req.params.id, { ...body, userId: req.user.id }) });
}));

router.post('/:id/rooms/:lineId/assign', asyncHandler(async (req, res) => {
  const body = z.object({ room_id: z.coerce.number().int().positive() }).parse(req.body || {});
  res.json({ success: true, data: await moveRoom(req.params.id, req.params.lineId, body.room_id, req.user.id) });
}));

router.post('/:id/payments', asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.coerce.number().positive(),
    method: z.enum(['cash', 'card', 'telebirr', 'bank_transfer', 'city_ledger']),
    reference: z.string().max(80).optional().or(z.literal('')),
    note: z.string().max(200).optional().or(z.literal('')),
  }).parse(req.body || {});
  res.status(201).json({ success: true, data: await addPayment(req.params.id, body, req.user.id) });
}));

router.post('/:id/charges', asyncHandler(async (req, res) => {
  const body = z.object({
    description: z.string().trim().min(1).max(200),
    amount: z.coerce.number(),
    quantity: z.coerce.number().int().min(1).max(20).default(1),
    item_type: z.enum(['service', 'minibar', 'laundry', 'restaurant', 'discount', 'fee', 'other']).default('other'),
  }).parse(req.body || {});
  res.status(201).json({ success: true, data: await addCharge(req.params.id, body, req.user.id) });
}));

export default router;
