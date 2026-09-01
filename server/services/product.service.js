import { db } from '../config/db.js';

function serializeProduct(p) {
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
  };
}

export const productService = {
  list({ module = 'shop', category, search, page = 1, limit = 24, sort = 'popular', minPrice, maxPrice, brand }) {
    const clauses = ['p.active = 1', 'p.module = ?'];
    const params = [module];
    if (category) { clauses.push('p.category_id = ?'); params.push(Number(category)); }
    if (brand) { clauses.push('p.brand_id = ?'); params.push(Number(brand)); }
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
    const rows = db
      .prepare(`SELECT p.* FROM products p WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...params, Number(limit), offset);

    return { items: rows.map(serializeProduct), total, page: Number(page), limit: Number(limit), testMode: false };
  },

  getBySlug(slug) {
    const p = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(slug);
    if (!p) return null;
    const product = serializeProduct(p);
    product.related = db
      .prepare('SELECT * FROM products WHERE category_id = ? AND id != ? AND active = 1 LIMIT 8')
      .all(p.category_id, p.id)
      .map(serializeProduct);
    product.reviews = db
      .prepare("SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.module='product' AND r.target_id = ? ORDER BY r.created_at DESC LIMIT 10")
      .all(p.id);
    return product;
  },

  getById(id) {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return p ? serializeProduct(p) : null;
  },

  searchSuggestions(q, limit = 8) {
    if (!q) return [];
    const rows = db
      .prepare('SELECT name, slug, module FROM products WHERE active=1 AND name LIKE ? LIMIT ?')
      .all(`%${q}%`, Number(limit));
    return rows.map((r) => ({ label: r.name, slug: r.slug, module: r.module, type: 'product' }));
  },
};

export { serializeProduct };
