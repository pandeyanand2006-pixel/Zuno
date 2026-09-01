import { cartService } from '../services/cart.service.js';
import { ok, fail } from '../utils/response.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';

const addSchema = z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(20).optional() });
const qtySchema = z.object({ quantity: z.number().int().min(0).max(20) });

function mod(req) { return req.query.module || 'shop'; }

export function viewCart(req, res) {
  return ok(res, { cart: cartService.view(req.user.id, mod(req)) });
}
export function summary(req, res) {
  return ok(res, cartService.summary(req.user.id));
}
export function addItem(req, res) {
  try {
    const cart = cartService.add(req.user.id, mod(req), req.validated.productId, req.validated.quantity || 1, req.validated.variant || null);
    return ok(res, { cart }, 'Added to cart');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'Product not found', 404);
    if (err.message === 'VARIANT_NOT_FOUND') return fail(res, 'Selected variant not available', 404);
    if (err.message === 'OUT_OF_STOCK') return fail(res, 'Not enough stock', 409, 'OUT_OF_STOCK');
    return fail(res, 'Could not add to cart', 400);
  }
}
export function updateItem(req, res) {
  const cart = cartService.updateQty(req.user.id, mod(req), Number(req.params.productId), req.validated.quantity);
  return ok(res, { cart });
}
export function removeItem(req, res) {
  const cart = cartService.remove(req.user.id, mod(req), Number(req.params.productId));
  return ok(res, { cart });
}
export function clearCart(req, res) {
  const cart = cartService.clear(req.user.id, mod(req));
  return ok(res, { cart });
}
export function addCustom(req, res) {
  try {
    const { productId, color, size, fit, designData, quantity = 1 } = req.validated;
    const variantData = JSON.stringify({ color, size, fit });
    const customizationData = JSON.stringify(designData);
    const cart = cartService.addCustom(req.user.id, mod(req), productId, quantity, customizationData, variantData, null);
    return ok(res, { cart }, 'Custom design added to cart');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'Product not found', 404);
    return fail(res, 'Could not add custom to cart', 400);
  }
}
