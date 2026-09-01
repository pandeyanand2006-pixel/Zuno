import { Router } from 'express';
import * as ctrl from '../controllers/cart.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);
const addSchema = z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(20).optional() });
const qtySchema = z.object({ quantity: z.number().int().min(0).max(20) });

router.get('/', ctrl.viewCart);
router.get('/summary', ctrl.summary);
router.post('/items', validate(addSchema), ctrl.addItem);
router.put('/items/:productId', validate(qtySchema), ctrl.updateItem);
router.delete('/items/:productId', ctrl.removeItem);
router.delete('/', ctrl.clearCart);

export default router;
