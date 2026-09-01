import { db } from '../config/db.js';
import { generateOrderNumber } from '../utils/id.js';
import { ok, fail } from '../utils/response.js';

const TAX_RATE = 0.05;       // GST proxy (configurable)
const DELIVERY_FEE = 0;      // free delivery baseline; module can override
const SERVICE_FEE = 0;

export const couponService = {
  validate(code, module, subtotal, userId) {
    if (!code) return { valid: false };
    const c = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code);
    if (!c) return { valid: false, message: 'Coupon not found' };
    if (c.module && c.module !== module) return { valid: false, message: 'Coupon not applicable to this category' };
    if (c.min_order && subtotal < c.min_order) return { valid: false, message: `Minimum order ₹${(c.min_order/100).toFixed(0)} required` };
    if (c.expires_at && new Date(c.expires_at) < new Date()) return { valid: false, message: 'Coupon expired' };
    if (c.usage_limit && c.used_count >= c.usage_limit) return { valid: false, message: 'Coupon usage exhausted' };

    let discount = 0;
    if (c.type === 'percent') discount = Math.round(subtotal * (c.value / 100));
    else discount = c.value;
    if (c.max_discount) discount = Math.min(discount, c.max_discount);
    discount = Math.min(discount, subtotal);
    return { valid: true, discount, coupon: c };
  },
};

