import { Router } from 'express';
import { db } from '../config/db.js';
import { ok } from '../utils/response.js';
import { couponService } from '../services/order.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', (req, res) => {
  const coupons = db.prepare("SELECT code, type, value, min_order, max_discount, module, expires_at FROM coupons WHERE active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))").all();
  return ok(res, { coupons });
});

router.post('/validate', authMiddleware, validate(z.object({ code: z.string(), module: z.string(), subtotal: z.number().int().positive() })), (req, res) => {
  const result = couponService.validate(req.validated.code, req.validated.module, req.validated.subtotal, req.user.id);
  if (!result.valid) return ok(res, { valid: false, message: result.message });
  return ok(res, { valid: true, discount: result.discount });
});

export default router;
