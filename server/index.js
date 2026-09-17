import app from './app.js';
import { connectMongo, isMongoConnected } from './config/mongo.js';
import { initializeSchema } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { db } from './config/db.js';
import bcrypt from 'bcryptjs';
import { initializeEmailService } from './config/email.js';

// ── TalkSpace Startup Architecture ──
// dotenv.config() (via env.js)
//   ↓ database connection
//   ↓ email configuration validation
//   ↓ email service initialization
//   ↓ HTTP/API server initialization

// Try Atlas first — if MONGODB_URI set and reachable, use it; else fallback to SQLite
if (env.mongoUri) {
  await connectMongo().catch(e => logger.error('mongo connect error', e));
  if (isMongoConnected()) logger.info('Using MongoDB Atlas');
  else logger.warn('Mongo connect failed — falling back to SQLite');
}

initializeSchema();

// Initialize centralized email service BEFORE HTTP server — TalkSpace pattern
try {
  await initializeEmailService();
} catch (e) {
  logger.error('Email service initialization failed', e.message);
  if (env.isProduction) {
    // Fail fast in production if email mandatory
    logger.error('Failing startup due to missing email configuration in production');
    // Don't exit hard for Zuno — email is important but not boot-blocking for shop browsing
    // Uncomment below to make email mandatory:
    // process.exit(1);
  }
}
logger.info('Database schema initialized');
logger.info(`DB_PATH=${env.dbPath} ${isMongoConnected() ? '(Mongo active — SQLite fallback for unmigrated tables)' : ''}`);

// ── Idempotent init: roles + admin for BOTH SQLite and Mongo (fixes 401 on Render) ──
function bcryptHash(p) { return bcrypt.hashSync(p, 12); }

try {
  // SQLite roles (idempotent)
  if (db.prepare('SELECT COUNT(*) c FROM roles').get().c === 0) {
    const roles = ['USER', 'ADMIN', 'SELLER', 'RESTAURANT', 'SERVICE_PROVIDER', 'DELIVERY_PARTNER'];
    const descriptions = {
      USER: 'Customer', ADMIN: 'Platform administrator', SELLER: 'Marketplace seller',
      RESTAURANT: 'Restaurant partner', SERVICE_PROVIDER: 'Service partner', DELIVERY_PARTNER: 'Delivery partner',
    };
    const ins = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    roles.forEach((r) => ins.run(r, descriptions[r]));
    logger.info('Seeded roles (SQLite)');
  }
  // SQLite admin - idempotent without destroying data
  const adminRoleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get('ADMIN');
  if (adminRoleRow) {
    const existing = db.prepare('SELECT id, role_id, status, password_hash FROM users WHERE email = ? OR mobile = ?').get('admin@zuno.app', '9999999999');
    if (!existing) {
      const h = bcryptHash('Admin@1234');
      db.prepare('INSERT INTO users (name, email, mobile, password_hash, role_id, email_verified, status) VALUES (?, ?, ?, ?, ?, 1, ?)')
        .run('ZUNO Admin', 'admin@zuno.app', '9999999999', h, adminRoleRow.id, 'active');
      logger.info('Seeded admin user admin@zuno.app (SQLite) — created');
    } else {
      let fixed = false;
      if (existing.role_id !== adminRoleRow.id) { db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(adminRoleRow.id, existing.id); fixed = true; }
      if (existing.status !== 'active') { db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(existing.id); fixed = true; }
      if (!existing.password_hash) { db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcryptHash('Admin@1234'), existing.id); fixed = true; }
      if (fixed) logger.info('Ensured admin user admin@zuno.app has ADMIN role and active status (SQLite)');
      else logger.info('Admin user admin@zuno.app already present (SQLite) — OK');
    }
  }
} catch (e) { logger.error('sqlite init failed', e.message); }

