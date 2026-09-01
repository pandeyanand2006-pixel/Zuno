import { db } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { generateOrderNumber } from '../utils/id.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { Router } from 'express';
import { createRazorpayOrder, verifyPaymentSignature, isTestMode } from '../integrations/razorpay/index.js';
import { logger } from '../utils/logger.js';

export const serviceService = {
  list({ city, category, search, page = 1, limit = 20 } = {}) {
    const clauses = ['sp.active = 1'];
    const params = [];
    if (city) { clauses.push('sp.city = ?'); params.push(city); }
    if (category) { clauses.push('sp.category = ?'); params.push(category); }
    if (search) { clauses.push('(sp.name LIKE ? OR s.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = clauses.join(' AND ');
    const rows = db.prepare(`SELECT sp.*, (SELECT COUNT(*) FROM services s WHERE s.provider_id = sp.id AND s.active=1) as service_count FROM service_providers sp WHERE ${where} ORDER BY sp.rating DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), (Number(page)-1)*Number(limit));
    return { items: rows, page: Number(page), limit: Number(limit) };
  },
  get(slug) {
    const sp = db.prepare('SELECT * FROM service_providers WHERE slug = ? AND active = 1').get(slug);
    if (!sp) return null;
    sp.services = db.prepare('SELECT * FROM services WHERE provider_id = ? AND active = 1').all(sp.id);
    return sp;
  },
};

const router = Router();

router.get('/providers', (req, res) => ok(res, serviceService.list({ city: req.query.city, category: req.query.category, search: req.query.search })));
router.get('/providers/:slug', (req, res) => {
  const sp = serviceService.get(req.params.slug);
  if (!sp) return fail(res, 'Provider not found', 404);
  return ok(res, { provider: sp });
});

const bookingSchema = z.object({
  serviceId: z.number().int().positive(),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  addressId: z.number().int().positive(),
});

router.post('/bookings', authMiddleware, validate(bookingSchema), (req, res) => {
  const svc = db.prepare('SELECT s.*, sp.id as provider_id FROM services s JOIN service_providers sp ON sp.id = s.provider_id WHERE s.id = ? AND s.active = 1').get(req.validated.serviceId);
  if (!svc) return fail(res, 'Service not found', 404);
  const addr = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.validated.addressId, req.user.id);
  if (!addr) return fail(res, 'Address required', 400, 'ADDRESS_REQUIRED');
  const bookingNumber = generateOrderNumber('ZNS');
  const info = db.prepare('INSERT INTO bookings (booking_number, user_id, service_id, provider_id, status, scheduled_date, scheduled_time, address_id, price) VALUES (?, ?, ?, ?, \'PAYMENT_PENDING\', ?, ?, ?, ?)')
    .run(bookingNumber, req.user.id, svc.id, svc.provider_id, req.validated.scheduledDate, req.validated.scheduledTime, req.validated.addressId, svc.price);
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
  return ok(res, { booking }, 'Booking created', 201);
});

router.get('/bookings', authMiddleware, (req, res) => {
  const bookings = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  return ok(res, { bookings });
});

router.post('/bookings/:id/cancel', authMiddleware, (req, res) => {
  db.prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  return ok(res, null, 'Booking cancelled');
});

// Booking payment — uses the same verified Razorpay flow
router.post('/bookings/:id/pay', authMiddleware, async (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!booking) return fail(res, 'Booking not found', 404);
    if (booking.status !== 'PAYMENT_PENDING') return fail(res, 'Booking not awaiting payment', 409);
    const rzp = await createRazorpayOrder({ amountPaise: booking.price, currency: 'INR', receipt: booking.booking_number });
    const info = db.prepare('INSERT INTO payments (order_id, user_id, razorpay_order_id, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(null, req.user.id, rzp.id, booking.price, 'INR', 'created');
    return ok(res, { paymentId: info.lastInsertRowid, razorpay: { key: process.env.RAZORPAY_KEY_ID || (isTestMode ? 'rzp_test_demo' : ''), orderId: rzp.id, paymentId: rzp.paymentId, signature: rzp.signature, amount: rzp.amount, currency: rzp.currency, testMode: rzp.testMode } });
  } catch (err) { logger.error('booking.pay', err); return fail(res, 'Could not initiate payment', 500); }
});

router.post('/bookings/:id/verify', authMiddleware, validate(z.object({ razorpayOrderId: z.string(), razorpayPaymentId: z.string(), razorpaySignature: z.string() })), (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.validated;
    const payment = db.prepare('SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ?').get(razorpayOrderId, req.user.id);
    if (!payment) return fail(res, 'Payment not found', 404);
    if (payment.verified) return ok(res, { alreadyVerified: true }, 'Already verified');
    if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) return fail(res, 'Payment verification failed', 400, 'SIGNATURE_MISMATCH');
    db.prepare("UPDATE payments SET status = 'captured', verified = 1 WHERE id = ?").run(payment.id);
    db.prepare("UPDATE bookings SET status = 'PAID' WHERE id = ?").run(req.params.id);
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'booking', 'Booking confirmed', ?)").run(b.user_id, `Booking ${b.booking_number} is confirmed`);
    return ok(res, { booking: b, verified: true }, 'Payment successful');
  } catch (err) { logger.error('booking.verify', err); return fail(res, 'Verification error', 500); }
});

export default router;
