import { Router } from 'express';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { ok, fail } from '../utils/response.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { slugify } from '../utils/id.js';
import { orderService } from '../services/order.service.js';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

// ── Multer for product images/video ──
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../public/uploads/products');
try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes('video') ? '.mp4' : '.jpg');
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images' && !file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed for images'));
    if (file.fieldname === 'video' && !file.mimetype.startsWith('video/')) return cb(new Error('Only video allowed for video'));
    cb(null, true);
  }
});

const router = Router();
router.use(authMiddleware, requireRole('ADMIN'));

// ─── Users ───
router.get('/users', async (req, res) => {
  if (useMongo()) {
    const { User } = await import('../models/index.js');
    const users = await User.find().sort({ created_at: -1 }).limit(200).lean();
    const mapped = users.map(u => ({ id: String(u._id), name: u.name, email: u.email, mobile: u.mobile, role_id: u.role_id, status: u.status, created_at: u.created_at }));
    return ok(res, { users: mapped });
  }
  const users = db.prepare('SELECT id, name, email, mobile, role_id, status, created_at FROM users ORDER BY created_at DESC LIMIT 200').all();
  return ok(res, { users });
});
router.post('/users/:id/suspend', async (req, res) => {
  if (useMongo()) {
    const { User } = await import('../models/index.js');
    await User.updateOne({ _id: req.params.id }, { status: 'suspended' });
    return ok(res, null, 'Suspended');
  }
  db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(req.params.id);
  return ok(res, null, 'Suspended');
});
router.post('/users/:id/activate', async (req, res) => {
  if (useMongo()) {
    const { User } = await import('../models/index.js');
    await User.updateOne({ _id: req.params.id }, { status: 'active' });
    return ok(res, null, 'Activated');
  }
  db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(req.params.id);
  return ok(res, null, 'Activated');
});
router.post('/promote', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return fail(res, 'email required', 400);
  if (useMongo()) {
    const { User, Role } = await import('../models/index.js');
    const role = await Role.findOne({ name: 'ADMIN' });
    if (!role) return fail(res, 'ADMIN role not found', 500);
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return fail(res, 'User not found: ' + email, 404);
    user.role_id = role._id;
    user.role_name = 'ADMIN';
    await user.save();
    return ok(res, { id: String(user._id), email: user.email, role: 'ADMIN' }, 'Promoted to ADMIN');
  }
  const role = db.prepare("SELECT id FROM roles WHERE name = 'ADMIN'").get();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return fail(res, 'User not found', 404);
  db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(role.id, user.id);
  return ok(res, { id: user.id, email, role: 'ADMIN' }, 'Promoted');
});
router.post('/set-password', async (req, res) => {
  const { email, newPassword } = req.body || {};
  if (!email || !newPassword) return fail(res, 'email and newPassword required', 400);
  if (String(newPassword).length < 8) return fail(res, 'newPassword must be at least 8 characters', 400);
  const { hashPassword } = await import('../utils/password.js');
  const hash = await hashPassword(String(newPassword));
  if (useMongo()) {
    const { User } = await import('../models/index.js');
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return fail(res, 'User not found: ' + email, 404);
    user.password_hash = hash;
    await user.save();
    return ok(res, { id: String(user._id), email: user.email }, 'Password set');
  }
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return fail(res, 'User not found', 404);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  return ok(res, { id: user.id, email }, 'Password set');
});

