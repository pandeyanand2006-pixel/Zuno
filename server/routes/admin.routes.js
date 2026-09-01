import { Router } from 'express';
import { db } from '../config/db.js';
import { ok } from '../utils/response.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { slugify } from '../utils/id.js';

const router = Router();
router.use(authMiddleware, requireRole('ADMIN'));

// Users
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, mobile, role_id, status, created_at FROM users ORDER BY created_at DESC LIMIT 200').all();
  return ok(res, { users });
});
router.post('/users/:id/suspend', (req, res) => {
  db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(req.params.id);
  return ok(res, null, 'Suspended');
});
router.post('/users/:id/activate', (req, res) => {
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(req.params.id);
  return ok(res, null, 'Activated');
});

// Products (CRUD)
const productSchema = z.object({
  name: z.string().min(2), categoryId: z.number().int().positive(),
  price: z.number().int().positive(), mrp: z.number().int().positive(),
  stock: z.number().int().min(0), module: z.string().default('shop'),
  description: z.string().optional(), images: z.array(z.string()).optional(),
});
router.post('/products', validate(productSchema), (req, res) => {
  const slug = slugify(req.validated.name) + '-' + Math.random().toString(36).slice(2, 6);
  const info = db.prepare('INSERT INTO products (seller_id, category_id, name, slug, description, price, mrp, stock, images, module) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(null, req.validated.categoryId, req.validated.name, slug, req.validated.description || '', req.validated.price, req.validated.mrp, req.validated.stock, JSON.stringify(req.validated.images || []), req.validated.module);
  return ok(res, { id: info.lastInsertRowid }, 'Product created', 201);
});
router.put('/products/:id', (req, res) => {
  const d = req.body;
  db.prepare('UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), mrp = COALESCE(?, mrp), stock = COALESCE(?, stock), active = COALESCE(?, active) WHERE id = ?')
    .run(d.name || null, d.price || null, d.mrp || null, d.stock ?? null, d.active ?? null, req.params.id);
  return ok(res, null, 'Product updated');
});
router.delete('/products/:id', (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  return ok(res, null, 'Product deactivated');
});

// Orders
router.get('/orders', (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.status) { clauses.push('status = ?'); params.push(req.query.status); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const orders = db.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT 300`).all(...params);
  return ok(res, { orders });
});
router.post('/orders/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  return ok(res, null, 'Status updated');
});

// Payments
router.get('/payments', (req, res) => {
  const payments = db.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT 300').all();
  return ok(res, { payments });
});

// Analytics
router.get('/analytics', (req, res) => {
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) revenue, COUNT(*) count FROM orders WHERE status IN ('PAID','CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')").get();
  const users = db.prepare('SELECT COUNT(*) count FROM users').get();
  const ordersToday = db.prepare("SELECT COUNT(*) count FROM orders WHERE created_at >= datetime('now','-1 day')").get();
  const aov = db.prepare("SELECT COALESCE(AVG(total),0) aov FROM orders WHERE status IN ('PAID','CONFIRMED','DELIVERED')").get();
  const byModule = db.prepare('SELECT module, COUNT(*) count, COALESCE(SUM(total),0) revenue FROM orders GROUP BY module').all();
  return ok(res, { revenue: revenue.revenue, totalOrders: revenue.count, users: users.count, ordersToday: ordersToday.count, averageOrderValue: Math.round(aov.aov), byModule });
});

export default router;
