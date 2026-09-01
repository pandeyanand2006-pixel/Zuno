import app from './app.js';
import { initializeSchema } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

initializeSchema();
logger.info('Database schema initialized');

// Seed roles
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

const server = app.listen(env.port, () => {
  logger.info(`Zuno API listening on http://localhost:${env.port}`); // eslint-disable-line
});

process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', reason));
process.on('uncaughtException', (err) => { logger.error('uncaughtException', err); process.exit(1); });

export default server;