// ─── Dashboard Overview ───
router.get('/dashboard', async (req, res) => {
  try {
    if (useMongo()) {
      const { Order, Product, User, Category } = await import('../models/index.js');
      const totalOrders = await Order.countDocuments();
      const byStatusAgg = await Order.aggregate([{ $group: { _id: '$status', c: { $sum: 1 } } }]);
      const statusMap = {}; byStatusAgg.forEach(r => statusMap[r._id] = r.c);
      const pending = statusMap['PAYMENT_PENDING'] || 0;
      const paid = statusMap['PAID'] || 0;
      const confirmed = statusMap['CONFIRMED'] || 0;
      const processing = (statusMap['PROCESSING']||0)+(statusMap['PRINTING']||0)+(statusMap['QUALITY_CHECK']||0)+(statusMap['PACKED']||0);
      const shipped = (statusMap['SHIPPED']||0)+(statusMap['OUT_FOR_DELIVERY']||0);
      const delivered = statusMap['DELIVERED'] || 0;
      const cancelled = statusMap['CANCELLED'] || 0;
      const revenueAgg = await Order.aggregate([{ $match: { status: { $in: ['PAID','CONFIRMED','PROCESSING','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED'] } } }, { $group: { _id: null, rev: { $sum: '$total' } } }]);
      const revenue = revenueAgg[0]?.rev || 0;
      const since = new Date(Date.now()-24*60*60*1000);
      const todayAgg = await Order.aggregate([{ $match: { created_at: { $gte: since } } }, { $group: { _id: null, c: { $sum: 1 }, rev: { $sum: '$total' } } }]);
      const todayOrders = todayAgg[0]?.c || 0;
      const todayRevenue = todayAgg[0]?.rev || 0;
      const aovAgg = await Order.aggregate([{ $match: { status: { $in: ['PAID','CONFIRMED','DELIVERED'] } } }, { $group: { _id: null, aov: { $avg: '$total' } } }]);
      const aov = Math.round(aovAgg[0]?.aov || 0);
      const totalProducts = await Product.countDocuments({ active: true });
      const lowStock = await Product.countDocuments({ active: true, stock: { $gt: 0, $lte: 10 } });
      const outOfStock = await Product.countDocuments({ active: true, stock: 0 });
      const lowStockProducts = await Product.find({ active: true, stock: { $lte: 10 } }).sort({ stock: 1 }).limit(20).lean();
      const recentOrdersRaw = await Order.find().sort({ created_at: -1 }).limit(10).lean();
      const recentOrders = [];
      for (const o of recentOrdersRaw) {
        const u = o.user_id ? await User.findById(o.user_id).lean() : null;
        recentOrders.push({ ...o, id: String(o._id), customer_name: u?.name || null, customer_mobile: u?.mobile || null, customer_email: u?.email || null });
      }
      const byModule = await Order.aggregate([{ $group: { _id: '$module', count: { $sum: 1 }, revenue: { $sum: '$total' } } }]).then(r=>r.map(x=>({ module: x._id, count: x.count, revenue: x.revenue })));
      const byCatAgg = await Product.aggregate([{ $match: { active: true } }, { $group: { _id: '$category_id', product_count: { $sum: 1 } } }, { $limit: 10 }]);
      const byCategory = [];
      for (const g of byCatAgg) {
        const cat = g._id ? await Category.findById(g._id).lean() : null;
        byCategory.push({ category: cat?.name || String(g._id), product_count: g.product_count });
      }
      const weekly = await Order.aggregate([
        { $match: { created_at: { $gte: new Date(Date.now()-7*86400000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: '$_id', orders: 1, revenue: 1 } }
      ]);
      return ok(res, { totalOrders, pending, paid, confirmed, processing, shipped, delivered, cancelled, totalProducts, activeProducts: totalProducts, lowStock, outOfStock, lowStockProducts: lowStockProducts.map(p=>({ id: String(p._id), name: p.name, slug: p.slug, stock: p.stock, price: p.price })), revenue, todayOrders, todayRevenue, averageOrderValue: aov, recentOrders, byModule, byCategory, weekly, statusBreakdown: statusMap });
    }
    const totalOrders = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
    const byStatus = db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all();
    const statusMap = {};
    byStatus.forEach(r => statusMap[r.status] = r.c);
    const pending = statusMap['PAYMENT_PENDING'] || 0;
    const paid = statusMap['PAID'] || 0;
    const confirmed = statusMap['CONFIRMED'] || 0;
    const processing = (statusMap['PROCESSING'] || 0) + (statusMap['PRINTING'] || 0) + (statusMap['QUALITY_CHECK'] || 0) + (statusMap['PACKED'] || 0);
    const shipped = (statusMap['SHIPPED'] || 0) + (statusMap['OUT_FOR_DELIVERY'] || 0);
    const delivered = statusMap['DELIVERED'] || 0;
    const cancelled = statusMap['CANCELLED'] || 0;
    const revenueRow = db.prepare("SELECT COALESCE(SUM(total),0) rev FROM orders WHERE status IN ('PAID','CONFIRMED','PROCESSING','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')").get();
    const todayRow = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(total),0) rev FROM orders WHERE created_at >= datetime('now','-1 day')").get();
    const aovRow = db.prepare("SELECT COALESCE(AVG(total),0) aov FROM orders WHERE status IN ('PAID','CONFIRMED','DELIVERED')").get();
    const totalProducts = db.prepare('SELECT COUNT(*) c FROM products WHERE active=1').get().c;
    const lowStock = db.prepare('SELECT COUNT(*) c FROM products WHERE active=1 AND stock > 0 AND stock <= 10').get().c;
    const outOfStock = db.prepare('SELECT COUNT(*) c FROM products WHERE active=1 AND stock = 0').get().c;
    const lowStockProducts = db.prepare('SELECT id, name, slug, stock, price FROM products WHERE active=1 AND stock <= 10 ORDER BY stock ASC LIMIT 20').all();
    const recentOrders = db.prepare(`SELECT o.*, u.name as customer_name, u.mobile as customer_mobile, u.email as customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 10`).all();
    const byModule = db.prepare('SELECT module, COUNT(*) count, COALESCE(SUM(total),0) revenue FROM orders GROUP BY module').all();
    const byCategory = db.prepare(`SELECT c.name as category, COUNT(DISTINCT p.id) product_count FROM products p JOIN categories c ON c.id = p.category_id WHERE p.active=1 GROUP BY p.category_id LIMIT 10`).all();
    const weekly = db.prepare(`SELECT date(created_at) as day, COUNT(*) orders, COALESCE(SUM(total),0) revenue FROM orders WHERE created_at >= datetime('now','-7 days') GROUP BY date(created_at) ORDER BY day ASC`).all();
    return ok(res, { totalOrders, pending, paid, confirmed, processing, shipped, delivered, cancelled, totalProducts, activeProducts: totalProducts, lowStock, outOfStock, lowStockProducts, revenue: revenueRow.rev, todayOrders: todayRow.c, todayRevenue: todayRow.rev, averageOrderValue: Math.round(aovRow.aov || 0), recentOrders, byModule, byCategory, weekly, statusBreakdown: statusMap });
  } catch (e) {
    return fail(res, e.message, 500);
  }
});

// ─── Products ───
const productSchema = z.object({
  name: z.string().min(2), categoryId: z.union([z.number().int().positive(), z.string().min(1)]),
  price: z.number().int().positive(), mrp: z.number().int().positive(),
  stock: z.number().int().min(0), module: z.string().default('shop'),
  description: z.string().optional(), images: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(), sizes: z.array(z.string()).optional(),
  fit: z.string().optional(), fabric: z.string().optional(), collection: z.string().optional(),
  customizable: z.boolean().optional(), featured: z.boolean().optional(), newArrival: z.boolean().optional(),
});

router.get('/products', async (req, res) => {
  if (useMongo()) {
    const { Product, Category } = await import('../models/index.js');
    const { q, category, status, sort = 'newest', page = 1, limit = 20 } = req.query;
    const filter = {};
    if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }];
    if (category) {
      let catId = category;
      if (!/^[0-9a-fA-F]{24}$/.test(String(category))) {
        const cat = await Category.findOne({ slug: String(category).toLowerCase() });
        if (cat) catId = cat._id;
      }
      if (catId && /^[0-9a-fA-F]{24}$/.test(String(catId))) filter.category_id = catId;
    }
    if (status === 'active') filter.active = true;
    if (status === 'inactive') filter.active = false;
    if (status === 'low') filter.stock = { $gt: 0, $lte: 10 };
    if (status === 'out') filter.stock = 0;
    const sortMap = { newest: { created_at: -1 }, price_low: { price: 1 }, price_high: { price: -1 }, stock_low: { stock: 1 }, name: { name: 1 } };
    const sortObj = sortMap[sort] || sortMap.newest;
    const total = await Product.countDocuments(filter);
    const offset = (Number(page)-1)*Number(limit);
    const rows = await Product.find(filter).sort(sortObj).skip(offset).limit(Number(limit)).lean();
    const items = [];
    for (const p of rows) {
      const cat = p.category_id ? await Category.findById(p.category_id).lean() : null;
      items.push({ ...p, id: String(p._id), images: p.images||[], colors: p.colors||[], sizes: p.sizes||[], category_name: cat?.name || null });
    }
    return ok(res, { products: items, total, page: Number(page), limit: Number(limit) });
  }
  const { q, category, status, sort = 'newest', page = 1, limit = 20 } = req.query;
  const clauses = [];
  const params = [];
  if (q) { clauses.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (category) {
    let catId = Number(category);
    if (!catId) { const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(String(category).toLowerCase()); if (row) catId = row.id; }
    if (catId) { clauses.push('p.category_id = ?'); params.push(catId); }
  }
  if (status === 'active') clauses.push('p.active = 1');
  if (status === 'inactive') clauses.push('p.active = 0');
  if (status === 'low') clauses.push('p.stock <= 10 AND p.stock > 0');
  if (status === 'out') clauses.push('p.stock = 0');
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const sortMap = { newest: 'p.created_at DESC', price_low: 'p.price ASC', price_high: 'p.price DESC', stock_low: 'p.stock ASC', name: 'p.name ASC' };
  const orderBy = sortMap[sort] || sortMap.newest;
  const offset = (Number(page) - 1) * Number(limit);
  const total = db.prepare(`SELECT COUNT(*) c FROM products p ${where}`).get(...params).c;
  const items = db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, Number(limit), offset)
    .map(p => ({ ...p, images: p.images ? JSON.parse(p.images) : [], colors: p.colors ? JSON.parse(p.colors) : [], sizes: p.sizes ? JSON.parse(p.sizes) : [] }));
  return ok(res, { products: items, total, page: Number(page), limit: Number(limit) });
});

