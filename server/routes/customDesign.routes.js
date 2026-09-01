import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { customDesignSchema, customDesignUpdateSchema } from '../validators/custom.validators.js';
import * as ctrl from '../controllers/customDesign.controller.js';
import { db } from '../config/db.js';
import { ok, notFound } from '../utils/response.js';
import { cartService } from '../services/cart.service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.listDesigns);
router.post('/', validate(customDesignSchema), ctrl.createDesign);
router.get('/:id', ctrl.getDesign);
router.put('/:id', validate(customDesignUpdateSchema), ctrl.updateDesign);
router.delete('/:id', ctrl.deleteDesign);

// Add a custom design directly to cart
router.post('/:id/cart', async (req, res) => {
  const row = db.prepare('SELECT * FROM custom_designs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return notFound(res, 'Design not found');
  const quantity = Math.max(1, Math.min(10, Number(req.body.quantity) || 1));
  const productId = row.product_id ? Number(row.product_id) : db.prepare('SELECT id FROM products WHERE customizable = 1 LIMIT 1').get()?.id;
  if (!productId) return notFound(res, 'No customizable product available');
  const designData = JSON.parse(row.design_data);
  const variantData = { color: row.color, size: row.size, fit: row.fit };
  const product = db.prepare('SELECT price FROM products WHERE id = ?').get(productId);
  let customPrice = product.price;
  if (designData.front?.elements?.length) customPrice += 10000;
  if (designData.back?.elements?.length) customPrice += 10000;
  const cart = cartService.addCustom(req.user.id, 'shop', productId, quantity, row.design_data, JSON.stringify(variantData), customPrice);
  return ok(res, cart);
});

export default router;
