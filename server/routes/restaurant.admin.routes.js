import { Router } from 'express';
import {
  listMenu, createMenuItem, updateMenuItem, deleteMenuItem, restaurantOrders,
} from '../controllers/partner.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { menuItemSchema, menuItemUpdateSchema } from '../validators/partner.validators.js';

const router = Router();
router.use(authMiddleware, requireRole('RESTAURANT'));

router.get('/menu', listMenu);
router.post('/menu', validate(menuItemSchema), createMenuItem);
router.put('/menu/:id', validate(menuItemUpdateSchema), updateMenuItem);
router.delete('/menu/:id', deleteMenuItem);
router.get('/orders', restaurantOrders);

export default router;
