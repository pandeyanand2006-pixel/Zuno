import { Router } from 'express';
import * as ctrl from '../controllers/cart.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);
const addSchema = z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(20).optional(), variant: z.object({ color: z.string().optional(), size: z.string().optional() }).optional() });
const qtySchema = z.object({ quantity: z.number().int().min(0).max(20) });
const elementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'image']),
  x: z.number(), y: z.number(),
  scale: z.number().min(0.1).max(5).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  value: z.string().optional(), fontFamily: z.string().optional(), fontSize: z.number().optional(), color: z.string().optional(), bold: z.boolean().optional(), italic: z.boolean().optional(), align: z.string().optional(),
  url: z.string().optional(), width: z.number().optional(), height: z.number().optional(),
});
const customCartSchema = z.object({
  productId: z.number().int().positive(),
  color: z.string().min(1).max(30),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']),
  fit: z.enum(['regular', 'oversized', 'relaxed']).optional(),
  designData: z.object({ front: z.object({ elements: z.array(elementSchema).max(20) }), back: z.object({ elements: z.array(elementSchema).max(20) }) }),
  quantity: z.number().int().min(1).max(10).optional(),
});

router.get('/', ctrl.viewCart);
router.get('/summary', ctrl.summary);
router.post('/items', validate(addSchema), ctrl.addItem);
router.post('/custom', validate(customCartSchema), ctrl.addCustom);
router.put('/items/:productId', validate(qtySchema), ctrl.updateItem);
router.delete('/items/:productId', ctrl.removeItem);
router.delete('/', ctrl.clearCart);

export default router;
