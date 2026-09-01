import { orderService } from '../services/order.service.js';
import { cartService } from '../services/cart.service.js';
import { db } from '../config/db.js';
import { ok, fail, notFound } from '../utils/response.js';
import { createRazorpayOrder, verifyPaymentSignature, isTestMode } from '../integrations/razorpay/index.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';

const createSchema = z.object({
  module: z.enum(['shop', 'grocery', 'food']).default('shop'),
  addressId: z.number().int().positive(),
  couponCode: z.string().optional(),
});

export function createOrder(req, res) {
  try {
    const { module, addressId, couponCode } = req.validated;
    const cart = cartService.view(req.user.id, module);
    if (!cart.items.length) return fail(res, 'Your cart is empty', 400, 'EMPTY_CART');

    const created = orderService.createFromCart({
      userId: req.user.id, module, addressId, couponCode,
      items: cart.items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, lineTotal: i.lineTotal })),
    });
    return ok(res, created, 'Order created', 201);
  } catch (err) {
    if (err.message === 'EMPTY_CART') return fail(res, 'Your cart is empty', 400, 'EMPTY_CART');
    if (err.message === 'ADDRESS_REQUIRED') return fail(res, 'Please select a delivery address', 400, 'ADDRESS_REQUIRED');
    if (err.message === 'INVALID_COUPON') return fail(res, 'Coupon is not valid for this order', 422, 'INVALID_COUPON');
    return fail(res, 'Could not create order', 400);
  }
}

export function listOrders(req, res) {
  const orders = orderService.getForUser(req.user.id, { status: req.query.status, module: req.query.module });
  return ok(res, { orders });
}

export function getOrder(req, res) {
  const order = orderService.getDetail(req.user.id, Number(req.params.id));
  if (!order) return notFound(res, 'Order not found');
  return ok(res, { order });
}

export function cancelOrder(req, res) {
  try {
    const order = orderService.cancel(req.user.id, Number(req.params.id));
    return ok(res, { order }, 'Order cancelled');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return notFound(res, 'Order not found');
    if (err.message === 'CANNOT_CANCEL') return fail(res, 'This order can no longer be cancelled', 409, 'CANNOT_CANCEL');
    return fail(res, 'Could not cancel', 400);
  }
}

const customSchema = z.object({
  module: z.enum(['shop', 'grocery', 'food']),
  addressId: z.number().int().positive(),
  couponCode: z.string().optional(),
  items: z.array(z.object({ type: z.enum(['product', 'menu']), id: z.number().int().positive(), quantity: z.number().int().min(1).max(20) })).min(1),
});

export function createCustomOrder(req, res) {
  try {
    const created = orderService.createCustom({ userId: req.user.id, ...req.validated });
    return ok(res, created, 'Order created', 201);
  } catch (err) {
    if (err.message === 'EMPTY_CART') return fail(res, 'No items', 400, 'EMPTY_CART');
    if (err.message === 'ADDRESS_REQUIRED') return fail(res, 'Please select a delivery address', 400, 'ADDRESS_REQUIRED');
    if (err.message === 'ITEM_UNAVAILABLE') return fail(res, 'Some items are unavailable', 409, 'ITEM_UNAVAILABLE');
    if (err.message === 'OUT_OF_STOCK') return fail(res, 'Some items are out of stock', 409, 'OUT_OF_STOCK');
    if (err.message === 'INVALID_COUPON') return fail(res, 'Coupon not valid', 422, 'INVALID_COUPON');
    return fail(res, 'Could not create order', 400);
  }
}
