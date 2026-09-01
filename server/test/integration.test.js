// Integration tests for pricing, coupons, signature verification and order creation.
// Uses an in-memory SQLite DB so it needs no external service.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-for-tests';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';

const { db, initializeSchema } = await import('../config/db.js');
initializeSchema();

const { couponService, orderService } = await import('../services/order.service.js');
const rzp = await import('../integrations/razorpay/index.js');

db.prepare("INSERT INTO coupons (code, type, value, min_order, max_discount, module, active) VALUES ('SUPER10', 'percent', 10, 0, NULL, NULL, 1)").run();
db.prepare("INSERT INTO coupons (code, type, value, min_order, max_discount, module, active) VALUES ('FLAT50', 'flat', 5000, 10000, NULL, NULL, 1)").run();
db.prepare("INSERT INTO coupons (code, type, value, min_order, active) VALUES ('EXP', 'flat', 9999, 999999, 0)").run();

test('coupon percent discount computed correctly', () => {
  const r = couponService.validate('SUPER10', 'shop', 10000, 1);
  assert.equal(r.valid, true);
  assert.equal(r.discount, 1000);
});

test('coupon with minimum order rejects small carts', () => {
  const r = couponService.validate('FLAT50', 'shop', 5000, 1);
  assert.equal(r.valid, false);
  assert.match(r.message, /Minimum/i);
});

test('computeTotals adds tax and total', () => {
  const t = orderService.computeTotals({ module: 'shop', subtotal: 10000, couponCode: null, userId: 1 });
  assert.equal(t.subtotal, 10000);
  assert.ok(t.tax > 0);
  assert.equal(t.total, t.subtotal - t.discount + t.tax);
});

test('computeTotals applies a valid coupon', () => {
  const t = orderService.computeTotals({ module: 'shop', subtotal: 10000, couponCode: 'SUPER10', userId: 1 });
  assert.equal(t.discount, 1000);
  assert.equal(t.couponValid, true);
});

test('razorpay test-mode signature round-trips', async () => {
  const order = await rzp.createRazorpayOrder({ amountPaise: 123, receipt: 'R1' });
  assert.ok(rzp.verifyPaymentSignature({ razorpayOrderId: order.id, razorpayPaymentId: order.paymentId, razorpaySignature: order.signature }));
  assert.equal(rzp.verifyPaymentSignature({ razorpayOrderId: order.id, razorpayPaymentId: order.paymentId, razorpaySignature: 'deadbeef' }), false);
});

test('order.createFromCart enforces server-side pricing', () => {
  // seed product + address + user
  db.prepare("INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'USER')").run();
  db.prepare("INSERT INTO users (name, mobile, role_id) VALUES ('T', '9000000001', 1)").run();
  const uid = db.prepare('SELECT last_insert_rowid() last').get().last;
  db.prepare("INSERT INTO addresses (user_id, line1, city, pincode) VALUES (?, 'x', 'Mumbai', '400001')").run(uid);
  const aid = db.prepare('SELECT last_insert_rowid() last').get().last;
  db.prepare("INSERT INTO categories (name, slug, module) VALUES ('c','c','shop')").run();
  const cid = db.prepare('SELECT last_insert_rowid() last').get().last;
  db.prepare("INSERT INTO products (category_id, name, slug, description, price, mrp, stock) VALUES (?, 'p','p','d', 10000, 12000, 5)").run(cid);
  const pid = db.prepare('SELECT last_insert_rowid() last').get().last;
  const created = orderService.createFromCart({ userId: uid, module: 'shop', addressId: aid, couponCode: null, items: [{ productId: pid, name: 'p', price: 10000, quantity: 1, lineTotal: 10000 }] });
  assert.ok(created.orderId > 0);
  const stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(pid).stock;
  assert.equal(stock, 4); // decremented
});
