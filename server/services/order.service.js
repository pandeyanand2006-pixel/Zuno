import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { generateOrderNumber } from '../utils/id.js';
import { ok, fail } from '../utils/response.js';

const TAX_RATE = 0.05;
const DELIVERY_FEE = 0;
const SERVICE_FEE = 0;

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

export const couponService = {
  async validate(code, module, subtotal, userId) {
    if (!code) return { valid: false };
    if (useMongo()) {
      const { Coupon } = await import('../models/index.js');
      const c = await Coupon.findOne({ code, active: true }).lean();
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
    }
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
  async computeTotals({ module, subtotal, couponCode, userId }) {
    const coupon = await couponService.validate(couponCode || null, module, subtotal, userId);
    const discount = coupon.valid ? coupon.discount : 0;
    const deliveryFee = DELIVERY_FEE;
    const serviceFee = SERVICE_FEE;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * TAX_RATE);
    const total = taxable + deliveryFee + serviceFee + tax;
    return { subtotal, discount, deliveryFee, serviceFee, tax, total, couponValid: coupon.valid, couponMessage: coupon.valid ? null : (coupon.message || null) };
  },

  _logStatus(orderId, from, to, changedBy = null, note = null) {
    try { db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)').run(orderId, from, to, changedBy, note); } catch {}
  },

  async createFromCart({ userId, module, addressId, couponCode, items, customerNotes = null }) {
    if (!items || items.length === 0) throw new Error('EMPTY_CART');
    const subtotal = items.reduce((a, b) => a + b.lineTotal, 0);
    const totals = await this.computeTotals({ module, subtotal, couponCode, userId });
    if (couponCode && !totals.couponValid) throw new Error('INVALID_COUPON');

    if (useMongo()) {
      const { Address, Order, OrderItem, Product, Coupon, OrderStatusHistory, Notification } = await import('../models/index.js');
      const address = await Address.findOne({ _id: addressId, user_id: userId });
      if (!address) throw new Error('ADDRESS_REQUIRED');
      const orderNumber = 'ZNO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Date.now()).slice(-6);
      const order = await Order.create({
        order_number: orderNumber, user_id: userId, module, status: 'PAYMENT_PENDING',
        subtotal: totals.subtotal, discount: totals.discount, delivery_fee: totals.deliveryFee, service_fee: totals.serviceFee, tax: totals.tax, total: totals.total,
        address_id: addressId, coupon_code: couponCode || null, customer_notes: customerNotes || null
      });
      for (const it of items) {
        await OrderItem.create({
          order_id: order._id, product_id: it.productId, name: it.name, price: it.price, quantity: it.quantity,
          customization_data: it.customization ? JSON.stringify(it.customization) : null,
          variant_data: it.variant ? JSON.stringify(it.variant) : null,
          custom_price: it.isCustom ? it.price : null
        });
        await Product.updateOne({ _id: it.productId }, { $inc: { stock: -it.quantity } });
      }
      await OrderStatusHistory.create({ order_id: order._id, from_status: null, to_status: 'PAYMENT_PENDING', changed_by: userId, note: 'Order placed' });
      if (couponCode && totals.couponValid) await Coupon.updateOne({ code: couponCode }, { $inc: { used_count: 1 } });
      try { await Notification.create({ user_id: userId, type: 'order', title: 'Order placed', body: `Order ${orderNumber} placed` }); } catch {}
      return { orderId: String(order._id), orderNumber, total: totals.total, totals };
    }

    const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addressId, userId);
    if (!address) throw new Error('ADDRESS_REQUIRED');
    const orderNumber = 'ZNO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Date.now()).slice(-6);
    const tx = () => {
      db.exec('BEGIN');
      try {
        const info = db
          .prepare(
            `INSERT INTO orders (order_number, user_id, module, status, subtotal, discount, delivery_fee, service_fee, tax, total, address_id, coupon_code, restaurant_id, customer_notes)
             VALUES (?, ?, ?, 'PAYMENT_PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(orderNumber, userId, module, totals.subtotal, totals.discount, totals.deliveryFee, totals.serviceFee, totals.tax, totals.total, addressId, couponCode || null, null, customerNotes || null);
        const orderId = info.lastInsertRowid;
        for (const it of items) {
          db.prepare('INSERT INTO order_items (order_id, product_id, name, price, quantity, customization_data, variant_data, custom_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(orderId, it.productId, it.name, it.price, it.quantity, it.customization ? JSON.stringify(it.customization) : null, it.variant ? JSON.stringify(it.variant) : null, it.isCustom ? it.price : null);
          db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(it.quantity, it.productId, it.quantity);
        }
        db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)').run(orderId, null, 'PAYMENT_PENDING', userId, 'Order placed');
        if (couponCode && totals.couponValid) {
          db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(couponCode);
        }
        try { db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'order', 'Order placed', ?)").run(userId, `Order ${orderNumber} placed`); } catch {}
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

  async markPaid(orderId, paymentId) {
    if (useMongo()) {
      const { Order, Payment, OrderStatusHistory, Notification } = await import('../models/index.js');
      const order = await Order.findById(orderId);
      if (!order) throw new Error('NOT_FOUND');
      const prev = order.status;
      await Payment.updateOne({ _id: paymentId }, { status: 'captured', verified: true });
      order.status = 'PAID';
      order.payment_id = paymentId;
      await order.save();
      await OrderStatusHistory.create({ order_id: orderId, from_status: prev, to_status: 'PAID', changed_by: order.user_id, note: 'Payment verified' });
      try { await Notification.create({ user_id: order.user_id, type: 'order', title: 'Payment successful', body: `Payment received for order ${order.order_number}` }); } catch {}
      return order;
    }
    const prev = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE payments SET status = 'captured', verified = 1, updated_at = datetime('now') WHERE id = ?").run(paymentId);
      db.prepare("UPDATE orders SET status = 'PAID', payment_id = ?, updated_at = datetime('now') WHERE id = ?").run(paymentId, orderId);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)').run(orderId, prev ? prev.status : null, 'PAID', order.user_id, 'Payment verified');
      db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'order', 'Payment successful', ?)")
        .run(order.user_id, `Payment received for order ${order.order_number}`);
      try { db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'order', 'Order confirmed', ?)").run(order.user_id, `Order ${order.order_number} confirmed — printing will start soon`); } catch {}
      db.exec('COMMIT');
      return order;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },

  async getForUser(userId, { status, module } = {}) {
    if (useMongo()) {
      const { Order } = await import('../models/index.js');
      const filter = { user_id: userId };
      if (status) filter.status = status;
      if (module) filter.module = module;
      const orders = await Order.find(filter).sort({ created_at: -1 }).lean();
      return Promise.all(orders.map(o => this.enrich(o)));
    }
    const clauses = ['user_id = ?'];
    const params = [userId];
    if (status) { clauses.push('status = ?'); params.push(status); }
    if (module) { clauses.push('module = ?'); params.push(module); }
    const orders = db.prepare(`SELECT * FROM orders WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`).all(...params);
    return Promise.all(orders.map((o) => this.enrich(o)));
  },

  async getDetail(userId, orderId) {
    if (useMongo()) {
      const { Order } = await import('../models/index.js');
      const order = await Order.findOne({ _id: orderId, user_id: userId }).lean();
      if (!order) return null;
      return this.enrich(order, true);
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
    if (!order) return null;
    return this.enrich(order, true);
  },

  async enrich(order, withItems = false) {
    const oid = order._id || order.id;
    const isMongo = !!order._id;
    if (isMongo || useMongo()) {
      const { OrderItem, Address, Payment, OrderStatusHistory, User } = await import('../models/index.js');
      const out = { ...order, id: String(oid), totals: { subtotal: order.subtotal, discount: order.discount, deliveryFee: order.delivery_fee, serviceFee: order.service_fee, tax: order.tax, total: order.total } };
      if (withItems) {
        const rawItems = await OrderItem.find({ order_id: oid }).lean();
        out.items = rawItems.map((it) => ({
          ...it,
          id: String(it._id),
          customization: it.customization_data ? JSON.parse(it.customization_data) : null,
          variant: it.variant_data ? JSON.parse(it.variant_data) : null,
          isCustom: !!it.customization_data,
        }));
        out.address = order.address_id ? await Address.findById(order.address_id).lean() : null;
        out.payment = await Payment.findOne({ order_id: oid }).lean();
        out.history = await this.getHistory(oid);
        out.customer = await User.findById(order.user_id).lean().then(u => u ? { id: String(u._id), name: u.name, email: u.email, mobile: u.mobile } : null);
      }
      return out;
    }
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
      out.history = await this.getHistory(order.id);
      out.customer = db.prepare('SELECT id, name, email, mobile FROM users WHERE id = ?').get(order.user_id);
    }
    return out;
  },

  async createCustom({ userId, module, addressId, couponCode, items }) {
    if (!items || !items.length) throw new Error('EMPTY_CART');
    if (useMongo()) {
      const { Address, Product, Order, OrderItem, Coupon } = await import('../models/index.js');
      const address = await Address.findOne({ _id: addressId, user_id: userId });
      if (!address) throw new Error('ADDRESS_REQUIRED');
      const resolved = [];
      for (const it of items) {
        let row = null, name = '', price = 0, stock = Infinity;
        if (it.type === 'menu') throw new Error('ITEM_UNAVAILABLE');
        else {
          row = await Product.findById(it.id);
          if (!row || !row.active) throw new Error('ITEM_UNAVAILABLE');
          name = row.name; price = row.price; stock = row.stock;
        }
        const qty = Math.max(1, Math.min(20, Math.floor(it.quantity) || 1));
        if (stock < qty) throw new Error('OUT_OF_STOCK');
        resolved.push({ ref: it.id, type: it.type, name, price, quantity: qty, lineTotal: price * qty });
      }
      const subtotal = resolved.reduce((a, b) => a + b.lineTotal, 0);
      const totals = await this.computeTotals({ module, subtotal, couponCode, userId });
      if (couponCode && !totals.couponValid) throw new Error('INVALID_COUPON');
      const orderNumber = generateOrderNumber(module === 'grocery' ? 'ZNG' : module === 'food' ? 'ZNF' : 'ZN');
      const order = await Order.create({
        order_number: orderNumber, user_id: userId, module, status: 'PAYMENT_PENDING',
        subtotal: totals.subtotal, discount: totals.discount, delivery_fee: totals.deliveryFee, service_fee: totals.serviceFee, tax: totals.tax, total: totals.total,
        address_id: addressId, coupon_code: couponCode || null
      });
      for (const r of resolved) {
        await OrderItem.create({ order_id: order._id, product_id: r.type === 'menu' ? null : r.ref, name: r.name, price: r.price, quantity: r.quantity });
        if (r.type !== 'menu') await Product.updateOne({ _id: r.ref }, { $inc: { stock: -r.quantity } });
      }
      if (couponCode && totals.couponValid) await Coupon.updateOne({ code: couponCode }, { $inc: { used_count: 1 } });
      return { orderId: String(order._id), orderNumber, total: totals.total, totals };
    }
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
    const totals = await this.computeTotals({ module, subtotal, couponCode, userId });
    if (couponCode && !totals.couponValid) throw new Error('INVALID_COUPON');
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

  async cancel(userId, orderId) {
    if (useMongo()) {
      const { Order, OrderStatusHistory, Notification, OrderItem, Product } = await import('../models/index.js');
      const order = await Order.findOne({ _id: orderId, user_id: userId });
      if (!order) throw new Error('NOT_FOUND');
      if (!['PAID', 'CONFIRMED', 'PROCESSING', 'PRINTING', 'QUALITY_CHECK', 'PACKED'].includes(order.status)) throw new Error('CANNOT_CANCEL');
      const prev = order.status;
      order.status = 'CANCELLED';
      await order.save();
      await OrderStatusHistory.create({ order_id: orderId, from_status: prev, to_status: 'CANCELLED', changed_by: userId, note: 'Cancelled by customer' });
      try { await Notification.create({ user_id: order.user_id, type: 'order', title: 'Order cancelled', body: `Order ${order.order_number} cancelled` }); } catch {}
      const items = await OrderItem.find({ order_id: orderId, product_id: { $ne: null } });
      for (const it of items) await Product.updateOne({ _id: it.product_id }, { $inc: { stock: it.quantity } });
      return order;
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
    if (!order) throw new Error('NOT_FOUND');
    if (!['PAID', 'CONFIRMED', 'PROCESSING', 'PRINTING', 'QUALITY_CHECK', 'PACKED'].includes(order.status)) throw new Error('CANNOT_CANCEL');
    const prev = order.status;
    db.prepare("UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(orderId);
    db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)').run(orderId, prev, 'CANCELLED', userId, 'Cancelled by customer');
    try { db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'order', 'Order cancelled', ?)").run(order.user_id, `Order ${order.order_number} cancelled`); } catch {}
    db.prepare(`UPDATE products p SET p.stock = p.stock + (
      SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = ? AND product_id = p.id
    ) WHERE p.id IN (SELECT product_id FROM order_items WHERE order_id = ?)`).run(orderId, orderId);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  },

  _validTransitions: {
    PAYMENT_PENDING: ['PAID', 'CANCELLED'],
    PAID: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'PRINTING', 'CANCELLED'],
    PROCESSING: ['PRINTING', 'CANCELLED'],
    PRINTING: ['QUALITY_CHECK', 'CANCELLED'],
    QUALITY_CHECK: ['PACKED', 'CANCELLED'],
    PACKED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
    CREATED: ['PAYMENT_PENDING', 'PAID', 'CANCELLED'],
  },
  isValidTransition(from, to) {
    if (!from) return true;
    if (from === to) return false;
    const allowed = this._validTransitions[from] || [];
    return allowed.includes(to);
  },

  async updateStatus(orderId, status, changedBy = null, note = null) {
    if (useMongo()) {
      const { Order, OrderStatusHistory, Notification, OrderItem, Product } = await import('../models/index.js');
      const order = await Order.findById(orderId);
      if (!order) throw new Error('NOT_FOUND');
      if (!this.isValidTransition(order.status, status)) {
        throw new Error(`INVALID_TRANSITION: cannot move from ${order.status} to ${status}`);
      }
      const prev = order.status;
      order.status = status;
      await order.save();
      await OrderStatusHistory.create({ order_id: orderId, from_status: prev, to_status: status, changed_by: changedBy, note });
      const titles = { CONFIRMED: 'Order confirmed', PRINTING: 'Your design is being printed', QUALITY_CHECK: 'Quality check', PACKED: 'Order packed', SHIPPED: 'Order shipped', OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Order cancelled' };
      if (titles[status]) try { await Notification.create({ user_id: order.user_id, type: 'order', title: titles[status], body: `Order ${order.order_number} — ${titles[status].toLowerCase()}` }); } catch {}
      if (status === 'CANCELLED' && prev !== 'CANCELLED') {
        const items = await OrderItem.find({ order_id: orderId, product_id: { $ne: null } });
        for (const it of items) await Product.updateOne({ _id: it.product_id }, { $inc: { stock: it.quantity } });
      }
      return order;
    }
    const prev = db.prepare('SELECT status, user_id, order_number FROM orders WHERE id = ?').get(orderId);
    if (!prev) throw new Error('NOT_FOUND');
    if (!this.isValidTransition(prev.status, status)) {
      throw new Error(`INVALID_TRANSITION: cannot move from ${prev.status} to ${status}`);
    }
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, orderId);
    db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)').run(orderId, prev ? prev.status : null, status, changedBy, note);
    if (prev) {
      const titles = { CONFIRMED: 'Order confirmed', PRINTING: 'Your design is being printed', QUALITY_CHECK: 'Quality check', PACKED: 'Order packed', SHIPPED: 'Order shipped', OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered', CANCELLED: 'Order cancelled' };
      if (titles[status]) try { db.prepare("INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'order', ?, ?)").run(prev.user_id, titles[status], `Order ${prev.order_number} — ${titles[status].toLowerCase()}`); } catch {}
    }
    if (status === 'CANCELLED' && prev.status !== 'CANCELLED') {
      try {
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL').all(orderId);
        for (const it of items) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.quantity, it.product_id);
        }
      } catch {}
    }
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  },

  async addAdminNote(orderId, note, adminId) {
    if (useMongo()) {
      const { Order, OrderStatusHistory } = await import('../models/index.js');
      const order = await Order.findById(orderId);
      if (!order) throw new Error('NOT_FOUND');
      order.admin_notes = (order.admin_notes ? order.admin_notes + '\n' : '') + note + ' [' + new Date().toISOString().slice(0,10) + ']';
      await order.save();
      await OrderStatusHistory.create({ order_id: orderId, from_status: null, to_status: 'NOTE', changed_by: adminId, note });
      return order;
    }
    db.prepare("UPDATE orders SET admin_notes = COALESCE(admin_notes || '\n','') || ?, updated_at = datetime('now') WHERE id = ?").run(note + ' [' + new Date().toISOString().slice(0,10) + ']', orderId);
    db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)').run(orderId, null, 'NOTE', adminId, note);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  },

  async getHistory(orderId) {
    if (useMongo()) {
      const { OrderStatusHistory } = await import('../models/index.js');
      const hist = await OrderStatusHistory.find({ order_id: orderId }).sort({ created_at: 1 }).lean();
      // populate changed_by name
      const { User } = await import('../models/index.js');
      for (const h of hist) {
        if (h.changed_by) {
          const u = await User.findById(h.changed_by).lean();
          h.changed_by_name = u ? u.name : null;
        }
      }
      return hist;
    }
    return db.prepare('SELECT h.*, u.name as changed_by_name FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.created_at ASC').all(orderId);
  },
};

export { TAX_RATE };
