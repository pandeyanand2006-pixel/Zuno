import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { serializeProduct } from '../services/product.service.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

function getOrCreateCartSQLite(userId, module) {
  let cart = db.prepare('SELECT * FROM carts WHERE user_id = ? AND module = ?').get(userId, module);
  if (!cart) {
    try {
      const info = db.prepare('INSERT INTO carts (user_id, module) VALUES (?, ?)').run(userId, module);
      cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(info.lastInsertRowid);
    } catch (e) {
      if (e.message?.includes('FOREIGN KEY')) {
        db.exec('PRAGMA foreign_keys = OFF');
        try {
          const info = db.prepare('INSERT INTO carts (user_id, module) VALUES (?, ?)').run(userId, module);
          cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(info.lastInsertRowid);
        } finally {
          db.exec('PRAGMA foreign_keys = ON');
        }
      } else throw e;
    }
  }
  return cart;
}

async function getOrCreateCartMongo(userId, module) {
  const { Cart } = await import('../models/index.js');
  let cart = await Cart.findOne({ user_id: userId, module });
  if (!cart) {
    cart = await Cart.create({ user_id: userId, module });
  }
  return cart;
}

export const cartService = {
  async view(userId, module = 'shop') {
    if (useMongo()) {
      const { Cart, CartItem, Product } = await import('../models/index.js');
      const cart = await getOrCreateCartMongo(userId, module);
      const items = await CartItem.find({ cart_id: cart._id }).lean();
      let subtotal = 0;
      const detailed = [];
      for (const ci of items) {
        let prod = null;
        try { prod = await Product.findById(ci.product_id).lean(); } catch { prod = null; }
        if (!prod) continue;
        const customization = ci.customization_data ? JSON.parse(ci.customization_data) : null;
        const variant = ci.variant_data ? JSON.parse(ci.variant_data) : null;
        const customPrice = ci.custom_price || null;
        const unitPrice = customPrice || prod.price;
        const lineTotal = unitPrice * ci.quantity;
        subtotal += lineTotal;
        const images = Array.isArray(prod.images) ? prod.images : [];
        detailed.push({
          id: String(ci._id), productId: String(ci.product_id), name: prod.name, slug: prod.slug,
          price: unitPrice, basePrice: prod.price, mrp: prod.mrp, quantity: ci.quantity, lineTotal,
          image: images[0] || null, stock: prod.stock, available: prod.stock > 0,
          customization, variant, isCustom: !!customization,
        });
      }
      return { module, items: detailed, subtotal, count: detailed.reduce((a, b) => a + b.quantity, 0) };
    }
    const cart = getOrCreateCartSQLite(userId, module);
    const items = db
      .prepare(
        `SELECT ci.*, p.name, p.slug, p.price, p.mrp, p.stock, p.images, p.module
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
         WHERE ci.cart_id = ?`
      )
      .all(cart.id);
    let subtotal = 0;
    const detailed = items.map((i) => {
      const customization = i.customization_data ? JSON.parse(i.customization_data) : null;
      const variant = i.variant_data ? JSON.parse(i.variant_data) : null;
      const customPrice = i.custom_price || null;
      const unitPrice = customPrice || i.price;
      const lineTotal = unitPrice * i.quantity;
      subtotal += lineTotal;
      const images = i.images ? JSON.parse(i.images) : [];
      return {
        id: i.id, productId: i.product_id, name: i.name, slug: i.slug,
        price: unitPrice, basePrice: i.price, mrp: i.mrp, quantity: i.quantity, lineTotal,
        image: images[0] || null, stock: i.stock, available: i.stock > 0,
        customization, variant, isCustom: !!customization,
      };
    });
    return { module, items: detailed, subtotal, count: detailed.reduce((a, b) => a + b.quantity, 0) };
  },

  async addCustom(userId, module, productId, quantity = 1, customizationData, variantData, customPrice = null) {
    if (useMongo()) {
      const { Product, Cart, CartItem } = await import('../models/index.js');
      const product = await Product.findById(productId);
      if (!product || !product.active) throw new Error('NOT_FOUND');
      if (!customPrice) {
        try {
          const data = JSON.parse(customizationData);
          let extra = 0;
          const ef = Number(product.customExtraFront ?? product.custom_extra_front ?? 10000);
          const eb = Number(product.customExtraBack ?? product.custom_extra_back ?? 10000);
          if (data.front?.elements?.length) extra += ef;
          if (data.back?.elements?.length) extra += eb;
          customPrice = product.price + extra;
        } catch { customPrice = product.price; }
      }
      const cart = await getOrCreateCartMongo(userId, module);
      await CartItem.create({ cart_id: cart._id, product_id: productId, quantity, customization_data: customizationData, variant_data: variantData, custom_price: customPrice });
      await Cart.updateOne({ _id: cart._id }, { updatedAt: new Date() });
      return this.view(userId, module);
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) throw new Error('NOT_FOUND');
    if (!customPrice) {
      try {
        const data = JSON.parse(customizationData);
        let extra = 0;
        const ef = Number(product.custom_extra_front ?? 10000);
        const eb = Number(product.custom_extra_back ?? 10000);
        if (data.front?.elements?.length) extra += ef;
        if (data.back?.elements?.length) extra += eb;
        customPrice = product.price + extra;
      } catch { customPrice = product.price; }
    }
    const cart = getOrCreateCartSQLite(userId, module);
    db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity, customization_data, variant_data, custom_price) VALUES (?, ?, ?, ?, ?, ?)')
      .run(cart.id, productId, quantity, customizationData, variantData, customPrice);
    db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cart.id);
    return this.view(userId, module);
  },

  async add(userId, module, productId, quantity = 1, variant = null) {
    if (useMongo()) {
      const { Product, ProductVariant, Cart, CartItem } = await import('../models/index.js');
      const product = await Product.findById(productId);
      if (!product || !product.active) throw new Error('NOT_FOUND');
      let variantData = null;
      let variantRow = null;
      if (variant && (variant.color || variant.size)) {
        const color = variant.color || null;
        const size = variant.size || null;
        if (color && size) {
          variantRow = await ProductVariant.findOne({ product_id: productId, color, size });
          if (!variantRow) throw new Error('VARIANT_NOT_FOUND');
          if (variantRow.stock < quantity) throw new Error('OUT_OF_STOCK');
        } else if (color) {
          variantRow = await ProductVariant.findOne({ product_id: productId, color });
        } else if (size) {
          variantRow = await ProductVariant.findOne({ product_id: productId, size });
        }
        variantData = JSON.stringify({ color: color || null, size: size || null, sku: variantRow ? variantRow.sku : null });
      } else {
        if (product.stock < quantity) throw new Error('OUT_OF_STOCK');
      }
      const cart = await getOrCreateCartMongo(userId, module);
      let existing = null;
      if (variantData) {
        existing = await CartItem.findOne({ cart_id: cart._id, product_id: productId, variant_data: variantData });
      } else {
        existing = await CartItem.findOne({ cart_id: cart._id, product_id: productId, variant_data: { $in: [null, ''] } });
        if (!existing) existing = await CartItem.findOne({ cart_id: cart._id, product_id: productId, variant_data: null });
      }
      if (existing) {
        existing.quantity += quantity;
        await existing.save();
      } else {
        await CartItem.create({ cart_id: cart._id, product_id: productId, quantity, variant_data: variantData });
      }
      return this.view(userId, module);
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!product) throw new Error('NOT_FOUND');
    let variantData = null;
    let variantRow = null;
    if (variant && (variant.color || variant.size)) {
      const color = variant.color || null;
      const size = variant.size || null;
      if (color && size) {
        variantRow = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND color = ? AND size = ?').get(productId, color, size);
        if (!variantRow) throw new Error('VARIANT_NOT_FOUND');
        if (variantRow.stock < quantity) throw new Error('OUT_OF_STOCK');
      } else if (color) {
        variantRow = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND color = ? LIMIT 1').get(productId, color);
      } else if (size) {
        variantRow = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND size = ? LIMIT 1').get(productId, size);
      }
      variantData = JSON.stringify({ color: color || null, size: size || null, sku: variantRow ? variantRow.sku : null });
    } else {
      if (product.stock < quantity) throw new Error('OUT_OF_STOCK');
    }
    const cart = getOrCreateCartSQLite(userId, module);
    let existing = null;
    if (variantData) {
      existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_data = ?').get(cart.id, productId, variantData);
    } else {
      existing = db.prepare("SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND (variant_data IS NULL OR variant_data = '')").get(cart.id, productId);
    }
    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity, variant_data) VALUES (?, ?, ?, ?)').run(cart.id, productId, quantity, variantData);
    }
    db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cart.id);
    return this.view(userId, module);
  },

  async updateQty(userId, module, productId, quantity) {
    if (useMongo()) {
      const { CartItem } = await import('../models/index.js');
      const cart = await getOrCreateCartMongo(userId, module);
      if (quantity <= 0) {
        await CartItem.deleteMany({ cart_id: cart._id, product_id: productId });
      } else {
        await CartItem.updateMany({ cart_id: cart._id, product_id: productId }, { quantity });
      }
      return this.view(userId, module);
    }
    const cart = getOrCreateCartSQLite(userId, module);
    if (quantity <= 0) {
      db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cart.id, productId);
    } else {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?').run(quantity, cart.id, productId);
    }
    return this.view(userId, module);
  },

  async remove(userId, module, productId) {
    if (useMongo()) {
      const { CartItem } = await import('../models/index.js');
      const cart = await getOrCreateCartMongo(userId, module);
      await CartItem.deleteMany({ cart_id: cart._id, product_id: productId });
      return this.view(userId, module);
    }
    const cart = getOrCreateCartSQLite(userId, module);
    db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cart.id, productId);
    return this.view(userId, module);
  },

  async clear(userId, module) {
    if (useMongo()) {
      const { CartItem } = await import('../models/index.js');
      const cart = await getOrCreateCartMongo(userId, module);
      await CartItem.deleteMany({ cart_id: cart._id });
      return this.view(userId, module);
    }
    const cart = getOrCreateCartSQLite(userId, module);
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
    return this.view(userId, module);
  },

  async summary(userId) {
    const modules = ['shop', 'grocery', 'food'];
    const out = {};
    for (const m of modules) out[m] = await this.view(userId, m);
    return out;
  },
};

export { serializeProduct };