export const orderService = {
  computeTotals({ module, subtotal, couponCode, userId }) {
    const coupon = couponService.validate(couponCode || null, module, subtotal, userId);
    const discount = coupon.valid ? coupon.discount : 0;
    const deliveryFee = DELIVERY_FEE;
    const serviceFee = SERVICE_FEE;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * TAX_RATE);
    const total = taxable + deliveryFee + serviceFee + tax;
    return { subtotal, discount, deliveryFee, serviceFee, tax, total, couponValid: coupon.valid, couponMessage: coupon.valid ? null : (coupon.message || null) };
  },

  createFromCart({ userId, module, addressId, couponCode, items }) {
    if (!items || items.length === 0) throw new Error('EMPTY_CART');
    const subtotal = items.reduce((a, b) => a + b.lineTotal, 0);
    const totals = this.computeTotals({ module, subtotal, couponCode, userId });
    if (couponCode && !totals.couponValid) throw new Error('INVALID_COUPON');

    const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addressId, userId);
    if (!address) throw new Error('ADDRESS_REQUIRED');

    const orderNumber = generateOrderNumber(module === 'grocery' ? 'ZNG' : module === 'food' ? 'ZNF' : 'ZN');

    const tx = () => {
      db.exec('BEGIN');
      try {
        const info = db
          .prepare(
            `INSERT INTO orders (order_number, user_id, module, status, subtotal, discount, delivery_fee, service_fee, tax, total, address_id, coupon_code, restaurant_id)
             VALUES (?, ?, ?, 'PAYMENT_PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(orderNumber, userId, module, totals.subtotal, totals.discount, totals.deliveryFee, totals.serviceFee, totals.tax, totals.total, addressId, couponCode || null, null);

        const orderId = info.lastInsertRowid;
        for (const it of items) {
          db.prepare('INSERT INTO order_items (order_id, product_id, name, price, quantity, customization_data, variant_data, custom_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(orderId, it.productId, it.name, it.price, it.quantity, it.customization ? JSON.stringify(it.customization) : null, it.variant ? JSON.stringify(it.variant) : null, it.isCustom ? it.price : null);
          db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(it.quantity, it.productId, it.quantity);
        }
        if (couponCode && totals.couponValid) {
          db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(couponCode);
        }
        db.exec('COMMIT');
        return orderId;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    };
    const orderId = tx();
    return { orderId, orderNumber, total: totals.total, totals };
  },

  markPaid(orderId, paymentId) {
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE payments SET status = 'captured', verified = 1, updated_at = datetime('now') WHERE id = ?").run(paymentId);
      db.prepare("UPDATE orders SET status = 'PAID', payment_id = ?, updated_at = datetime('now') WHERE id = ?").run(paymentId, orderId);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'order', 'Payment successful', ?)")
        .run(order.user_id, `Payment received for order ${order.order_number}`);
      db.exec('COMMIT');
      return order;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },

  getForUser(userId, { status, module } = {}) {
    const clauses = ['user_id = ?'];
    const params = [userId];
    if (status) { clauses.push('status = ?'); params.push(status); }
    if (module) { clauses.push('module = ?'); params.push(module); }
    const orders = db.prepare(`SELECT * FROM orders WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`).all(...params);
    return orders.map((o) => this.enrich(o));
  },

  getDetail(userId, orderId) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
    if (!order) return null;
    return this.enrich(order, true);
  },

  enrich(order, withItems = false) {
    const out = { ...order, totals: { subtotal: order.subtotal, discount: order.discount, deliveryFee: order.delivery_fee, serviceFee: order.service_fee, tax: order.tax, total: order.total } };
    if (withItems) {
      const rawItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      out.items = rawItems.map((it) => ({
        ...it,
        customization: it.customization_data ? JSON.parse(it.customization_data) : null,
        variant: it.variant_data ? JSON.parse(it.variant_data) : null,
        isCustom: !!it.customization_data,
      }));
      out.address = db.prepare('SELECT * FROM addresses WHERE id = ?').get(order.address_id);
      out.payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id);
    }
    return out;
  },

  // Secure custom-order path (food menu items etc.). Prices are ALWAYS resolved server-side.
  createCustom({ userId, module, addressId, couponCode, items }) {
    if (!items || !items.length) throw new Error('EMPTY_CART');
    const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addressId, userId);
    if (!address) throw new Error('ADDRESS_REQUIRED');

    const resolved = [];
    for (const it of items) {
      let row = null, name = '', price = 0, stock = Infinity;
      if (it.type === 'menu') {
        row = db.prepare('SELECT id, name, price, available FROM menu_items WHERE id = ?').get(it.id);
        if (!row || !row.available) throw new Error('ITEM_UNAVAILABLE');
        name = row.name; price = row.price;
      } else {
        row = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ? AND active = 1').get(it.id);
        if (!row) throw new Error('ITEM_UNAVAILABLE');
        name = row.name; price = row.price; stock = row.stock;
      }
      const qty = Math.max(1, Math.min(20, Math.floor(it.quantity) || 1));
      if (stock < qty) throw new Error('OUT_OF_STOCK');
      resolved.push({ ref: it.id, type: it.type, name, price, quantity: qty, lineTotal: price * qty });
    }

    const subtotal = resolved.reduce((a, b) => a + b.lineTotal, 0);
    const totals = this.computeTotals({ module, subtotal, couponCode, userId });
    if (couponCode && !totals.couponValid) throw new Error('INVALID_COUPON');

    // Resolve owning restaurant for food orders (all menu items belong to one restaurant).
    let restaurantId = null;
    if (module === 'food') {
      const menuRef = resolved.find((r) => r.type === 'menu');
      if (menuRef) {
        const mi = db.prepare('SELECT restaurant_id FROM menu_items WHERE id = ?').get(menuRef.ref);
        restaurantId = mi ? mi.restaurant_id : null;
      }
    }

    const orderNumber = generateOrderNumber(module === 'grocery' ? 'ZNG' : module === 'food' ? 'ZNF' : 'ZN');
    const tx = () => {
      db.exec('BEGIN');
      try {
        const info = db.prepare('INSERT INTO orders (order_number, user_id, module, status, subtotal, discount, delivery_fee, service_fee, tax, total, address_id, coupon_code, restaurant_id) VALUES (?, ?, ?, \'PAYMENT_PENDING\', ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(orderNumber, userId, module, totals.subtotal, totals.discount, totals.deliveryFee, totals.serviceFee, totals.tax, totals.total, addressId, couponCode || null, restaurantId);
        const orderId = info.lastInsertRowid;
        for (const r of resolved) {
          db.prepare('INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)')
            .run(orderId, r.type === 'menu' ? null : r.ref, r.name, r.price, r.quantity);
          if (r.type !== 'menu') db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(r.quantity, r.ref, r.quantity);
        }
        if (couponCode && totals.couponValid) db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(couponCode);
        db.exec('COMMIT');
        return orderId;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    };
    const orderId = tx();
    return { orderId, orderNumber, total: totals.total, totals };
  },

  cancel(userId, orderId) {    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
    if (!order) throw new Error('NOT_FOUND');
    if (!['PAID', 'CONFIRMED', 'PROCESSING'].includes(order.status)) throw new Error('CANNOT_CANCEL');
    db.prepare("UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(orderId);
    // restock
    db.prepare('UPDATE order_items oi SET oi.quantity = oi.quantity WHERE 1=1');
    db.prepare(`UPDATE products p SET p.stock = p.stock + (
      SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = ? AND product_id = p.id
    ) WHERE p.id IN (SELECT product_id FROM order_items WHERE order_id = ?)`).run(orderId, orderId);
    return order;
  },

  updateStatus(orderId, status) {
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, orderId);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  },
};

export { TAX_RATE };
