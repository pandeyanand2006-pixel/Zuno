import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { ok } from '../utils/response.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { Router } from 'express';
function useMongo(){ return !!env.mongoUri && isMongoConnected(); }

const router = Router();
router.use(authMiddleware);

const addSchema = z.object({ productId: z.union([z.number().int().positive(), z.string().min(1)]) });

export async function list(req, res) {
  if (useMongo()) {
    const { Wishlist, Product } = await import('../models/index.js');
    const rows = await Wishlist.find({ user_id: req.user.id }).sort({ created_at: -1 }).lean();
    const items = [];
    for (const w of rows) {
      const p = await Product.findById(w.product_id).lean();
      if (!p) continue;
      items.push({ id: String(w._id), productId: String(w.product_id), name: p.name, slug: p.slug, price: p.price, mrp: p.mrp, image: Array.isArray(p.images)? p.images[0]||null : null, module: p.module });
    }
    return ok(res, { items });
  }
  const rows = db
    .prepare('SELECT w.*, p.name, p.slug, p.price, p.mrp, p.images, p.module FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? ORDER BY w.created_at DESC')
    .all(req.user.id);
  const items = rows.map((r) => ({
    id: r.id, productId: r.product_id, name: r.name, slug: r.slug, price: r.price, mrp: r.mrp,
    image: r.images ? JSON.parse(r.images)[0] || null : null, module: r.module,
  }));
  return ok(res, { items });
}

export async function add(req, res) {
  const { productId } = req.validated;
  if (useMongo()) {
    const { Wishlist } = await import('../models/index.js');
    await Wishlist.updateOne({ user_id: req.user.id, product_id: productId }, { user_id: req.user.id, product_id: productId }, { upsert: true });
    return ok(res, null, 'Saved to wishlist', 201);
  }
  db.prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)').run(req.user.id, productId);
  return ok(res, null, 'Saved to wishlist', 201);
}

export async function remove(req, res) {
  if (useMongo()) {
    const { Wishlist } = await import('../models/index.js');
    await Wishlist.deleteOne({ user_id: req.user.id, product_id: req.params.productId });
    return ok(res, null, 'Removed from wishlist');
  }
  db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  return ok(res, null, 'Removed from wishlist');
}

router.get('/', list);
router.post('/', validate(addSchema), add);
router.delete('/:productId', remove);

export default router;
