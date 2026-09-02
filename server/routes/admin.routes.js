import { Router } from 'express';
import { db } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { slugify } from '../utils/id.js';
import { orderService } from '../services/order.service.js';

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

// Products (Clothing CRUD)
const productSchema = z.object({
  name: z.string().min(2), categoryId: z.number().int().positive(),
  price: z.number().int().positive(), mrp: z.number().int().positive(),
  stock: z.number().int().min(0), module: z.string().default('shop'),
  description: z.string().optional(), images: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(), sizes: z.array(z.string()).optional(),
  fit: z.string().optional(), fabric: z.string().optional(), collection: z.string().optional(),
  customizable: z.boolean().optional(), featured: z.boolean().optional(), newArrival: z.boolean().optional(),
});
router.post('/products', validate(productSchema), (req, res) => {
  const slug = slugify(req.validated.name) + '-' + Math.random().toString(36).slice(2, 6);
  const v = req.validated;
  const info = db.prepare('INSERT INTO products (seller_id, category_id, name, slug, description, price, mrp, stock, images, module, colors, sizes, fit, fabric, collection, customizable, featured, new_arrival, care_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(null, v.categoryId, v.name, slug, v.description || '', v.price, v.mrp, v.stock, JSON.stringify(v.images || []), v.module, JSON.stringify(v.colors || []), JSON.stringify(v.sizes || []), v.fit || null, v.fabric || null, v.collection || null, v.customizable ? 1 : 0, v.featured ? 1 : 0, v.newArrival ? 1 : 0, 'Machine wash cold');
  // Create variants for each color/size
  if (v.colors && v.sizes) {
    const varIns = db.prepare('INSERT INTO product_variants (product_id, sku, color, size, stock, price) VALUES (?, ?, ?, ?, ?, ?)');
    for (const color of v.colors) for (const size of v.sizes) {
      const sku = `Zuno-${info.lastInsertRowid}-${color.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${size}`;
      try { varIns.run(info.lastInsertRowid, sku, color, size, Math.floor(v.stock / (v.colors.length * v.sizes.length)) + 5, v.price); } catch {}
    }
  }
  return ok(res, { id: info.lastInsertRowid }, 'Product created', 201);
});
router.put('/products/:id', (req, res) => {
  const d = req.body;
  db.prepare('UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), mrp = COALESCE(?, mrp), stock = COALESCE(?, stock), active = COALESCE(?, active), colors = COALESCE(?, colors), sizes = COALESCE(?, sizes), fit = COALESCE(?, fit), fabric = COALESCE(?, fabric), collection = COALESCE(?, collection) WHERE id = ?')
    .run(d.name || null, d.price || null, d.mrp || null, d.stock ?? null, d.active ?? null, d.colors ? JSON.stringify(d.colors) : null, d.sizes ? JSON.stringify(d.sizes) : null, d.fit || null, d.fabric || null, d.collection || null, req.params.id);
  return ok(res, null, 'Product updated');
});
router.delete('/products/:id', (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  return ok(res, null, 'Product deactivated');
});

// Custom orders (orders containing custom designs)
router.get('/custom-orders', (req, res) => {
  const orders = db.prepare(`
    SELECT DISTINCT o.* FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.customization_data IS NOT NULL
    ORDER BY o.created_at DESC LIMIT 100
  `).all();
  const enriched = orders.map((o) => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id).map((it) => ({
      ...it, customization: it.customization_data ? JSON.parse(it.customization_data) : null, variant: it.variant_data ? JSON.parse(it.variant_data) : null
    }));
    return { ...o, items };
  });
  return ok(res, { orders: enriched });
});

// Orders
router.get('/orders', (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.status) { clauses.push('o.status = ?'); params.push(req.query.status); }
  if (req.query.q) {
    clauses.push('(o.order_number LIKE ? OR u.name LIKE ? OR u.mobile LIKE ? OR u.email LIKE ?)');
    const q = `%${req.query.q}%`;
    params.push(q, q, q, q);
  }
  if (req.query.custom === '1') clauses.push('EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.customization_data IS NOT NULL)');
  if (req.query.custom === '0') clauses.push('NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.customization_data IS NOT NULL)');
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const orders = db.prepare(`
    SELECT o.*, u.name as customer_name, u.mobile as customer_mobile, u.email as customer_email
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    ${where} ORDER BY o.created_at DESC LIMIT 300
  `).all(...params);
  return ok(res, { orders });
});
router.post('/orders/:id/status', (req, res) => {
  const { status, note } = req.body;
  const allowed = ['PAYMENT_PENDING','PAID','CONFIRMED','PROCESSING','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
  if (!allowed.includes(status)) return fail(res, 'Invalid status', 400);
  try {
    orderService.updateStatus(Number(req.params.id), status, req.user.id, note || null);
    return ok(res, null, 'Status updated');
  } catch (e) { return fail(res, e.message, 400); }
});
router.get('/orders/:id/history', (req, res) => {
  const history = db.prepare('SELECT h.*, u.name as changed_by_name FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.created_at ASC').all(req.params.id);
  return ok(res, { history });
});
router.post('/orders/:id/notes', (req, res) => {
  const { note } = req.body;
  if (!note || !note.trim()) return fail(res, 'Note required', 400);
  orderService.addAdminNote(Number(req.params.id), note.trim(), req.user.id);
  return ok(res, null, 'Note added');
});
router.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return fail(res, 'Not found', 404);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id).map(it => ({ ...it, customization: it.customization_data ? JSON.parse(it.customization_data) : null, variant: it.variant_data ? JSON.parse(it.variant_data) : null }));
  const history = db.prepare('SELECT h.*, u.name as changed_by_name FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.created_at ASC').all(req.params.id);
  const customer = db.prepare('SELECT id, name, email, mobile FROM users WHERE id = ?').get(order.user_id);
  const address = db.prepare('SELECT * FROM addresses WHERE id = ?').get(order.address_id);
  return ok(res, { order: { ...order, items, history, customer, address } });
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
