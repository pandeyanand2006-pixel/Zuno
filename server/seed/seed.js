// ZUNO — Premium Clothing seed (development data)
import { db } from '../config/db.js';
import { initializeSchema } from '../config/db.js';
import { hashPassword } from '../utils/password.js';
import { slugify } from '../utils/id.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';
function bcryptHash(p) { return bcrypt.hashSync(p, 12); }

function seed() {
  initializeSchema();
  if (db.prepare('SELECT COUNT(*) c FROM roles').get().c === 0) {
    const roles = ['USER', 'ADMIN', 'SELLER', 'RESTAURANT', 'SERVICE_PROVIDER', 'DELIVERY_PARTNER'];
    const ins = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    roles.forEach((r) => ins.run(r, r));
  }
  const count = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (count > 0) {
    logger.info('Seed skipped: data already present (delete data/ZUNO.db to reseed)');
    return;
  }

  // ---------- Users ----------
  const roleId = (name) => db.prepare('SELECT id FROM roles WHERE name = ?').get(name).id;
  const adminRole = roleId('ADMIN');
  const sellerRole = roleId('SELLER');
  const adminHash = bcryptHash('Admin@1234');
  db.prepare('INSERT OR IGNORE INTO users (name, email, mobile, password_hash, role_id, email_verified) VALUES (?, ?, ?, ?, ?, 1)')
    .run('ZUNO Admin', 'admin@ZUNO.app', '9999999999', adminHash, adminRole);

  const mkUser = (name, email, mobile, pass, role) =>
    db.prepare('INSERT INTO users (name, email, mobile, password_hash, role_id) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, mobile, bcryptHash(pass), role).lastInsertRowid;

  const sellerUserId = mkUser('Maya Seller', 'seller@ZUNO.app', '9123000001', 'Seller@1234', sellerRole);

  // ---------- Categories (Clothing) ----------
  const cat = (module, name, parent = null, icon = '') => {
    const info = db.prepare('INSERT INTO categories (name, slug, parent_id, module, icon, position) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM categories WHERE module=?))')
      .run(name, slugify(name), parent, module, icon, module);
    return info.lastInsertRowid;
  };
  // Top-level
  const tshirts = cat('shop', 'T-Shirts', null, '👕');
  // T-Shirts subcats — ZUNO is T-shirts only
  const tOversized = cat('shop', 'Oversized', tshirts);
  const tRegular = cat('shop', 'Regular Fit', tshirts);
  const tGraphic = cat('shop', 'Graphic', tshirts);
  const tPlain = cat('shop', 'Plain', tshirts);
  const tPolo = cat('shop', 'Polo', tshirts);
  const tPremium = cat('shop', 'Premium Cotton', tshirts);

  // ---------- Brands ----------
  const brand = (name) => db.prepare('INSERT INTO brands (name, slug) VALUES (?, ?)').run(name, slugify(name)).lastInsertRowid;
  const bZUNO = brand('ZUNO');
  const bZUNOStudio = brand('ZUNO Studio');

  // ---------- Seller (ZUNO-owned catalogue) ----------
  const sellerId = db.prepare("INSERT INTO sellers (name, slug, status, owner_user_id) VALUES (?, ?, 'verified', ?)").run('ZUNO Clothing', 'ZUNO-clothing', sellerUserId).lastInsertRowid;

  // ---------- Helpers ----------
  const clothingProd = ({ name, categoryId, brandId, price, mrp, stock, desc, colors, sizes, fit, fabric, collection, customizable = 0, featured = 0, newArrival = 0, specs = {}, images = [] }) => {
    const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
    const rating = (4.2 + Math.random() * 0.6).toFixed(1);
    const ratingCount = Math.floor(40 + Math.random() * 600);
    const info = db.prepare(`INSERT INTO products (seller_id, category_id, brand_id, name, slug, description, price, mrp, stock, rating, rating_count, images, specs, module, colors, sizes, fit, fabric, collection, customizable, featured, new_arrival, care_instructions, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shop', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(sellerId, categoryId, brandId, name, slug, desc, price, mrp, stock, rating, ratingCount, JSON.stringify(images), JSON.stringify(specs), JSON.stringify(colors), JSON.stringify(sizes), fit, fabric, collection, customizable, featured, newArrival, 'Machine wash cold, tumble dry low');
    const pid = info.lastInsertRowid;
    // Create variants for each color/size
    const varIns = db.prepare('INSERT INTO product_variants (product_id, sku, color, size, stock, price) VALUES (?, ?, ?, ?, ?, ?)');
    for (const color of colors) {
      for (const size of sizes) {
        const sku = `ZUNO-${pid}-${color.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${size}`;
        varIns.run(pid, sku, color, size, Math.floor(stock / (colors.length * sizes.length)) + 5, price);
      }
    }
    return pid;
  };

  // ---------- T-Shirts ----------
  clothingProd({ name: 'ZUNO Essential Heavyweight Tee', categoryId: tPlain, brandId: bZUNO, price: 1299, mrp: 1799, stock: 300, desc: 'Heavyweight 240 GSM cotton tee — minimal, premium, everyday.', colors: ['black', 'white', 'beige', 'charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, newArrival: 1, specs: { Fabric: '100% Cotton', GSM: '240', Fit: 'Regular' } });
  clothingProd({ name: 'ZUNO Oversized Core Tee', categoryId: tOversized, brandId: bZUNO, price: 1499, mrp: 1999, stock: 280, desc: 'Oversized street-ready tee with dropped shoulders. Your everyday statement.', colors: ['black', 'white', 'grey', 'olive', 'navy'], sizes: ['M', 'L', 'XL', 'XXL', 'XXXL'], fit: 'oversized', fabric: 'Cotton Blend', collection: 'Street Form', customizable: 1, featured: 1, newArrival: 1, specs: { Fabric: 'Cotton Blend', Fit: 'Oversized' } });
  clothingProd({ name: 'ZUNO Minimal Graphic Tee', categoryId: tGraphic, brandId: bZUNO, price: 1599, mrp: 2199, stock: 200, desc: 'Clean front graphic — subtle, not loud. Designed in India.', colors: ['black', 'white'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Street Form', customizable: 1, specs: { Print: 'Screen Print', Fit: 'Regular' } });
  clothingProd({ name: 'ZUNO Everyday Cotton Tee', categoryId: tRegular, brandId: bZUNO, price: 999, mrp: 1399, stock: 400, desc: 'Breathable everyday tee — soft, lightweight, all-day comfort.', colors: ['white', 'black', 'grey', 'navy', 'beige'], sizes: ['XS', 'S', 'M', 'L', 'XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: '100% Cotton' } });
  clothingProd({ name: 'ZUNO Premium Relaxed Tee', categoryId: tPremium, brandId: bZUNO, price: 1899, mrp: 2499, stock: 180, desc: 'Premium relaxed tee — washed finish, premium hand-feel.', colors: ['black', 'charcoal', 'beige', 'sage'], sizes: ['S', 'M', 'L', 'XL'], fit: 'relaxed', fabric: 'Organic Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: 'Organic Cotton' } });
  clothingProd({ name: 'ZUNO Polo Classic', categoryId: tPolo, brandId: bZUNO, price: 1799, mrp: 2399, stock: 160, desc: 'Classic polo — piqué knit, minimal ZUNO embroidery.', colors: ['navy', 'black', 'white', 'forest'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: 'Piqué Cotton', collection: 'Essentials', specs: { Fabric: 'Piqué Cotton', Fit: 'Regular' } });
  clothingProd({ name: 'ZUNO Street Graphic Oversized Tee', categoryId: tGraphic, brandId: bZUNOStudio, price: 1699, mrp: 2299, stock: 220, desc: 'Bold back graphic — street culture, oversized drape.', colors: ['black', 'white', 'charcoal'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'oversized', fabric: 'Cotton', collection: 'After Dark', customizable: 1, newArrival: 1, specs: { Print: 'Puff Print' } });
  clothingProd({ name: 'ZUNO Washed Vintage Tee', categoryId: tPlain, brandId: bZUNO, price: 1399, mrp: 1899, stock: 250, desc: 'Garment-washed vintage tee — soft, lived-in feel from day one.', colors: ['washed-black', 'washed-grey', 'washed-olive'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: 'Washed Cotton', collection: 'Essentials', specs: { Wash: 'Garment Dyed' } });
  clothingProd({ name: 'ZUNO Signature Tee', categoryId: tPremium, brandId: bZUNO, price: 1999, mrp: 2699, stock: 200, desc: 'Signature heavyweight tee — ZUNO embroidered chest, premium 280 GSM.', colors: ['black', 'white', 'charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: 'Heavyweight Cotton', collection: 'Essentials', featured: 1, specs: { GSM: '280', Embroidery: 'ZUNO chest' } });
  clothingProd({ name: 'ZUNO Core Black Tee', categoryId: tPlain, brandId: bZUNO, price: 1199, mrp: 1599, stock: 350, desc: 'Core black tee — the one you reach for every day. Pure, minimal, perfect.', colors: ['black'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, newArrival: 1, specs: { Fabric: '100% Cotton' } });
  clothingProd({ name: 'ZUNO Graphic Series Tee', categoryId: tGraphic, brandId: bZUNOStudio, price: 1799, mrp: 2399, stock: 180, desc: 'Graphic series — bold front print, street form, limited drop.', colors: ['black', 'white', 'beige'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'oversized', fabric: 'Cotton', collection: 'Street Form', customizable: 1, featured: 1, specs: { Print: 'HD Screen Print' } });

  // ---------- Coupons ----------
  db.prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, module, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .run('ZUNO100', 'flat', 10000, 0, null, null);
  db.prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, module, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .run('WELCOME10', 'percent', 10, 100000, 50000, null);
  db.prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, module, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .run('STUDIO50', 'flat', 5000, 50000, null, null);

  logger.info('Seed complete. Clothing catalogue inserted.');
}

seed();