router.post('/products', upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    // Support both JSON and multipart/FormData
    const body = req.body || {};
    // Parse fields that may be JSON strings when sent via FormData
    const parseArray = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {}
        return v.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };
    const parseBool = (v) => v === true || v === 'true' || v === '1' || v === 1;
    const name = body.name?.trim();
    const categoryId = body.categoryId || body.category_id;
    const price = Number(body.price);
    const mrp = Number(body.mrp);
    const stock = Number(body.stock);
    const description = body.description || '';
    const colors = parseArray(body.colors);
    const sizes = parseArray(body.sizes);
    const fit = body.fit || null;
    const fabric = body.fabric || null;
    const collection = body.collection || null;
    const customizable = parseBool(body.customizable);
    const featured = parseBool(body.featured);
    const newArrival = parseBool(body.newArrival || body.new_arrival);
    const module = body.module || 'shop';

    if (!name || name.length < 2) return fail(res, 'Name is required (min 2)', 400);
    if (!categoryId) return fail(res, 'Category is required', 400);
    if (!price || price <= 0) return fail(res, 'Valid price required', 400);
    if (!mrp || mrp <= 0) return fail(res, 'Valid MRP required', 400);
    if (isNaN(stock) || stock < 0) return fail(res, 'Valid stock required', 400);

    // Handle uploaded images
    let images = [];
    if (req.files && req.files.images) {
      images = req.files.images.map(f => `/uploads/products/${f.filename}`);
    } else if (body.images) {
      // Legacy JSON: images as array of URLs or comma-separated string
      if (Array.isArray(body.images)) images = body.images;
      else if (typeof body.images === 'string') {
        try { const p = JSON.parse(body.images); images = Array.isArray(p) ? p : body.images.split(',').map(s => s.trim()).filter(Boolean); } catch { images = body.images.split(',').map(s => s.trim()).filter(Boolean); }
      }
    }
    // Include existing image URLs sent as imageUrls[] in FormData
    if (body.imageUrls) {
      const extra = parseArray(body.imageUrls);
      images = images.concat(extra);
    }
    if (images.length < 1) return fail(res, 'At least 1 image required', 400);
    if (images.length > 10) return fail(res, 'Maximum 10 images allowed', 400);

    let videoUrl = null;
    if (req.files && req.files.video && req.files.video[0]) {
      videoUrl = `/uploads/products/${req.files.video[0].filename}`;
    } else if (body.videoUrl) {
      videoUrl = body.videoUrl;
    } else if (body.video_url) {
      videoUrl = body.video_url;
    }

    if (useMongo()) {
      const { Product, ProductVariant, Category } = await import('../models/index.js');
      let catId = categoryId;
      if (!/^[0-9a-fA-F]{24}$/.test(String(categoryId))) {
        const cat = await Category.findOne({ slug: String(categoryId).toLowerCase() });
        if (!cat) return fail(res, 'Category not found', 404);
        catId = cat._id;
      }
      const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
      const prod = await Product.create({ category_id: catId, name, slug, description, price, mrp, stock, images, video_url: videoUrl, module, colors, sizes, fit, fabric, collection, customizable, featured, new_arrival: newArrival, care_instructions: 'Machine wash cold', active: true });
      if (colors.length && sizes.length) {
        for (const color of colors) for (const size of sizes) {
          const sku = `ZUNO-${prod._id}-${color.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${size}`;
          try { await ProductVariant.create({ product_id: prod._id, sku, color, size, stock: Math.floor(stock / (colors.length * sizes.length)) + 5, price }); } catch {}
        }
      }
      return ok(res, { id: String(prod._id) }, 'Product created', 201);
    }
    const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
    let catIdNum = Number(categoryId);
    if (!catIdNum) {
      const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(String(categoryId).toLowerCase());
      if (!row) return fail(res, 'Category not found', 404);
      catIdNum = row.id;
    }
    const info = db.prepare('INSERT INTO products (seller_id, category_id, name, slug, description, price, mrp, stock, images, video_url, module, colors, sizes, fit, fabric, collection, customizable, featured, new_arrival, care_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(null, catIdNum, name, slug, description, price, mrp, stock, JSON.stringify(images), videoUrl, module, JSON.stringify(colors), JSON.stringify(sizes), fit, fabric, collection, customizable ? 1 : 0, featured ? 1 : 0, newArrival ? 1 : 0, 'Machine wash cold');
    if (colors.length && sizes.length) {
      const varIns = db.prepare('INSERT INTO product_variants (product_id, sku, color, size, stock, price) VALUES (?, ?, ?, ?, ?, ?)');
      for (const color of colors) for (const size of sizes) {
        const sku = `ZUNO-${info.lastInsertRowid}-${color.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${size}`;
        try { varIns.run(info.lastInsertRowid, sku, color, size, Math.floor(stock / (colors.length * sizes.length)) + 5, price); } catch {}
      }
    }
    return ok(res, { id: info.lastInsertRowid }, 'Product created', 201);
  } catch (e) {
    // Clean up uploaded files on error
    if (req.files) {
      try {
        const all = [...(req.files.images||[]), ...(req.files.video||[])];
        for (const f of all) { try { fs.unlinkSync(f.path); } catch {} }
      } catch {}
    }
    if (e.message && e.message.includes('Only images')) return fail(res, e.message, 400);
    if (e.message && e.message.includes('Only video')) return fail(res, e.message, 400);
    return fail(res, e.message || 'Could not create product', 400);
  }
});

