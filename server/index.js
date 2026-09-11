import app from './app.js';
import { connectMongo, isMongoConnected } from './config/mongo.js';
import { initializeSchema } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { db } from './config/db.js';
import bcrypt from 'bcryptjs';

// Try Atlas first — if MONGODB_URI set and reachable, use it; else fallback to SQLite
if (env.mongoUri) {
  await connectMongo().catch(e => logger.error('mongo connect error', e));
  if (isMongoConnected()) logger.info('Using MongoDB Atlas');
  else logger.warn('Mongo connect failed — falling back to SQLite');
}

initializeSchema();
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

process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', reason));
process.on('uncaughtException', (err) => { logger.error('uncaughtException', err); process.exit(1); });

export default server;
