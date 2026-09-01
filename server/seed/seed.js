// Zuno — Premium Clothing seed (development data)
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
    logger.info('Seed skipped: data already present (delete data/zuno.db to reseed)');
    return;
  }

  // ---------- Users ----------
  const roleId = (name) => db.prepare('SELECT id FROM roles WHERE name = ?').get(name).id;
  const adminRole = roleId('ADMIN');
  const sellerRole = roleId('SELLER');
  const adminHash = bcryptHash('Admin@1234');
  db.prepare('INSERT OR IGNORE INTO users (name, email, mobile, password_hash, role_id, email_verified) VALUES (?, ?, ?, ?, ?, 1)')
    .run('Zuno Admin', 'admin@zuno.app', '9999999999', adminHash, adminRole);

  const mkUser = (name, email, mobile, pass, role) =>
    db.prepare('INSERT INTO users (name, email, mobile, password_hash, role_id) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, mobile, bcryptHash(pass), role).lastInsertRowid;

  const sellerUserId = mkUser('Maya Seller', 'seller@zuno.app', '9123000001', 'Seller@1234', sellerRole);

  // ---------- Categories (Clothing) ----------
  const cat = (module, name, parent = null, icon = '') => {
    const info = db.prepare('INSERT INTO categories (name, slug, parent_id, module, icon, position) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM categories WHERE module=?))')
      .run(name, slugify(name), parent, module, icon, module);
    return info.lastInsertRowid;
  };
  // Top-level
  const tshirts = cat('shop', 'T-Shirts', null, '👕');
  const shirts = cat('shop', 'Shirts', null, '👔');
  // T-Shirts subcats
  const tOversized = cat('shop', 'Oversized', tshirts);
  const tRegular = cat('shop', 'Regular Fit', tshirts);
  const tGraphic = cat('shop', 'Graphic', tshirts);
  const tPlain = cat('shop', 'Plain', tshirts);
  const tPolo = cat('shop', 'Polo', tshirts);
  const tPremium = cat('shop', 'Premium Cotton', tshirts);
  // Shirts subcats
  const sCasual = cat('shop', 'Casual', shirts);
  const sPrinted = cat('shop', 'Printed', shirts);
  const sOvershirt = cat('shop', 'Overshirt', shirts);
  const sSolid = cat('shop', 'Solid', shirts);
  const sRelaxed = cat('shop', 'Relaxed Fit', shirts);
  const sFormal = cat('shop', 'Formal', shirts);

  // ---------- Brands ----------
  const brand = (name) => db.prepare('INSERT INTO brands (name, slug) VALUES (?, ?)').run(name, slugify(name)).lastInsertRowid;
  const bZuno = brand('Zuno');
  const bZunoStudio = brand('Zuno Studio');

  // ---------- Seller (Zuno-owned catalogue) ----------
  const sellerId = db.prepare("INSERT INTO sellers (name, slug, status, owner_user_id) VALUES (?, ?, 'verified', ?)").run('Zuno Clothing', 'zuno-clothing', sellerUserId).lastInsertRowid;

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
  clothingProd({ name: 'Zuno Essential Heavyweight Tee', categoryId: tPlain, brandId: bZuno, price: 1299, mrp: 1799, stock: 300, desc: 'Heavyweight 240 GSM cotton tee — minimal, premium, everyday.', colors: ['black', 'white', 'beige', 'charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, newArrival: 1, specs: { Fabric: '100% Cotton', GSM: '240', Fit: 'Regular' } });
  clothingProd({ name: 'Zuno Oversized Core Tee', categoryId: tOversized, brandId: bZuno, price: 1499, mrp: 1999, stock: 280, desc: 'Oversized street-ready tee with dropped shoulders. Your everyday statement.', colors: ['black', 'white', 'grey', 'olive', 'navy'], sizes: ['M', 'L', 'XL', 'XXL', 'XXXL'], fit: 'oversized', fabric: 'Cotton Blend', collection: 'Street Form', customizable: 1, featured: 1, newArrival: 1, specs: { Fabric: 'Cotton Blend', Fit: 'Oversized' } });
  clothingProd({ name: 'Zuno Minimal Graphic Tee', categoryId: tGraphic, brandId: bZuno, price: 1599, mrp: 2199, stock: 200, desc: 'Clean front graphic — subtle, not loud. Designed in India.', colors: ['black', 'white'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Street Form', customizable: 1, specs: { Print: 'Screen Print', Fit: 'Regular' } });
  clothingProd({ name: 'Zuno Everyday Cotton Tee', categoryId: tRegular, brandId: bZuno, price: 999, mrp: 1399, stock: 400, desc: 'Breathable everyday tee — soft, lightweight, all-day comfort.', colors: ['white', 'black', 'grey', 'navy', 'beige'], sizes: ['XS', 'S', 'M', 'L', 'XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: '100% Cotton' } });
  clothingProd({ name: 'Zuno Premium Relaxed Tee', categoryId: tPremium, brandId: bZuno, price: 1899, mrp: 2499, stock: 180, desc: 'Premium relaxed tee — washed finish, premium hand-feel.', colors: ['black', 'charcoal', 'beige', 'sage'], sizes: ['S', 'M', 'L', 'XL'], fit: 'relaxed', fabric: 'Organic Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: 'Organic Cotton' } });
  clothingProd({ name: 'Zuno Polo Classic', categoryId: tPolo, brandId: bZuno, price: 1799, mrp: 2399, stock: 160, desc: 'Classic polo — piqué knit, minimal Zuno embroidery.', colors: ['navy', 'black', 'white', 'forest'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: 'Piqué Cotton', collection: 'Essentials', specs: { Fabric: 'Piqué Cotton', Fit: 'Regular' } });
  clothingProd({ name: 'Zuno Street Graphic Oversized Tee', categoryId: tGraphic, brandId: bZunoStudio, price: 1699, mrp: 2299, stock: 220, desc: 'Bold back graphic — street culture, oversized drape.', colors: ['black', 'white', 'charcoal'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'oversized', fabric: 'Cotton', collection: 'After Dark', customizable: 1, newArrival: 1, specs: { Print: 'Puff Print' } });
  clothingProd({ name: 'Zuno Washed Vintage Tee', categoryId: tPlain, brandId: bZuno, price: 1399, mrp: 1899, stock: 250, desc: 'Garment-washed vintage tee — soft, lived-in feel from day one.', colors: ['washed-black', 'washed-grey', 'washed-olive'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: 'Washed Cotton', collection: 'Essentials', specs: { Wash: 'Garment Dyed' } });

  // ---------- Shirts ----------
  clothingProd({ name: 'Zuno Relaxed Oxford Shirt', categoryId: sCasual, brandId: bZuno, price: 2499, mrp: 3299, stock: 140, desc: 'Relaxed Oxford — textured weave, effortless everyday shirt.', colors: ['white', 'light-blue', 'sage', 'charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], fit: 'relaxed', fabric: 'Oxford Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: 'Oxford Cotton' } });
  clothingProd({ name: 'Zuno Everyday Linen Shirt', categoryId: sRelaxed, brandId: bZuno, price: 2799, mrp: 3599, stock: 120, desc: 'Breathable linen — relaxed drape for warm days and evenings.', colors: ['beige', 'white', 'olive', 'charcoal'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'relaxed', fabric: 'Linen', collection: 'Essentials', specs: { Fabric: '100% Linen' } });
  clothingProd({ name: 'Zuno Utility Overshirt', categoryId: sOvershirt, brandId: bZuno, price: 3299, mrp: 4299, stock: 100, desc: 'Heavy utility overshirt — pockets, structure, street-ready.', colors: ['olive', 'charcoal', 'khaki'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'oversized', fabric: 'Cotton Twill', collection: 'Street Form', specs: { Pockets: '4' } });
  clothingProd({ name: 'Zuno Minimal Check Shirt', categoryId: sPrinted, brandId: bZuno, price: 2299, mrp: 2999, stock: 130, desc: 'Minimal check — subtle pattern, premium finish.', colors: ['white-check', 'grey-check', 'navy-check'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: 'Cotton', collection: 'Essentials', specs: { Pattern: 'Micro Check' } });
  clothingProd({ name: 'Zuno Premium Casual Shirt', categoryId: sSolid, brandId: bZuno, price: 2599, mrp: 3399, stock: 150, desc: 'Premium casual — twill, soft collar, everyday elevated.', colors: ['black', 'white', 'charcoal', 'navy'], sizes: ['S', 'M', 'L', 'XL'], fit: 'regular', fabric: 'Cotton Twill', collection: 'After Dark', featured: 1, specs: { Fabric: 'Cotton Twill' } });
  clothingProd({ name: 'Zuno Cuban Collar Shirt', categoryId: sPrinted, brandId: bZunoStudio, price: 2399, mrp: 3199, stock: 110, desc: 'Cuban collar — retro, relaxed, resort-ready.', colors: ['black', 'cream', 'sage'], sizes: ['S', 'M', 'L', 'XL'], fit: 'relaxed', fabric: 'Viscose', collection: 'After Dark', newArrival: 1, specs: { Collar: 'Cuban' } });
  clothingProd({ name: 'Zuno Flannel Check Shirt', categoryId: sPrinted, brandId: bZuno, price: 2699, mrp: 3499, stock: 90, desc: 'Brushed flannel check — warm, soft, winter essential.', colors: ['red-check', 'green-check', 'navy-check'], sizes: ['M', 'L', 'XL', 'XXL'], fit: 'regular', fabric: 'Flannel', collection: 'After Dark', specs: { Fabric: 'Flannel' } });

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