router.put('/products/:id', upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const parseArray = (v) => {
      if (!v) return undefined;
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {}
        return v.split(',').map(s => s.trim()).filter(Boolean);
      }
      return undefined;
    };
    const body = req.body || {};
    // Handle uploaded files for update
    let newImages = null;
    if (req.files && req.files.images && req.files.images.length) {
      newImages = req.files.images.map(f => `/uploads/products/${f.filename}`);
    } else if (body.images) {
      if (Array.isArray(body.images)) newImages = body.images;
      else if (typeof body.images === 'string') {
        try { const p = JSON.parse(body.images); newImages = Array.isArray(p) ? p : body.images.split(',').map(s=>s.trim()).filter(Boolean); } catch { newImages = body.images.split(',').map(s=>s.trim()).filter(Boolean); }
      }
    }
    if (body.imageUrls) {
      const extra = parseArray(body.imageUrls);
      if (extra) newImages = (newImages||[]).concat(extra);
    }
    let newVideo = null;
    if (req.files && req.files.video && req.files.video[0]) newVideo = `/uploads/products/${req.files.video[0].filename}`;
    else if (body.videoUrl) newVideo = body.videoUrl;
    else if (body.video_url) newVideo = body.video_url;

    // Normalize numeric fields (FormData sends strings)
    const num = (v) => v !== undefined && v !== '' ? Number(v) : undefined;
    const price = num(body.price);
    const mrp = num(body.mrp);
    const stock = num(body.stock);

    if (useMongo()) {
      const { Product, ProductVariant } = await import('../models/index.js');
      const existing = await Product.findById(req.params.id);
      if (!existing) return fail(res, 'Product not found', 404);
      if (price !== undefined && (isNaN(price) || price <= 0)) return fail(res, 'Invalid price', 400);
      if (mrp !== undefined && (isNaN(mrp) || mrp <= 0)) return fail(res, 'Invalid MRP', 400);
      if (stock !== undefined && (isNaN(stock) || stock < 0)) return fail(res, 'Invalid stock', 400);
      if (body.name) existing.name = body.name.trim();
      if (body.slug) existing.slug = slugify(body.slug) + '-' + Math.random().toString(36).slice(2,4);
      if (body.description !== undefined) existing.description = body.description;
      if (price !== undefined) existing.price = price;
      if (mrp !== undefined) existing.mrp = mrp;
      if (stock !== undefined) existing.stock = stock;
      if (newImages) {
        if (newImages.length < 1) return fail(res, 'At least 1 image required', 400);
        if (newImages.length > 10) return fail(res, 'Maximum 10 images allowed', 400);
        existing.images = newImages;
      }
      if (newVideo !== null) existing.video_url = newVideo;
      if (body.active !== undefined) existing.active = body.active === 'true' || body.active === true || body.active === '1';
      const colors = parseArray(body.colors);
      const sizes = parseArray(body.sizes);
      if (colors) existing.colors = colors;
      if (sizes) existing.sizes = sizes;
      if (body.fit !== undefined) existing.fit = body.fit;
      if (body.fabric !== undefined) existing.fabric = body.fabric;
      if (body.collection !== undefined) existing.collection = body.collection;
      if (body.customizable !== undefined) existing.customizable = body.customizable === 'true' || body.customizable === true;
      if (body.featured !== undefined) existing.featured = body.featured === 'true' || body.featured === true;
      if (body.newArrival !== undefined || body.new_arrival !== undefined) existing.new_arrival = (body.newArrival === 'true' || body.newArrival === true || body.new_arrival === 'true');
      await existing.save();
      if (price) try { await ProductVariant.updateMany({ product_id: req.params.id }, { price }); } catch {}
      return ok(res, null, 'Product updated');
    }
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 'Product not found', 404);
    if (price !== undefined && (isNaN(price) || price <= 0)) return fail(res, 'Invalid price', 400);
    if (mrp !== undefined && (isNaN(mrp) || mrp <= 0)) return fail(res, 'Invalid MRP', 400);
    if (stock !== undefined && (isNaN(stock) || stock < 0)) return fail(res, 'Invalid stock', 400);
    let imagesJson = null;
    if (newImages) {
       if (newImages.length < 1) return fail(res, 'At least 1 image required', 400);
       if (newImages.length > 10) return fail(res, 'Maximum 10 images allowed', 400);
       imagesJson = JSON.stringify(newImages);
     }
    let videoVal = newVideo !== null ? newVideo : null;
    const colors = parseArray(body.colors);
    const sizes = parseArray(body.sizes);
    db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        mrp = COALESCE(?, mrp),
        stock = COALESCE(?, stock),
        images = COALESCE(?, images),
        video_url = COALESCE(?, video_url),
        active = COALESCE(?, active),
        colors = COALESCE(?, colors),
        sizes = COALESCE(?, sizes),
        fit = COALESCE(?, fit),
        fabric = COALESCE(?, fabric),
        collection = COALESCE(?, collection),
        customizable = COALESCE(?, customizable),
        featured = COALESCE(?, featured),
        new_arrival = COALESCE(?, new_arrival)
      WHERE id = ?
    `).run(
      body.name ? body.name.trim() : null,
      body.slug ? slugify(body.slug) + '-' + Math.random().toString(36).slice(2,4) : null,
      body.description ?? null,
      price ?? null,
      mrp ?? null,
      stock ?? null,
      imagesJson,
      videoVal,
      body.active !== undefined ? (body.active === 'true' || body.active === true || body.active === '1' ? 1 : 0) : null,
      colors ? JSON.stringify(colors) : null,
      sizes ? JSON.stringify(sizes) : null,
      body.fit ?? null,
      body.fabric ?? null,
      body.collection ?? null,
      body.customizable !== undefined ? (body.customizable === 'true' || body.customizable === true || body.customizable === '1' ? 1 : 0) : null,
      body.featured !== undefined ? (body.featured === 'true' || body.featured === true ? 1 : 0) : null,
      (body.newArrival !== undefined || body.new_arrival !== undefined) ? ((body.newArrival === 'true' || body.newArrival === true || body.new_arrival === 'true') ? 1 : 0) : null,
      req.params.id
    );
    if (price) { try { db.prepare('UPDATE product_variants SET price = ? WHERE product_id = ?').run(price, req.params.id); } catch {} }
    return ok(res, null, 'Product updated');
  } catch (e) {
    if (req.files) {
      try { const all = [...(req.files.images||[]), ...(req.files.video||[])]; for (const f of all) try { fs.unlinkSync(f.path); } catch {} } catch {}
    }
    return fail(res, e.message || 'Could not update product', 400);
  }
});

router.delete('/products/:id', async (req, res) => {
  if (useMongo()) {
    const { Product } = await import('../models/index.js');
    const p = await Product.findById(req.params.id);
    if (!p) return fail(res, 'Not found', 404);
    p.active = false; await p.save();
    return ok(res, null, 'Product deactivated');
  }
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, 'Not found', 404);
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  return ok(res, null, 'Product deactivated');
});

router.post('/products/:id/restore', async (req, res) => {
  if (useMongo()) {
    const { Product } = await import('../models/index.js');
    await Product.updateOne({ _id: req.params.id }, { active: true });
    return ok(res, null, 'Restored');
  }
  db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(req.params.id);
  return ok(res, null, 'Restored');
});

// ─── Inventory ───
router.get('/inventory', async (req, res) => {
  if (useMongo()) {
    const { Product, Category } = await import('../models/index.js');
    const { q, filter, page = 1, limit = 20, sort = 'stock_low' } = req.query;
    const f = { active: true };
    if (q) f.$or = [{ name: { $regex: q, $options: 'i' } }, { slug: { $regex: q, $options: 'i' } }];
    if (filter === 'low') f.stock = { $gt: 0, $lte: 10 };
    if (filter === 'out') f.stock = 0;
    if (filter === 'in') f.stock = { $gt: 10 };
    const sortMap = { stock_low: { stock: 1 }, stock_high: { stock: -1 }, newest: { created_at: -1 }, name: { name: 1 } };
    const orderBy = sortMap[sort] || sortMap.stock_low;
    const total = await Product.countDocuments(f);
    const offset = (Number(page)-1)*Number(limit);
    const rows = await Product.find(f).sort(orderBy).skip(offset).limit(Number(limit)).lean();
    const items = [];
    for (const p of rows) {
      const cat = p.category_id ? await Category.findById(p.category_id).lean() : null;
      items.push({ id: String(p._id), name: p.name, slug: p.slug, stock: p.stock, price: p.price, mrp: p.mrp, colors: p.colors||[], sizes: p.sizes||[], category_id: p.category_id ? String(p.category_id) : null, category_name: cat?.name || null, images: p.images||[], low: p.stock>0&&p.stock<=10, out: p.stock===0 });
    }
    const summary = {
      total,
      low: await Product.countDocuments({ active: true, stock: { $gt: 0, $lte: 10 } }),
      out: await Product.countDocuments({ active: true, stock: 0 }),
      inStock: await Product.countDocuments({ active: true, stock: { $gt: 10 } }),
    };
    return ok(res, { inventory: items, total, page: Number(page), limit: Number(limit), summary });
  }
  const { q, filter, page = 1, limit = 20, sort = 'stock_low' } = req.query;
  const clauses = ['p.active = 1'];
  const params = [];
  if (q) { clauses.push('(p.name LIKE ? OR p.slug LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (filter === 'low') clauses.push('p.stock > 0 AND p.stock <= 10');
  if (filter === 'out') clauses.push('p.stock = 0');
  if (filter === 'in') clauses.push('p.stock > 10');
  const where = 'WHERE ' + clauses.join(' AND ');
  const sortMap = { stock_low: 'p.stock ASC', stock_high: 'p.stock DESC', newest: 'p.created_at DESC', name: 'p.name ASC' };
  const orderBy = sortMap[sort] || sortMap.stock_low;
  const offset = (Number(page)-1)*Number(limit);
  const total = db.prepare(`SELECT COUNT(*) c FROM products p ${where}`).get(...params).c;
  const items = db.prepare(`SELECT p.id, p.name, p.slug, p.stock, p.price, p.mrp, p.colors, p.sizes, p.category_id, c.name as category_name, p.images FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, Number(limit), offset).map(p => ({ ...p, images: p.images ? JSON.parse(p.images) : [], colors: p.colors ? JSON.parse(p.colors) : [], sizes: p.sizes ? JSON.parse(p.sizes) : [], low: p.stock > 0 && p.stock <= 10, out: p.stock === 0 }));
  const summary = {
    total: total,
    low: db.prepare('SELECT COUNT(*) c FROM products WHERE active=1 AND stock > 0 AND stock <= 10').get().c,
    out: db.prepare('SELECT COUNT(*) c FROM products WHERE active=1 AND stock = 0').get().c,
    inStock: db.prepare('SELECT COUNT(*) c FROM products WHERE active=1 AND stock > 10').get().c,
  };
  return ok(res, { inventory: items, total, page: Number(page), limit: Number(limit), summary });
});

