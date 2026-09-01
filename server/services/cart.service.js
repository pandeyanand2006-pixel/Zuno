import { db } from '../config/db.js';
import { serializeProduct } from '../services/product.service.js';

function getOrCreateCart(userId, module) {
  let cart = db.prepare('SELECT * FROM carts WHERE user_id = ? AND module = ?').get(userId, module);
  if (!cart) {
    const info = db.prepare('INSERT INTO carts (user_id, module) VALUES (?, ?)').run(userId, module);
    cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(info.lastInsertRowid);
  }
  return cart;
}

export const cartService = {
  view(userId, module = 'shop') {
    const cart = getOrCreateCart(userId, module);
    const items = db
      .prepare(
        `SELECT ci.*, p.name, p.slug, p.price, p.mrp, p.stock, p.images, p.module
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
         WHERE ci.cart_id = ?`
      )
      .all(cart.id);
    let subtotal = 0;
    const detailed = items.map((i) => {
      const lineTotal = i.price * i.quantity;
      subtotal += lineTotal;
      const images = i.images ? JSON.parse(i.images) : [];
      return {
        id: i.id, productId: i.product_id, name: i.name, slug: i.slug,
        price: i.price, mrp: i.mrp, quantity: i.quantity, lineTotal,
        image: images[0] || null, stock: i.stock, available: i.stock > 0,
      };
    });
    return { module, items: detailed, subtotal, count: detailed.reduce((a, b) => a + b.quantity, 0) };
  },

  add(userId, module, productId, quantity = 1) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) throw new Error('NOT_FOUND');
    if (product.stock < quantity) throw new Error('OUT_OF_STOCK');
    const cart = getOrCreateCart(userId, module);
    const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cart.id, productId);
    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)').run(cart.id, productId, quantity);
    }
    db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cart.id);
    return this.view(userId, module);
  },

  updateQty(userId, module, productId, quantity) {
    const cart = getOrCreateCart(userId, module);
    if (quantity <= 0) {
      db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cart.id, productId);
    } else {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?').run(quantity, cart.id, productId);
    }
    return this.view(userId, module);
  },

  remove(userId, module, productId) {
    const cart = getOrCreateCart(userId, module);
    db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cart.id, productId);
    return this.view(userId, module);
  },

  clear(userId, module) {
    const cart = getOrCreateCart(userId, module);
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
    return this.view(userId, module);
  },

  summary(userId) {
    const modules = ['shop', 'grocery', 'food'];
    const out = {};
    for (const m of modules) out[m] = this.view(userId, m);
    return out;
  },
};

export { serializeProduct };
