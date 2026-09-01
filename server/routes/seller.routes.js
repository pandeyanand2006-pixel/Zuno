import { Router } from 'express';
import {
  listSellerProducts, createSellerProduct, updateSellerProduct, deactivateSellerProduct,
  sellerOrders, sellerAnalytics,
} from '../controllers/partner.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { sellerProductSchema, sellerProductUpdateSchema } from '../validators/partner.validators.js';

const router = Router();
router.use(authMiddleware, requireRole('SELLER'));

router.get('/products', listSellerProducts);
router.post('/products', validate(sellerProductSchema), createSellerProduct);
router.put('/products/:id', validate(sellerProductUpdateSchema), updateSellerProduct);
router.delete('/products/:id', deactivateSellerProduct);
router.get('/orders', sellerOrders);
router.get('/analytics', sellerAnalytics);

export default router;