const inventoryUpdateSchema = z.object({ stock: z.number().int().min(0).max(999999) });
router.patch('/inventory/:id', validate(inventoryUpdateSchema), async (req, res) => {
  if (useMongo()) {
    const { Product } = await import('../models/index.js');
    const p = await Product.findById(req.params.id);
    if (!p) return fail(res, 'Product not found', 404);
    p.stock = req.validated.stock; await p.save();
    return ok(res, { id: req.params.id, stock: p.stock }, 'Stock updated');
  }
  const { stock } = req.validated;
  const existing = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, 'Product not found', 404);
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, req.params.id);
  return ok(res, { id: Number(req.params.id), stock }, 'Stock updated');
});

router.post('/inventory/bulk', validate(z.object({ updates: z.array(z.object({ id: z.union([z.number().int().positive(), z.string().min(1)]), stock: z.number().int().min(0) })).min(1).max(100) })), async (req, res) => {
  if (useMongo()) {
    const { Product } = await import('../models/index.js');
    for (const u of req.validated.updates) await Product.updateOne({ _id: u.id }, { stock: u.stock });
    return ok(res, null, 'Bulk updated');
  }
  for (const u of req.validated.updates) db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(u.stock, u.id);
  return ok(res, null, 'Bulk updated');
});

// ─── Custom orders ───
router.get('/custom-orders', async (req, res) => {
  if (useMongo()) {
    const { Order, OrderItem } = await import('../models/index.js');
    const items = await OrderItem.find({ customization_data: { $ne: null } }).lean();
    const oids = [...new Set(items.map(i=>String(i.order_id)))];
    const orders = await Order.find({ _id: { $in: oids } }).sort({ created_at: -1 }).limit(100).lean();
    const enriched = [];
    for (const o of orders) {
      const oitems = await OrderItem.find({ order_id: o._id }).lean();
      enriched.push({ ...o, id: String(o._id), items: oitems.map(it=>({ ...it, id: String(it._id), customization: it.customization_data ? JSON.parse(it.customization_data) : null, variant: it.variant_data ? JSON.parse(it.variant_data) : null })) });
    }
    return ok(res, { orders: enriched });
  }
  const orders = db.prepare(`SELECT DISTINCT o.* FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.customization_data IS NOT NULL ORDER BY o.created_at DESC LIMIT 100`).all();
  const enriched = orders.map((o) => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id).map((it) => ({ ...it, customization: it.customization_data ? JSON.parse(it.customization_data) : null, variant: it.variant_data ? JSON.parse(it.variant_data) : null }));
    return { ...o, items };
  });
  return ok(res, { orders: enriched });
});

