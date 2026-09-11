import app from './app.js';
import { connectMongo, isMongoConnected } from './config/mongo.js';
import { initializeSchema } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

// Try Atlas first — if MONGODB_URI set and reachable, use it; else fallback to SQLite
if (env.mongoUri) {
  await connectMongo().catch(e => logger.error('mongo connect error', e));
  if (isMongoConnected()) logger.info('Using MongoDB Atlas');
  else logger.warn('Mongo connect failed — falling back to SQLite');
}

initializeSchema();
logger.info('Database schema initialized');
logger.info(`DB_PATH=${env.dbPath} ${isMongoConnected() ? '(Mongo active — SQLite fallback for unmigrated tables)' : ''}`);

// Seed roles + auto-seed catalogue if empty (critical for Render ephemeral free tier)
import { db } from './config/db.js';
const roleCount = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
if (roleCount === 0) {
  const roles = ['USER', 'ADMIN', 'SELLER', 'RESTAURANT', 'SERVICE_PROVIDER', 'DELIVERY_PARTNER'];
  const descriptions = {
    USER: 'Customer', ADMIN: 'Platform administrator', SELLER: 'Marketplace seller',
    RESTAURANT: 'Restaurant partner', SERVICE_PROVIDER: 'Service partner', DELIVERY_PARTNER: 'Delivery partner',
  };
  const ins = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
  roles.forEach((r) => ins.run(r, descriptions[r]));
  logger.info('Seeded roles');
}
try {
  const prodCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (prodCount === 0) {
    logger.info('No products — auto-seeding catalogue…');
    await import('./seed/seed.js');
    logger.info('Auto-seed complete');
  }
} catch (e) { logger.error('auto-seed check failed', e); }

const server = app.listen(env.port, () => {
  logger.info(`ZUNO API listening on http://localhost:${env.port}`); // eslint-disable-line
});

process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', reason));
process.on('uncaughtException', (err) => { logger.error('uncaughtException', err); process.exit(1); });

export default server;