// Mongo roles + admin if Atlas connected
if (isMongoConnected()) {
  try {
    const { Role, User } = await import('./models/index.js');
    const mongoRoleCount = await Role.countDocuments();
    if (mongoRoleCount === 0) {
      const roles = ['USER', 'ADMIN', 'SELLER', 'RESTAURANT', 'SERVICE_PROVIDER', 'DELIVERY_PARTNER'];
      const descriptions = {
        USER: 'Customer', ADMIN: 'Platform administrator', SELLER: 'Marketplace seller',
        RESTAURANT: 'Restaurant partner', SERVICE_PROVIDER: 'Service partner', DELIVERY_PARTNER: 'Delivery partner',
      };
      await Role.insertMany(roles.map(r => ({ name: r, description: descriptions[r] })));
      logger.info('Seeded roles (Mongo Atlas)');
    }
    // Mongo admin - idempotent
    const adminRole = await Role.findOne({ name: 'ADMIN' });
    if (adminRole) {
      let admin = await User.findOne({ $or: [{ email: 'admin@zuno.app' }, { mobile: '9999999999' }] });
      if (!admin) {
        const h = await bcrypt.hash('Admin@1234', 12);
        admin = await User.create({ name: 'ZUNO Admin', email: 'admin@zuno.app', mobile: '9999999999', password_hash: h, role_id: adminRole._id, role_name: 'ADMIN', status: 'active', email_verified: true });
        logger.info('Seeded admin user admin@zuno.app (Mongo) — created');
      } else {
        let needsSave = false;
        if (String(admin.role_id) !== String(adminRole._id)) { admin.role_id = adminRole._id; admin.role_name = 'ADMIN'; needsSave = true; }
        if (admin.status !== 'active') { admin.status = 'active'; needsSave = true; }
        if (!admin.password_hash) { admin.password_hash = await bcrypt.hash('Admin@1234', 12); needsSave = true; }
        if (needsSave) { await admin.save(); logger.info('Fixed admin role/status for existing admin (Mongo)'); }
        else logger.info('Admin user admin@zuno.app already present (Mongo) — OK');
      }
    }
  } catch (e) { logger.error('mongo init failed', e.message); }
}
// ── Mongo catalogue seeding — ensures production Atlas has products without wiping SQLite ──
if (isMongoConnected()) {
  try {
    const { Product, Category, Brand, ProductVariant } = await import('./models/index.js');
    const mCount = await Product.countDocuments({ active: true });
    if (mCount === 0) {
      logger.info('No products in Mongo — seeding catalogue to Atlas…');
      const { slugify } = await import('./utils/id.js');
      // Categories
      const cat = async (name, parent=null) => {
        const slug = slugify(name);
        let existing = await Category.findOne({ slug });
        if (existing) return existing;
        return await Category.create({ name, slug, parent_id: parent?._id || null, module: 'shop', icon: '👕', position: 0, active: true });
      };
      const tShirts = await cat('T-Shirts');
      const tOversized = await cat('Oversized', tShirts);
      const tRegular = await cat('Regular Fit', tShirts);
      const tGraphic = await cat('Graphic', tShirts);
      const tPlain = await cat('Plain', tShirts);
      const tPolo = await cat('Polo', tShirts);
      const tPremium = await cat('Premium Cotton', tShirts);
      // Brands
      const brand = async (name) => {
        const slug = slugify(name);
        let b = await Brand.findOne({ slug });
        if (b) return b;
        return await Brand.create({ name, slug, active: true });
      };
      const bZUNO = await brand('ZUNO');
      const bZUNOStudio = await brand('ZUNO Studio');
      const IMG = {
        tee1: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop'],
        tee2: ['https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1618354691321-e851c56960d1?w=600&h=750&fit=crop'],
        tee3: ['https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop'],
        tee4: ['https://images.unsplash.com/photo-1618354691321-e851c56960d1?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=750&fit=crop'],
        tee5: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop'],
        tee6: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&h=750&fit=crop'],
        tee7: ['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop','https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop'],
      };
      const clothingProd = async ({ name, categoryId, brandId, price, mrp, stock, desc, colors, sizes, fit, fabric, collection, customizable=0, featured=0, newArrival=0, specs={}, images=[] }) => {
        const slug = slugify(name) + '-' + Math.random().toString(36).slice(2,6);
        const rating = (4.2 + Math.random()*0.6).toFixed(1);
        const ratingCount = Math.floor(40+Math.random()*600);
        const prod = await Product.create({ category_id: categoryId, brand_id: brandId, name, slug, description: desc, price, mrp, stock, rating, rating_count: ratingCount, images, specs, module: 'shop', colors, sizes, fit, fabric, collection, customizable: !!customizable, featured: !!featured, new_arrival: !!newArrival, care_instructions: 'Machine wash cold', active: true });
        for (const color of colors) for (const size of sizes) {
          const sku = `ZUNO-${prod._id}-${color.toUpperCase().replace(/[^A-Z0-9]/g,'')}-${size}`;
          try { await ProductVariant.create({ product_id: prod._id, sku, color, size, stock: Math.floor(stock/(colors.length*sizes.length))+5, price }); } catch {}
        }
      };
      await clothingProd({ name: 'ZUNO Essential Heavyweight Tee', categoryId: tPlain._id, brandId: bZUNO._id, price: 129900, mrp: 179900, stock: 300, desc: 'Heavyweight 240 GSM cotton tee — minimal, premium, everyday.', colors: ['black','white','beige','charcoal'], sizes: ['S','M','L','XL','XXL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, newArrival: 1, specs: { Fabric: '100% Cotton', GSM: '240' }, images: IMG.tee1 });
      await clothingProd({ name: 'ZUNO Oversized Core Tee', categoryId: tOversized._id, brandId: bZUNO._id, price: 149900, mrp: 199900, stock: 280, desc: 'Oversized street-ready tee with dropped shoulders.', colors: ['black','white','grey','olive','navy'], sizes: ['M','L','XL','XXL','XXXL'], fit: 'oversized', fabric: 'Cotton Blend', collection: 'Street Form', customizable: 1, featured: 1, newArrival: 1, specs: { Fabric: 'Cotton Blend' }, images: IMG.tee2 });
      await clothingProd({ name: 'ZUNO Minimal Graphic Tee', categoryId: tGraphic._id, brandId: bZUNO._id, price: 159900, mrp: 219900, stock: 200, desc: 'Clean front graphic — subtle, not loud.', colors: ['black','white'], sizes: ['S','M','L','XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Street Form', customizable: 1, specs: { Print: 'Screen Print' }, images: IMG.tee3 });
      await clothingProd({ name: 'ZUNO Everyday Cotton Tee', categoryId: tRegular._id, brandId: bZUNO._id, price: 99900, mrp: 139900, stock: 400, desc: 'Breathable everyday tee — soft, lightweight.', colors: ['white','black','grey','navy','beige'], sizes: ['XS','S','M','L','XL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: '100% Cotton' }, images: IMG.tee4 });
      await clothingProd({ name: 'ZUNO Premium Relaxed Tee', categoryId: tPremium._id, brandId: bZUNO._id, price: 189900, mrp: 249900, stock: 180, desc: 'Premium relaxed tee — washed finish.', colors: ['black','charcoal','beige','sage'], sizes: ['S','M','L','XL'], fit: 'relaxed', fabric: 'Organic Cotton', collection: 'Essentials', featured: 1, specs: { Fabric: 'Organic Cotton' }, images: IMG.tee5 });
      await clothingProd({ name: 'ZUNO Polo Classic', categoryId: tPolo._id, brandId: bZUNO._id, price: 179900, mrp: 239900, stock: 160, desc: 'Classic polo — piqué knit.', colors: ['navy','black','white','forest'], sizes: ['S','M','L','XL','XXL'], fit: 'regular', fabric: 'Piqué Cotton', collection: 'Essentials', specs: { Fabric: 'Piqué Cotton' }, images: IMG.tee6 });
      await clothingProd({ name: 'ZUNO Street Graphic Oversized Tee', categoryId: tGraphic._id, brandId: bZUNOStudio._id, price: 169900, mrp: 229900, stock: 220, desc: 'Bold back graphic — street culture.', colors: ['black','white','charcoal'], sizes: ['M','L','XL','XXL'], fit: 'oversized', fabric: 'Cotton', collection: 'After Dark', customizable: 1, newArrival: 1, specs: { Print: 'Puff Print' }, images: IMG.tee7 });
      await clothingProd({ name: 'ZUNO Washed Vintage Tee', categoryId: tPlain._id, brandId: bZUNO._id, price: 139900, mrp: 189900, stock: 250, desc: 'Garment-washed vintage tee.', colors: ['washed-black','washed-grey','washed-olive'], sizes: ['S','M','L','XL'], fit: 'regular', fabric: 'Washed Cotton', collection: 'Essentials', specs: { Wash: 'Garment Dyed' }, images: IMG.tee1 });
      await clothingProd({ name: 'ZUNO Signature Tee', categoryId: tPremium._id, brandId: bZUNO._id, price: 199900, mrp: 269900, stock: 200, desc: 'Signature heavyweight tee — ZUNO embroidered.', colors: ['black','white','charcoal'], sizes: ['S','M','L','XL','XXL'], fit: 'regular', fabric: 'Heavyweight Cotton', collection: 'Essentials', featured: 1, specs: { GSM: '280' }, images: IMG.tee2 });
      await clothingProd({ name: 'ZUNO Core Black Tee', categoryId: tPlain._id, brandId: bZUNO._id, price: 119900, mrp: 159900, stock: 350, desc: 'Core black tee — everyday.', colors: ['black'], sizes: ['XS','S','M','L','XL','XXL'], fit: 'regular', fabric: '100% Cotton', collection: 'Essentials', featured: 1, newArrival: 1, specs: { Fabric: '100% Cotton' }, images: IMG.tee3 });
      await clothingProd({ name: 'ZUNO Graphic Series Tee', categoryId: tGraphic._id, brandId: bZUNOStudio._id, price: 179900, mrp: 239900, stock: 180, desc: 'Graphic series — bold front print.', colors: ['black','white','beige'], sizes: ['M','L','XL','XXL'], fit: 'oversized', fabric: 'Cotton', collection: 'Street Form', customizable: 1, featured: 1, specs: { Print: 'HD Screen Print' }, images: IMG.tee4 });
      // Coupons for Mongo
      const { Coupon } = await import('./models/index.js');
      if (await Coupon.countDocuments({ code: 'ZUNO100' }) === 0) await Coupon.create({ code: 'ZUNO100', type: 'flat', value: 10000, min_order: 0, module: null, active: true });
      if (await Coupon.countDocuments({ code: 'WELCOME10' }) === 0) await Coupon.create({ code: 'WELCOME10', type: 'percent', value: 10, min_order: 100000, max_discount: 50000, module: null, active: true });
      if (await Coupon.countDocuments({ code: 'STUDIO50' }) === 0) await Coupon.create({ code: 'STUDIO50', type: 'flat', value: 5000, min_order: 50000, module: null, active: true });
      logger.info(`Mongo catalogue seeded: ${await Product.countDocuments()} products`);
    } else {
      logger.info(`Mongo catalogue present: ${mCount} products`);
    }
    // ── Sync SQLite custom T-Shirts to Mongo for Mongo-only mode (fixes price not updating when admin edits Mongo but listing shows SQLite) ──
    try {
      const sqliteCustom = db.prepare('SELECT * FROM products WHERE customizable=1 AND active=1').all();
      const mCustomCount = await Product.countDocuments({ customizable: true, active: true });
      if (sqliteCustom.length > mCustomCount) {
        logger.info(`Syncing ${sqliteCustom.length - mCustomCount} custom products from SQLite → Mongo (Mongo-only mode)`);
        const { Category, Brand } = await import('./models/index.js');
        const { slugify } = await import('./utils/id.js');
        for (const sq of sqliteCustom) {
          if (await Product.findOne({ name: sq.name })) continue;
          let catId = null;
          try {
            const catRow = db.prepare('SELECT name FROM categories WHERE id=?').get(sq.category_id);
            if (catRow) {
              let mCat = await Category.findOne({ name: catRow.name });
              if (!mCat) mCat = await Category.create({ name: catRow.name, slug: slugify(catRow.name), module:'shop', active:true });
              catId = mCat._id;
            }
          } catch {}
          let brandId = null;
          try {
            const brRow = sq.brand_id ? db.prepare('SELECT name FROM brands WHERE id=?').get(sq.brand_id) : null;
            const brName = brRow ? brRow.name : 'ZUNO';
            let mBr = await Brand.findOne({ name: brName });
            if (!mBr) mBr = await Brand.create({ name: brName, slug: slugify(brName), active:true });
            brandId = mBr._id;
          } catch {}
          const imgs = sq.images ? JSON.parse(sq.images) : [];
          const colors = sq.colors ? JSON.parse(sq.colors) : [];
          const sizes = sq.sizes ? JSON.parse(sq.sizes) : [];
          const printFront = sq.print_area_front ? JSON.parse(sq.print_area_front) : null;
          const printBack = sq.print_area_back ? JSON.parse(sq.print_area_back) : null;
          const prod = await Product.create({
            category_id: catId, brand_id: brandId, name: sq.name, slug: sq.slug, description: sq.description, price: sq.price, mrp: sq.mrp, stock: sq.stock, rating: sq.rating||4.5, rating_count: sq.rating_count||100, images: imgs, module: sq.module||'shop', colors, sizes, fit: sq.fit, fabric: sq.fabric, collection: sq.collection, gender: sq.gender||null, customizable: true, featured: !!sq.featured, new_arrival: !!sq.new_arrival, active: true, printAreaFront: printFront, printAreaBack: printBack, customExtraFront: sq.custom_extra_front||10000, customExtraBack: sq.custom_extra_back||10000
          });
          for (const c of colors) for (const s of sizes) {
            const sku=`ZUNO-${prod._id}-${c.toUpperCase().replace(/[^A-Z0-9]/g,'')}-${s}`;
            try { const { ProductVariant } = await import('./models/index.js'); await ProductVariant.create({ product_id: prod._id, sku, color:c, size:s, stock: Math.floor(sq.stock/(colors.length*sizes.length||1))+5, price: sq.price }); } catch {}
          }
        }
        logger.info(`Mongo sync complete: ${await Product.countDocuments({ customizable:true })} custom products now in Mongo`);
      }
    } catch (e) { logger.error('mongo custom sync failed', e.message); }
  } catch (e) { logger.error('mongo catalogue seed failed', e.message); }
}
try {
  const prodCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (prodCount === 0) {
    logger.info('No products — auto-seeding catalogue…');
    await import('./seed/seed.js');
    logger.info('Auto-seed complete');
  } else {
    logger.info(`Catalogue present: ${prodCount} products`);
  }
} catch (e) { logger.error('auto-seed check failed', e); }

const server = app.listen(env.port, () => {
  logger.info(`ZUNO API listening on http://localhost:${env.port}`); // eslint-disable-line
});

// Start Printrove fulfillment sync scheduler (after DB ready)
import('./services/printrove/scheduler.js').then(m => m.startPrintroveSyncScheduler()).catch(e => logger.error('printrove scheduler start failed', e.message));

process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', reason));
process.on('uncaughtException', (err) => { logger.error('uncaughtException', err); process.exit(1); });

export default server;
