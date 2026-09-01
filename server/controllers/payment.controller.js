import crypto from 'node:crypto';
import { orderService } from '../services/order.service.js';
import { createRazorpayOrder, verifyPaymentSignature, refundPayment, isTestMode } from '../integrations/razorpay/index.js';
import { db } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';

const verifySchema = z.object({
  orderId: z.number().int().positive(),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

// Step A: create a Razorpay order for an existing pending order
export async function createPayment(req, res) {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.body.orderId, req.user.id);
    if (!order) return fail(res, 'Order not found', 404);
    if (order.status !== 'PAYMENT_PENDING' && order.status !== 'CREATED') return fail(res, 'Order is not awaiting payment', 409);

    const rzp = await createRazorpayOrder({ amountPaise: order.total, currency: 'INR', receipt: order.order_number });

    let payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND status = ?').get(order.id, 'created');
    if (!payment) {
      const info = db
        .prepare('INSERT INTO payments (order_id, user_id, razorpay_order_id, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?)')
        .run(order.id, req.user.id, rzp.id, order.total, 'INR', 'created');
      payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
    } else {
      db.prepare('UPDATE payments SET razorpay_order_id = ?, amount = ? WHERE id = ?').run(rzp.id, order.total, payment.id);
    }

    return ok(res, {
      razorpay: {
        key: process.env.RAZORPAY_KEY_ID || (isTestMode ? 'rzp_test_demo' : ''),
        orderId: rzp.id,
        paymentId: rzp.paymentId,
        signature: rzp.signature,
        amount: rzp.amount,
        currency: rzp.currency,
        testMode: rzp.testMode,
      },
      paymentId: payment.id,
      testMode: rzp.testMode,
    });
  } catch (err) {
    logger.error('createPayment', err);
    return fail(res, 'Could not initiate payment', 500);
  }
}

// Step B: verify signature and confirm order (NEVER trust client success)
export async function verifyPayment(req, res) {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.validated;
    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND razorpay_order_id = ?').get(orderId, razorpayOrderId);
    if (!payment) return fail(res, 'Payment record not found', 404);

    // Idempotency: already verified
    if (payment.verified) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      return ok(res, { order, alreadyVerified: true }, 'Payment already verified');
    }

    const valid = verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    if (!valid) {
      db.prepare("UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(payment.id);
      logger.warn('payment.verify.failed', { orderId, razorpayOrderId });
      return fail(res, 'Payment verification failed', 400, 'SIGNATURE_MISMATCH');
    }

    const order = orderService.markPaid(orderId, payment.id);
    // clear cart for this module
    const module = order.module;
    const cart = db.prepare('SELECT id FROM carts WHERE user_id = ? AND module = ?').get(req.user.id, module);
    if (cart) db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);

    return ok(res, { order, verified: true }, 'Payment successful');
  } catch (err) {
    logger.error('verifyPayment', err);
    return fail(res, 'Payment verification error', 500);
  }
}

// Webhook (Razorpay) — verify signature, then update state
export async function webhook(req, res) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    if (secret && signature) {
      const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
      if (expected !== signature) return res.status(400).send('invalid');
    }
    const event = req.body && req.body.event;
    logger.audit('razorpay.webhook', { event });
    if (event === 'payment.captured') {
      const rzpOrderId = req.body.payload?.payment?.entity?.order_id;
      const payment = db.prepare('SELECT * FROM payments WHERE razorpay_order_id = ?').get(rzpOrderId);
      if (payment && !payment.verified) orderService.markPaid(payment.order_id, payment.id);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error('webhook', err);
    return res.status(200).json({ received: true });
  }
}

export async function refund(req, res) {
  try {
    const { paymentId, amount } = req.body;
    const result = await refundPayment({ paymentId, amountPaise: amount });
    db.prepare("INSERT INTO refunds (payment_id, order_id, amount, status, reason) VALUES (?, ?, ?, 'processed', ?)")
      .run(paymentId, req.body.orderId, amount, req.body.reason || 'requested');
    return ok(res, { refund: result }, 'Refund initiated');
  } catch (err) {
    return fail(res, 'Refund failed', 500);
  }
}
