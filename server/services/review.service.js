import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

function toObjectId(id) {
  try {
    const mongoose = global.__mongoose || null;
    return id;
  } catch { return id; }
}

async function recalcProductRating(productId) {
  if (useMongo()) {
    const { Review, Product } = await import('../models/index.js');
    let pid = productId;
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(String(productId))) pid = new mongoose.Types.ObjectId(String(productId));
    } catch {}
    const agg = await Review.aggregate([
      { $match: { module: 'product', target_id: pid } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const avg = agg[0]?.avg || 0;
    const count = agg[0]?.count || 0;
    const rating = count ? Number(avg.toFixed(1)) : 0;
    try {
      await Product.updateOne({ _id: pid }, { $set: { rating, rating_count: count } });
    } catch {}
    return { rating, rating_count: count, ratingCount: count };
  }
  // SQLite
  const row = db.prepare('SELECT COALESCE(AVG(rating),0) avg, COUNT(*) c FROM reviews WHERE module = ? AND target_id = ?').get('product', Number(productId));
  const avg = row.avg || 0;
  const count = row.c || 0;
  const rating = count ? Number(Number(avg).toFixed(1)) : 0;
  try {
    db.prepare('UPDATE products SET rating = ?, rating_count = ? WHERE id = ?').run(rating, count, Number(productId));
  } catch {}
  return { rating, rating_count: count, ratingCount: count };
}

export const reviewService = {
  async listForProduct(productId, { page = 1, limit = 20 } = {}) {
    if (useMongo()) {
      const { Review, User } = await import('../models/index.js');
      let pid = productId;
      try {
        const mongoose = (await import('mongoose')).default;
        if (mongoose.Types.ObjectId.isValid(String(productId))) pid = new mongoose.Types.ObjectId(String(productId));
      } catch {}
      const filter = { module: 'product', target_id: pid };
      const total = await Review.countDocuments(filter);
      const offset = (Number(page) - 1) * Number(limit);
      const rows = await Review.find(filter).sort({ created_at: -1 }).skip(offset).limit(Number(limit)).lean();
      // populate user
      const ids = [...new Set(rows.map(r => String(r.user_id)).filter(Boolean))];
      const users = ids.length ? await User.find({ _id: { $in: ids } }).lean() : [];
      const umap = new Map(users.map(u => [String(u._id), u]));
      const reviews = rows.map(r => ({
        id: String(r._id),
        userId: String(r.user_id),
        userName: umap.get(String(r.user_id))?.name || 'Anonymous',
        rating: r.rating,
        title: r.title || null,
        body: r.body || null,
        verified: !!r.verified,
        createdAt: r.created_at,
        created_at: r.created_at,
      }));
      // live stats
      const agg = await Review.aggregate([
        { $match: filter },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      const avg = agg[0]?.avg || 0;
      const count = agg[0]?.count || 0;
      // distribution 1-5
      const distAgg = await Review.aggregate([
        { $match: filter },
        { $group: { _id: '$rating', c: { $sum: 1 } } }
      ]);
      const distribution = { 1:0,2:0,3:0,4:0,5:0 };
      distAgg.forEach(d => { if (d._id >=1 && d._id <=5) distribution[d._id] = d.c; });
      return { reviews, total, page: Number(page), limit: Number(limit), rating: count ? Number(Number(avg).toFixed(1)) : 0, ratingCount: count, distribution };
    }
    // SQLite
    const pid = Number(productId);
    const total = db.prepare('SELECT COUNT(*) c FROM reviews WHERE module = ? AND target_id = ?').get('product', pid).c;
    const offset = (Number(page) - 1) * Number(limit);
    const rows = db.prepare('SELECT r.*, u.name as user_name FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.module = ? AND r.target_id = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?').all('product', pid, Number(limit), offset);
    const reviews = rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name || 'Anonymous',
      rating: r.rating,
      title: r.title,
      body: r.body,
      verified: !!r.verified,
      createdAt: r.created_at,
      created_at: r.created_at,
    }));
    const stats = db.prepare('SELECT COALESCE(AVG(rating),0) avg, COUNT(*) c FROM reviews WHERE module = ? AND target_id = ?').get('product', pid);
    const distRows = db.prepare('SELECT rating, COUNT(*) c FROM reviews WHERE module = ? AND target_id = ? GROUP BY rating').all('product', pid);
    const distribution = { 1:0,2:0,3:0,4:0,5:0 };
    distRows.forEach(r => { if (r.rating >=1 && r.rating <=5) distribution[r.rating] = r.c; });
    const avg = stats.avg || 0;
    const count = stats.c || 0;
    return { reviews, total, page: Number(page), limit: Number(limit), rating: count ? Number(Number(avg).toFixed(1)) : 0, ratingCount: count, distribution };
  },

  async getForProduct(productId) {
    return this.listForProduct(productId, { page: 1, limit: 20 });
  },

  async addReview({ productId, userId, rating, title, body }) {
    const r = Number(rating);
    if (!r || r < 1 || r > 5) throw new Error('Rating must be 1-5');
    if (!productId) throw new Error('Product required');

    if (useMongo()) {
      const { Review, Product, Order, OrderItem } = await import('../models/index.js');
      let pid = productId;
      try {
        const mongoose = (await import('mongoose')).default;
        if (mongoose.Types.ObjectId.isValid(String(productId))) pid = new mongoose.Types.ObjectId(String(productId));
      } catch {}
      const product = await Product.findById(pid).lean();
      if (!product) throw new Error('Product not found');
      // Check if user already reviewed — allow update instead of duplicate
      const existing = await Review.findOne({ module: 'product', target_id: pid, user_id: userId });
      let verified = false;
      try {
        const hasOrder = await Order.findOne({ user_id: userId, status: { $in: ['PAID','CONFIRMED','PROCESSING','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED'] } }).lean();
        if (hasOrder) {
          const hasItem = await OrderItem.findOne({ order_id: hasOrder._id, product_id: pid }).lean();
          if (hasItem) verified = true;
          else {
            // check any order containing product
            const orders = await Order.find({ user_id: userId }).lean();
            for (const o of orders) {
              const it = await OrderItem.findOne({ order_id: o._id, product_id: pid }).lean();
              if (it) { verified = true; break; }
            }
          }
        }
      } catch {}
      if (existing) {
        existing.rating = r;
        if (title !== undefined) existing.title = title || null;
        if (body !== undefined) existing.body = body || null;
        existing.verified = verified;
        await existing.save();
      } else {
        await Review.create({ user_id: userId, module: 'product', target_id: pid, rating: r, title: title || null, body: body || null, verified });
      }
      const stats = await recalcProductRating(pid);
      return { rating: r, verified, ...stats };
    }
    // SQLite
    const pid = Number(productId);
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(pid);
    if (!product) throw new Error('Product not found');
    const existing = db.prepare('SELECT id FROM reviews WHERE module = ? AND target_id = ? AND user_id = ?').get('product', pid, userId);
    // verified = has delivered/paid order containing product
    let verified = 0;
    try {
      const has = db.prepare(`SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.user_id = ? AND oi.product_id = ? LIMIT 1`).get(userId, pid);
      if (has) verified = 1;
    } catch {}
    if (existing) {
      db.prepare('UPDATE reviews SET rating = ?, title = COALESCE(?, title), body = COALESCE(?, body), verified = ? WHERE id = ?').run(r, title || null, body || null, verified, existing.id);
      // if title/body were provided, ensure they overwrite
      if (title !== undefined) db.prepare('UPDATE reviews SET title = ? WHERE id = ?').run(title || null, existing.id);
      if (body !== undefined) db.prepare('UPDATE reviews SET body = ? WHERE id = ?').run(body || null, existing.id);
      db.prepare('UPDATE reviews SET rating = ? WHERE id = ?').run(r, existing.id);
    } else {
      db.prepare('INSERT INTO reviews (user_id, module, target_id, rating, title, body, verified) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, 'product', pid, r, title || null, body || null, verified);
    }
    const stats = await recalcProductRating(pid);
    return { rating: r, verified: !!verified, ...stats };
  },

  async deleteReview({ productId, userId, reviewId }) {
    if (useMongo()) {
      const { Review } = await import('../models/index.js');
      let pid = productId;
      try {
        const mongoose = (await import('mongoose')).default;
        if (mongoose.Types.ObjectId.isValid(String(productId))) pid = new mongoose.Types.ObjectId(String(productId));
      } catch {}
      const review = await Review.findOne({ _id: reviewId, target_id: pid, user_id: userId });
      if (!review) throw new Error('Not found');
      await Review.deleteOne({ _id: reviewId });
      const stats = await recalcProductRating(pid);
      return stats;
    }
    const pid = Number(productId);
    const review = db.prepare('SELECT id FROM reviews WHERE id = ? AND target_id = ? AND user_id = ?').get(Number(reviewId), pid, userId);
    if (!review) throw new Error('Not found');
    db.prepare('DELETE FROM reviews WHERE id = ?').run(Number(reviewId));
    const stats = await recalcProductRating(pid);
    return stats;
  }
};

export { recalcProductRating };
