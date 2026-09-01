import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const hasRealKeys = Boolean(env.razorpay.keyId && env.razorpay.keySecret);

export const razorpay = hasRealKeys
  ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  : null;

export const isTestMode = !hasRealKeys;

if (isTestMode) {
  logger.warn('Razorpay running in TEST MODE (no real keys). Payments are simulated with a dev HMAC. Do NOT use in production.');
}

function testSecret() {
  return env.jwtSecret || 'dev-insecure-secret-change-me';
}

export async function createRazorpayOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
  if (razorpay) {
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt: String(receipt),
      notes,
    });
    return { id: order.id, amount: order.amount, currency: order.currency, status: order.status, testMode: false };
  }
  // Test mode: produce realistic-looking order id + payment id and sign them
  // exactly like Razorpay does (order_id|payment_id) so the verify step is real.
  const id = 'order_' + crypto.randomBytes(12).toString('hex');
  const paymentId = 'pay_' + crypto.randomBytes(12).toString('hex');
  const signature = crypto.createHmac('sha256', testSecret()).update(`${id}|${paymentId}`).digest('hex');
  return { id, paymentId, signature, amount: amountPaise, currency, status: 'created', testMode: true };
}

export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (razorpay) {
    const expected = crypto.createHmac('sha256', env.razorpay.keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    return expected === razorpaySignature;
  }
  // Test mode: recompute HMAC(order_id|payment_id) and compare.
  const expected = crypto.createHmac('sha256', testSecret()).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  return expected === razorpaySignature;
}

export async function refundPayment({ paymentId, amountPaise, notes = {} }) {
  if (razorpay) {
    const refund = await razorpay.payments.refund(paymentId, { amount: amountPaise, notes });
    return refund;
  }
  return { id: 'refund_' + crypto.randomBytes(8).toString('hex'), status: 'processed', testMode: true };
}
