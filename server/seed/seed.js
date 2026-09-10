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
    .run('ZUNO Admin', 'admin@zuno.app', '9999999999', adminHash, adminRole);

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

  // ---------- T-Shirts (prices in paise: 129900 = ₹1299) ----------
  const IMG = {
    tee1: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop'],
    tee2: ['https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1618354691321-e851c56960d1?w=600&h=750&fit=crop'],
    tee3: ['https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop'],
    tee4: ['https://images.unsplash.com/photo-1618354691321-e851c56960d1?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=750&fit=crop'],
    tee5: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop'],
    tee6: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&h=750&fit=crop'],
    tee7: ['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop'],
  };
  clothingProd({ name: 'ZUNO Essential Heavyweight Tee', categoryId: tPlain, brandId: bZUNO, price: 129900, mrp: 179900, stock: 300, desc: 'Heavyweight 240 GSM cotton tee — minimal, premium, everyday.', colors: ['black', 'white', 'beige', 'charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, newArrival: 1, specs: { Fabric: '100% Cotton', GSM: '240', Fit: 'Regular' }, images: IMG.tee1 });
  clothingProd({ name: 'ZUNO Oversized Core Tee', categoryId: tOversized, brandId: bZUNO, price: 149900, mrp: 199900, stock: 280, desc: 'Oversized street-ready tee with dropped shoulders. Your everyday statement.', colors: ['black', 'white', 'grey', 'olive', 'navy'], sizes: ['M', 'L', 'XL', 'XXL', 'XXXL'], fit: 'oversized', fabric: 'Cotton Blend', collection: 'Street Form', customizable: 1, featured: 1, newArrival: 1, specs: { Fabric: 'Cotton Blend', Fit: 'Oversized' }, images: IMG.tee2 });
  clothingProd({ name: 'ZUNO Minimal Graphic Tee', categoryId: tGraphic, brandId: bZUNO, price: 159900, mrp: 219900, stock: 200, desc: 'Clean front graphic — subtle, not loud. Designed in India.', colors: ['black', 'white'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Street Form', customizable: 1, specs: { Print: 'Screen Print', Fit: 'Regular' }, images: IMG.tee3 });
  clothingProd({ name: 'ZUNO Everyday Cotton Tee', categoryId: tRegular, brandId: bZUNO, price: 99900, mrp: 139900, stock: 400, desc: 'Breathable everyday tee — soft, lightweight, all-day comfort.', colors: ['white', 'black', 'grey', 'navy', 'beige'], sizes: ['XS', 'S', 'M', 'L', 'XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: '100% Cotton' }, images: IMG.tee4 });
  clothingProd({ name: 'ZUNO Premium Relaxed Tee', categoryId: tPremium, brandId: bZUNO, price: 189900, mrp: 249900, stock: 180, desc: 'Premium relaxed tee — washed finish, premium hand-feel.', colors: ['black', 'charcoal', 'beige', 'sage'], sizes: ['S', 'M', 'L', 'XL'], fit: 'relaxed', fabric: 'Organic Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: 'Organic Cotton' }, images: IMG.tee5 });
  clothingProd({ name: 'ZUNO Polo Classic', categoryId: tPolo, brandId: bZUNO, price: 179900, mrp: 239900, stock: 160, desc: 'Classic polo — piqué knit, minimal ZUNO embroidery.', colors: ['navy', 'black', 'white', 'forest'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: 'Piqué Cotton', collection: 'Essentials', specs: { Fabric: 'Piqué Cotton', Fit: 'Regular' }, images: IMG.tee6 });
  clothingProd({ name: 'ZUNO Street Graphic Oversized Tee', categoryId: tGraphic, brandId: bZUNOStudio, price: 169900, mrp: 229900, stock: 220, desc: 'Bold back graphic — street culture, oversized drape.', colors: ['black', 'white', 'charcoal'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'oversized', fabric: 'Cotton', collection: 'After Dark', customizable: 1, newArrival: 1, specs: { Print: 'Puff Print' }, images: IMG.tee7 });
  clothingProd({ name: 'ZUNO Washed Vintage Tee', categoryId: tPlain, brandId: bZUNO, price: 139900, mrp: 189900, stock: 250, desc: 'Garment-washed vintage tee — soft, lived-in feel from day one.', colors: ['washed-black', 'washed-grey', 'washed-olive'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: 'Washed Cotton', collection: 'Essentials', specs: { Wash: 'Garment Dyed' }, images: IMG.tee1 });
  clothingProd({ name: 'ZUNO Signature Tee', categoryId: tPremium, brandId: bZUNO, price: 199900, mrp: 269900, stock: 200, desc: 'Signature heavyweight tee — ZUNO embroidered chest, premium 280 GSM.', colors: ['black', 'white', 'charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: 'Heavyweight Cotton', collection: 'Essentials', featured: 1, specs: { GSM: '280', Embroidery: 'ZUNO chest' }, images: IMG.tee2 });
  clothingProd({ name: 'ZUNO Core Black Tee', categoryId: tPlain, brandId: bZUNO, price: 119900, mrp: 159900, stock: 350, desc: 'Core black tee — the one you reach for every day. Pure, minimal, perfect.', colors: ['black'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, newArrival: 1, specs: { Fabric: '100% Cotton' }, images: IMG.tee3 });
  clothingProd({ name: 'ZUNO Graphic Series Tee', categoryId: tGraphic, brandId: bZUNOStudio, price: 179900, mrp: 239900, stock: 180, desc: 'Graphic series — bold front print, street form, limited drop.', colors: ['black', 'white', 'beige'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'oversized', fabric: 'Cotton', collection: 'Street Form', customizable: 1, featured: 1, specs: { Print: 'HD Screen Print' }, images: IMG.tee4 });

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
