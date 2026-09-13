import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { Product, ProductVariant, Category, Review } from '../models/index.js';
function useMongo() { return !!env.mongoUri && isMongoConnected(); }

function serializeProduct(p) {
  const isMongoDoc = !!(p && (p._id || p._doc || (typeof p.id === 'string' && /^[0-9a-fA-F]{24}$/.test(p.id))));
  if (isMongoDoc) {
    // p is mongoose doc/object already lean
    const doc = p._doc ? p._doc : p;
    const id = String(doc._id || doc.id);
    const variants = doc._variants || [];
    return {
      id,
      _id: id,
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      price: doc.price,
      mrp: doc.mrp,
      discountPercent: doc.mrp > doc.price ? Math.round(((doc.mrp - doc.price) / doc.mrp) * 100) : 0,
      stock: doc.stock,
      rating: doc.rating,
      ratingCount: doc.rating_count || doc.ratingCount || 0,
      images: Array.isArray(doc.images) ? doc.images : (doc.images ? JSON.parse(doc.images) : []),
      specs: doc.specs && typeof doc.specs === 'string' ? JSON.parse(doc.specs) : (doc.specs || {}),
      module: doc.module,
      categoryId: doc.category_id ? String(doc.category_id) : null,
      brandId: doc.brand_id ? String(doc.brand_id) : null,
      sellerId: doc.seller_id ? String(doc.seller_id) : null,
      active: !!doc.active,
      colors: Array.isArray(doc.colors) ? doc.colors : (doc.colors ? JSON.parse(doc.colors) : []),
      sizes: Array.isArray(doc.sizes) ? doc.sizes : (doc.sizes ? JSON.parse(doc.sizes) : []),
      fit: doc.fit || null,
      fabric: doc.fabric || null,
      collection: doc.collection || null,
      customizable: !!doc.customizable,
      featured: !!doc.featured,
      newArrival: !!doc.new_arrival || !!doc.newArrival,
      careInstructions: doc.care_instructions || null,
      video_url: doc.video_url || null,
      videoUrl: doc.video_url || null,
      variants: variants.map(v => ({ id: String(v._id || v.id), sku: v.sku, color: v.color, size: v.size, stock: v.stock, price: v.price })),
    };
  }
  const variants = p.id ? (() => { try { return db.prepare('SELECT id, sku, color, size, stock, price FROM product_variants WHERE product_id = ?').all(p.id); } catch { return []; } })() : [];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    mrp: p.mrp,
    discountPercent: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    stock: p.stock,
    rating: p.rating,
    ratingCount: p.rating_count,
    images: p.images ? JSON.parse(p.images) : [],
    specs: p.specs ? JSON.parse(p.specs) : {},
    module: p.module,
    categoryId: p.category_id,
    brandId: p.brand_id,
    sellerId: p.seller_id,
    active: !!p.active,
    colors: p.colors ? JSON.parse(p.colors) : [],
    sizes: p.sizes ? JSON.parse(p.sizes) : [],
    fit: p.fit || null,
    fabric: p.fabric || null,
    collection: p.collection || null,
    customizable: !!p.customizable,
    featured: !!p.featured,
    newArrival: !!p.new_arrival,
    careInstructions: p.care_instructions || null,
    video_url: p.video_url || null,
    videoUrl: p.video_url || null,
    variants,
  };
}

async function mongoHasProducts() {
  try { return (await Product.countDocuments({})) > 0; } catch { return false; }
}

