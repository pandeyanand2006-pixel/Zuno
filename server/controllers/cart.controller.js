import { cartService } from '../services/cart.service.js';
import { ok, fail } from '../utils/response.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';

const addSchema = z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(20).optional() });
const qtySchema = z.object({ quantity: z.number().int().min(0).max(20) });

function mod(req) { return req.query.module || 'shop'; }

export async function viewCart(req, res) {
  return ok(res, { cart: await cartService.view(req.user.id, mod(req)) });
}
export async function summary(req, res) {
  return ok(res, await cartService.summary(req.user.id));
}
export async function addItem(req, res) {
  try {
    const cart = await cartService.add(req.user.id, mod(req), req.validated.productId, req.validated.quantity || 1, req.validated.variant || null);
    return ok(res, { cart }, 'Added to cart');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'Product not found', 404);
    if (err.message === 'VARIANT_NOT_FOUND') return fail(res, 'Selected variant not available', 404);
    if (err.message === 'OUT_OF_STOCK') return fail(res, 'Not enough stock', 409, 'OUT_OF_STOCK');
    return fail(res, 'Could not add to cart', 400);
  }
}
export async function updateItem(req, res) {
  const cart = await cartService.updateQty(req.user.id, mod(req), req.params.productId, req.validated.quantity);
  return ok(res, { cart });
}
export async function removeItem(req, res) {
  const cart = await cartService.remove(req.user.id, mod(req), req.params.productId);
  return ok(res, { cart });
}
export async function clearCart(req, res) {
  const cart = await cartService.clear(req.user.id, mod(req));
  return ok(res, { cart });
}
export async function addCustom(req, res) {
  try {
    const { productId, color, size, fit, designData, quantity = 1 } = req.validated;
    const variantData = JSON.stringify({ color, size, fit });
    const customizationData = JSON.stringify(designData);
    const cart = await cartService.addCustom(req.user.id, mod(req), productId, quantity, customizationData, variantData, null);
    return ok(res, { cart }, 'Custom design added to cart');
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'Product not found', 404);
    return fail(res, 'Could not add custom to cart', 400);
  }
}