// ─── Orders ───
router.get('/orders', async (req, res) => {
  if (useMongo()) {
    const { Order, User, Address, Payment } = await import('../models/index.js');
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
      const q = req.query.q;
      const users = await User.find({ $or: [{ name: { $regex: q, $options: 'i' } }, { mobile: { $regex: q } }, { email: { $regex: q, $options: 'i' } }] }).lean();
      const uids = users.map(u=>u._id);
      filter.$or = [{ order_number: { $regex: q, $options: 'i' } }, { user_id: { $in: uids } }];
    }
    const allowedSort = { newest: { created_at: -1 }, oldest: { created_at: 1 }, total_high: { total: -1 }, total_low: { total: 1 } };
    const orderBy = allowedSort[req.query.sort] || allowedSort.newest;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const total = await Order.countDocuments(filter);
    const rows = await Order.find(filter).sort(orderBy).skip((page-1)*limit).limit(limit).lean();
    if (!rows.length) return ok(res, { orders: [], total, page, limit });
    // Batch fetch related data for speed (avoid N+1)
    const userIds = [...new Set(rows.map(r=>r.user_id).filter(Boolean).map(String))];
    const addrIds = [...new Set(rows.map(r=>r.address_id).filter(Boolean).map(String))];
    const orderIds = rows.map(r=>r._id);
    const [users, addrs, payments] = await Promise.all([
      userIds.length ? User.find({ _id: { $in: userIds } }).lean() : [],
      addrIds.length ? Address.find({ _id: { $in: addrIds } }).lean() : [],
      Payment.find({ order_id: { $in: orderIds } }).lean()
    ]);
    const userMap = new Map(users.map(u=>[String(u._id), u]));
    const addrMap = new Map(addrs.map(a=>[String(a._id), a]));
    const payMap = new Map(payments.map(p=>[String(p.order_id), p]));
    const orders = rows.map(o=>{
      const u = o.user_id ? userMap.get(String(o.user_id)) : null;
      const a = o.address_id ? addrMap.get(String(o.address_id)) : null;
      const p = payMap.get(String(o._id));
      const fullAddr = [a?.house_no, a?.line1, a?.line2, a?.landmark, a?.area, [a?.city, a?.state, a?.pincode].filter(Boolean).join(', ')].filter(Boolean).join(', ') || null;
      return {
        ...o,
        id: String(o._id),
        customer_name: u?.name || null,
        customer_mobile: u?.mobile || null,
        customer_email: u?.email || null,
        // full address fields for fast UI without extra fetch
        addr_line1: a?.line1 || null,
        addr_line2: a?.line2 || null,
        addr_house_no: a?.house_no || null,
        addr_landmark: a?.landmark || null,
        addr_area: a?.area || null,
        addr_city: a?.city || null,
        addr_state: a?.state || null,
        addr_pincode: a?.pincode || null,
        addr_latitude: a?.latitude || null,
        addr_longitude: a?.longitude || null,
        addr_full: fullAddr,
        payment_status: o.payment_status || p?.status || null,
        payment_method: o.payment_method || p?.method || null
      };
    });
    return ok(res, { orders, total, page, limit });
  }
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
  const allowedSort = { newest: 'o.created_at DESC', oldest: 'o.created_at ASC', total_high: 'o.total DESC', total_low: 'o.total ASC' };
  const orderBy = allowedSort[req.query.sort] || allowedSort.newest;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const total = db.prepare(`SELECT COUNT(*) c FROM orders o LEFT JOIN users u ON u.id = o.user_id ${where}`).get(...params).c;
  const orders = db.prepare(`SELECT o.*, u.name as customer_name, u.mobile as customer_mobile, u.email as customer_email, a.line1 as addr_line1, a.line2 as addr_line2, a.house_no as addr_house_no, a.landmark as addr_landmark, a.area as addr_area, a.city as addr_city, a.state as addr_state, a.pincode as addr_pincode, a.latitude as addr_latitude, a.longitude as addr_longitude, COALESCE(o.payment_status, p.status) as payment_status, COALESCE(o.payment_method, p.method) as payment_method FROM orders o LEFT JOIN users u ON u.id = o.user_id LEFT JOIN addresses a ON a.id = o.address_id LEFT JOIN payments p ON p.order_id = o.id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset).map(r=>{
    const full = [r.addr_house_no, r.addr_line1, r.addr_line2, r.addr_landmark, r.addr_area, [r.addr_city, r.addr_state, r.addr_pincode].filter(Boolean).join(', ')].filter(Boolean).join(', ');
    return { ...r, addr_full: full || null };
  });
  return ok(res, { orders, total, page, limit });
});

router.post('/orders/:id/status', async (req, res) => {
  const { status, note } = req.body;
  const allowed = ['PAYMENT_PENDING','PAID','CONFIRMED','PROCESSING','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
  if (!allowed.includes(status)) return fail(res, 'Invalid status', 400);
  try {
    const updated = await orderService.updateStatus(req.params.id, status, req.user.id, note || null);
    return ok(res, { order: updated }, 'Status updated');
  } catch (e) {
    if (e.message === 'NOT_FOUND') return fail(res, 'Order not found', 404);
    if (e.message.startsWith('INVALID_TRANSITION')) return fail(res, e.message.replace('INVALID_TRANSITION: ', ''), 422);
    return fail(res, e.message, 400);
  }
});
router.get('/orders/:id/history', async (req, res) => {
  const history = await orderService.getHistory(req.params.id);
  return ok(res, { history });
});
router.post('/orders/:id/notes', async (req, res) => {
  const { note } = req.body;
  if (!note || !note.trim()) return fail(res, 'Note required', 400);
  try {
    await orderService.addAdminNote(req.params.id, note.trim(), req.user.id);
    return ok(res, null, 'Note added');
  } catch (e) { return fail(res, e.message, 400); }
});
router.get('/orders/:id', async (req, res) => {
  if (useMongo()) {
    const { Order, OrderItem, User, Address, Payment, OrderStatusHistory } = await import('../models/index.js');
    const order = await Order.findById(req.params.id).lean();
    if (!order) return fail(res, 'Not found', 404);
    const items = (await OrderItem.find({ order_id: order._id }).lean()).map(it => ({ ...it, id: String(it._id), customization: it.customization_data ? JSON.parse(it.customization_data) : null, variant: it.variant_data ? JSON.parse(it.variant_data) : null }));
    const history = await OrderStatusHistory.find({ order_id: order._id }).sort({ created_at: 1 }).lean();
    for (const h of history) if (h.changed_by) { const u = await User.findById(h.changed_by).lean(); h.changed_by_name = u?.name || null; }
    const customer = order.user_id ? await User.findById(order.user_id).lean().then(u=>u?{ id: String(u._id), name: u.name, email: u.email, mobile: u.mobile }:null) : null;
    const address = order.address_id ? await Address.findById(order.address_id).lean() : null;
    const payment = await Payment.findOne({ order_id: order._id }).lean();
    return ok(res, { order: { ...order, id: String(order._id), items, history, customer, address, payment } });
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return fail(res, 'Not found', 404);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id).map(it => ({ ...it, customization: it.customization_data ? JSON.parse(it.customization_data) : null, variant: it.variant_data ? JSON.parse(it.variant_data) : null }));
  const history = db.prepare('SELECT h.*, u.name as changed_by_name FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.created_at ASC').all(req.params.id);
  const customer = db.prepare('SELECT id, name, email, mobile FROM users WHERE id = ?').get(order.user_id);
  const address = db.prepare('SELECT * FROM addresses WHERE id = ?').get(order.address_id);
  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id);
  return ok(res, { order: { ...order, items, history, customer, address, payment } });
});

// ─── Payments ───
router.get('/payments', async (req, res) => {
  if (useMongo()) {
    const { Payment } = await import('../models/index.js');
    const payments = await Payment.find().sort({ created_at: -1 }).limit(300).lean();
    return ok(res, { payments });
  }
  const payments = db.prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT 300').all();
  return ok(res, { payments });
});

// ─── Analytics (legacy) ───
router.get('/analytics', async (req, res) => {
  if (useMongo()) {
    const { Order, User } = await import('../models/index.js');
    const revAgg = await Order.aggregate([{ $match: { status: { $in: ['PAID','CONFIRMED','PROCESSING','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED'] } } }, { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } }]);
    const revenue = revAgg[0] || { revenue: 0, count: 0 };
    const users = await User.countDocuments();
    const since = new Date(Date.now()-24*60*60*1000);
    const ordersToday = await Order.countDocuments({ created_at: { $gte: since } });
    const aovAgg = await Order.aggregate([{ $match: { status: { $in: ['PAID','CONFIRMED','DELIVERED'] } } }, { $group: { _id: null, aov: { $avg: '$total' } } }]);
    const aov = Math.round(aovAgg[0]?.aov || 0);
    const byModuleAgg = await Order.aggregate([{ $group: { _id: '$module', count: { $sum: 1 }, revenue: { $sum: '$total' } } }]);
    const byModule = byModuleAgg.map(r=>({ module: r._id, count: r.count, revenue: r.revenue }));
    return ok(res, { revenue: revenue.revenue, totalOrders: revenue.count, users, ordersToday, averageOrderValue: aov, byModule });
  }
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) revenue, COUNT(*) count FROM orders WHERE status IN ('PAID','CONFIRMED','PROCESSING','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')").get();
  const users = db.prepare('SELECT COUNT(*) count FROM users').get();
  const ordersToday = db.prepare("SELECT COUNT(*) count FROM orders WHERE created_at >= datetime('now','-1 day')").get();
  const aov = db.prepare("SELECT COALESCE(AVG(total),0) aov FROM orders WHERE status IN ('PAID','CONFIRMED','DELIVERED')").get();
  const byModule = db.prepare('SELECT module, COUNT(*) count, COALESCE(SUM(total),0) revenue FROM orders GROUP BY module').all();
  return ok(res, { revenue: revenue.revenue, totalOrders: revenue.count, users: users.count, ordersToday: ordersToday.count, averageOrderValue: Math.round(aov.aov), byModule });
});

export default router;