export const productService = {
  async list({ module = 'shop', category, search, page = 1, limit = 24, sort = 'popular', minPrice, maxPrice, brand, color, size, fit, collection, featured, newArrival }) {
    if (useMongo() && await mongoHasProducts()) {
      const filter = { active: true, module };
      if (category) {
        let catId = null;
        try {
          const cat = await Category.findOne({ slug: String(category).toLowerCase() }).lean();
          if (cat) catId = cat._id;
          else if (/^[0-9a-fA-F]{24}$/.test(String(category))) catId = category;
        } catch {}
        if (catId) filter.category_id = catId;
      }
      if (brand) filter.brand_id = brand;
      if (color) filter.colors = color;
      if (size) filter.sizes = size;
      if (fit) filter.fit = fit;
      if (collection) filter.collection = collection;
      if (featured) filter.featured = true;
      if (newArrival) filter.new_arrival = true;
      if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
      if (minPrice) filter.price = { ...(filter.price||{}), $gte: Number(minPrice) };
      if (maxPrice) filter.price = { ...(filter.price||{}), $lte: Number(maxPrice) };

      const sortMap = {
        popular: { rating_count: -1, rating: -1 },
        price_low: { price: 1 },
        price_high: { price: -1 },
        newest: { created_at: -1 },
        rating: { rating: -1 },
      };
      const sortObj = sortMap[sort] || sortMap.popular;
      const total = await Product.countDocuments(filter);
      const offset = (Number(page) - 1) * Number(limit);
      const rows = await Product.find(filter).sort(sortObj).skip(offset).limit(Number(limit)).lean();
      // attach variants
      const ids = rows.map(r => r._id);
      const variants = ids.length ? await ProductVariant.find({ product_id: { $in: ids } }).lean() : [];
      const byPid = {};
      variants.forEach(v => { const k = String(v.product_id); (byPid[k] ||= []).push(v); });
      const items = rows.map(r => { r._variants = byPid[String(r._id)] || []; return serializeProduct(r); });
      return { items, total, page: Number(page), limit: Number(limit), testMode: false };
    }
    // SQLite path (sync)
    const clauses = ['p.active = 1', 'p.module = ?'];
    const params = [module];
    if (category) {
      let catId = Number(category);
      if (!catId) {
        const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(String(category).toLowerCase());
        if (row) catId = row.id;
      }
      if (catId) { clauses.push('p.category_id = ?'); params.push(catId); }
    }
    if (brand) { clauses.push('p.brand_id = ?'); params.push(Number(brand)); }
    if (color) { clauses.push('p.colors LIKE ?'); params.push(`%"${color}"%`); }
    if (size) { clauses.push('p.sizes LIKE ?'); params.push(`%"${size}"%`); }
    if (fit) { clauses.push('p.fit = ?'); params.push(fit); }
    if (collection) { clauses.push('p.collection = ?'); params.push(collection); }
    if (featured) clauses.push('p.featured = 1');
    if (newArrival) clauses.push('p.new_arrival = 1');
    if (search) { clauses.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (minPrice) { clauses.push('p.price >= ?'); params.push(Number(minPrice)); }
    if (maxPrice) { clauses.push('p.price <= ?'); params.push(Number(maxPrice)); }

    const where = clauses.join(' AND ');
    const allowedSort = {
      popular: 'p.rating_count DESC, p.rating DESC',
      price_low: 'p.price ASC',
      price_high: 'p.price DESC',
      newest: 'p.created_at DESC',
      rating: 'p.rating DESC',
    };
    const orderBy = allowedSort[sort] || allowedSort.popular;

    const total = db.prepare(`SELECT COUNT(*) as c FROM products p WHERE ${where}`).get(...params).c;
    const offset = (Number(page) - 1) * Number(limit);
    const rows = db.prepare(`SELECT p.* FROM products p WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);

    return { items: rows.map(serializeProduct), total, page: Number(page), limit: Number(limit), testMode: false };
  },

  async getBySlug(slug) {
    if (useMongo() && await mongoHasProducts()) {
      const p = await Product.findOne({ slug, active: true }).lean();
      if (!p) return null;
      const variants = await ProductVariant.find({ product_id: p._id }).lean();
      p._variants = variants;
      const product = serializeProduct(p);
      const related = await Product.find({ category_id: p.category_id, _id: { $ne: p._id }, active: true }).limit(8).lean();
      product.related = related.map(r => serializeProduct(r));
      product.reviews = []; // could populate reviews
      return product;
    }
    const p = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(slug);
    if (!p) return null;
    const product = serializeProduct(p);
    product.related = db.prepare('SELECT * FROM products WHERE category_id = ? AND id != ? AND active = 1 LIMIT 8').all(p.category_id, p.id).map(serializeProduct);
    product.reviews = db.prepare("SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.module='product' AND r.target_id = ? ORDER BY r.created_at DESC LIMIT 10").all(p.id);
    return product;
  },

  async getById(id) {
    if (useMongo() && await mongoHasProducts()) {
      try {
        const p = await Product.findById(id).lean();
        if (!p) return null;
        const variants = await ProductVariant.find({ product_id: p._id }).lean();
        p._variants = variants;
        return serializeProduct(p);
      } catch { return null; }
    }
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return p ? serializeProduct(p) : null;
  },

  async searchSuggestions(q, limit = 8) {
    if (useMongo() && await mongoHasProducts()) {
      if (!q) return [];
      const rows = await Product.find({ active: true, name: { $regex: q, $options: 'i' } }).limit(Number(limit)).lean();
      return rows.map((r) => ({ label: r.name, slug: r.slug, module: r.module, type: 'product' }));
    }
    if (!q) return [];
    const rows = db.prepare('SELECT name, slug, module FROM products WHERE active=1 AND name LIKE ? LIMIT ?').all(`%${q}%`, Number(limit));
    return rows.map((r) => ({ label: r.name, slug: r.slug, module: r.module, type: 'product' }));
  },
};

export { serializeProduct };
