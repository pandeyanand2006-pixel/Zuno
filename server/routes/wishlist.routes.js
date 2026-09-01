import { db } from '../config/db.js';
import { ok } from '../utils/response.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { Router } from 'express';

const router = Router();
router.use(authMiddleware);

const addSchema = z.object({ productId: z.number().int().positive() });

export function list(req, res) {
  const rows = db
    .prepare('SELECT w.*, p.name, p.slug, p.price, p.mrp, p.images, p.module FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? ORDER BY w.created_at DESC')
    .all(req.user.id);
  const items = rows.map((r) => ({
    id: r.id, productId: r.product_id, name: r.name, slug: r.slug, price: r.price, mrp: r.mrp,
    image: r.images ? JSON.parse(r.images)[0] || null : null, module: r.module,
  }));
  return ok(res, { items });
}

export function add(req, res) {
  const { productId } = req.validated;
  db.prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)').run(req.user.id, productId);
  return ok(res, null, 'Saved to wishlist', 201);
}

export function remove(req, res) {
  db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(req.user.id, Number(req.params.productId));
  return ok(res, null, 'Removed from wishlist');
}

router.get('/', list);
router.post('/', validate(addSchema), add);
router.delete('/:productId', remove);

export default router;
