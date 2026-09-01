import { db } from '../config/db.js';
import { slugify } from '../utils/id.js';
import { ok, fail } from '../utils/response.js';

function requireLinked(row, kind) {
  if (!row) {
    const e = new Error('PARTNER_NOT_LINKED');
    e.kind = kind;
    throw e;
  }
  return row;
}

export const partnerService = {
  // ---------- SELLER ----------
  sellerContext(userId) {
    return db.prepare('SELECT * FROM sellers WHERE owner_user_id = ?').get(userId);
  },
  async listSellerProducts(userId) {
    const seller = requireLinked(this.sellerContext(userId), 'seller');
    return db.prepare('SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC').all(seller.id);
  },
  async createSellerProduct(userId, data) {
    const seller = requireLinked(this.sellerContext(userId), 'seller');
    const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND module IN (\'shop\',\'grocery\')').get(data.categoryId);
    if (!cat) throw new Error('BAD_CATEGORY');
    const slug = slugify(data.name) + '-' + Math.random().toString(36).slice(2, 6);
    const info = db.prepare(`INSERT INTO products (seller_id, category_id, brand_id, name, slug, description, price, mrp, stock, rating, rating_count, images, specs, module)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`)
      .run(seller.id, data.categoryId, data.brandId || null, data.name, slug, data.description || '', data.price, data.mrp || data.price, data.stock || 0, JSON.stringify([]), JSON.stringify(data.specs || {}), cat.module);
    return db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  },
  async updateSellerProduct(userId, id, data) {
    const seller = requireLinked(this.sellerContext(userId), 'seller');
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(id, seller.id);
    if (!product) throw new Error('NOT_FOUND');
    const sets = [];
    const params = [];
    for (const f of ['name', 'description', 'price', 'mrp', 'stock', 'category_id']) {
      if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
    }
    if (sets.length) {
      params.push(id, seller.id);
      db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ? AND seller_id = ?`).run(...params);
    }
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },
  async deactivateSellerProduct(userId, id) {
    const seller = requireLinked(this.sellerContext(userId), 'seller');
    const info = db.prepare('UPDATE products SET active = 0 WHERE id = ? AND seller_id = ?').run(id, seller.id);
    if (info.changes === 0) throw new Error('NOT_FOUND');
    return { success: true };
  },
  async sellerOrders(userId) {
    const seller = requireLinked(this.sellerContext(userId), 'seller');
    return db.prepare(`SELECT DISTINCT o.* FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE p.seller_id = ? ORDER BY o.created_at DESC`).all(seller.id);
  },
  async sellerAnalytics(userId) {
    const seller = requireLinked(this.sellerContext(userId), 'seller');
    const rev = db.prepare(`SELECT COALESCE(SUM(o.total),0) revenue, COUNT(DISTINCT o.id) orders
      FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id
      WHERE p.seller_id = ? AND o.status != 'CANCELLED'`).get(seller.id);
    const top = db.prepare(`SELECT p.name, SUM(oi.quantity) sold, SUM(oi.quantity*oi.price) revenue
      FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id
      WHERE p.seller_id = ? GROUP BY p.id ORDER BY sold DESC LIMIT 5`).all(seller.id);
    return { revenue: rev.revenue, orders: rev.orders, topProducts: top };
  },

  // ---------- RESTAURANT ----------
  restaurantContext(userId) {
    return db.prepare('SELECT * FROM restaurants WHERE owner_user_id = ?').get(userId);
  },
  async listMenu(userId) {
    const r = requireLinked(this.restaurantContext(userId), 'restaurant');
    return db.prepare('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name').all(r.id);
  },
  async createMenuItem(userId, data) {
    const r = requireLinked(this.restaurantContext(userId), 'restaurant');
    const info = db.prepare('INSERT INTO menu_items (restaurant_id, category, name, description, price, available) VALUES (?, ?, ?, ?, ?, 1)')
      .run(r.id, data.category || 'Main', data.name, data.description || '', data.price);
    return db.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid);
  },
  async updateMenuItem(userId, id, data) {
    const r = requireLinked(this.restaurantContext(userId), 'restaurant');
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?').get(id, r.id);
    if (!item) throw new Error('NOT_FOUND');
    const sets = []; const params = [];
    for (const f of ['name', 'description', 'price', 'category', 'available']) {
      if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
    }
    if (sets.length) { params.push(id, r.id); db.prepare(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ?`).run(...params); }
    return db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
  },
  async deleteMenuItem(userId, id) {
    const r = requireLinked(this.restaurantContext(userId), 'restaurant');
    const info = db.prepare('DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?').run(id, r.id);
    if (info.changes === 0) throw new Error('NOT_FOUND');
    return { success: true };
  },
  async restaurantOrders(userId) {
    const r = requireLinked(this.restaurantContext(userId), 'restaurant');
    return db.prepare('SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC').all(r.id);
  },

  // ---------- SERVICE PROVIDER ----------
  providerContext(userId) {
    return db.prepare('SELECT * FROM service_providers WHERE owner_user_id = ?').get(userId);
  },
  async listServices(userId) {
    const p = requireLinked(this.providerContext(userId), 'provider');
    return db.prepare('SELECT * FROM services WHERE provider_id = ? ORDER BY name').all(p.id);
  },
  async createService(userId, data) {
    const p = requireLinked(this.providerContext(userId), 'provider');
    const info = db.prepare('INSERT INTO services (provider_id, name, category, price, duration_minutes, active) VALUES (?, ?, ?, ?, ?, 1)')
      .run(p.id, data.name, data.category || p.category, data.price, data.duration_minutes || 60);
    return db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
  },
  async updateService(userId, id, data) {
    const p = requireLinked(this.providerContext(userId), 'provider');
    const svc = db.prepare('SELECT * FROM services WHERE id = ? AND provider_id = ?').get(id, p.id);
    if (!svc) throw new Error('NOT_FOUND');
    const sets = []; const params = [];
    for (const f of ['name', 'description', 'price', 'category', 'duration_minutes', 'active']) {
      if (data[f] !== undefined) { sets.push(`${f} = ?`); params.push(data[f]); }
    }
    if (sets.length) { params.push(id, p.id); db.prepare(`UPDATE services SET ${sets.join(', ')} WHERE id = ? AND provider_id = ?`).run(...params); }
    return db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  },
  async deleteService(userId, id) {
    const p = requireLinked(this.providerContext(userId), 'provider');
    const info = db.prepare('DELETE FROM services WHERE id = ? AND provider_id = ?').run(id, p.id);
    if (info.changes === 0) throw new Error('NOT_FOUND');
    return { success: true };
  },
  async providerBookings(userId) {
    const p = requireLinked(this.providerContext(userId), 'provider');
    return db.prepare(`SELECT b.*, s.name service_name, u.name customer
      FROM bookings b JOIN services s ON s.id = b.service_id JOIN users u ON u.id = b.user_id
      WHERE b.provider_id = ? ORDER BY b.created_at DESC`).all(p.id);
  },
  async updateBookingStatus(userId, id, status) {
    const p = requireLinked(this.providerContext(userId), 'provider');
    const info = db.prepare('UPDATE bookings SET status = ? WHERE id = ? AND provider_id = ?').run(status, id, p.id);
    if (info.changes === 0) throw new Error('NOT_FOUND');
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  },
};
