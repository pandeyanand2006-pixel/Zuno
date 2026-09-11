// Vercel Serverless entry — wraps the same Express app
// Vercel will call this as a serverless function for /api/* and SPA fallback
import app from '../server/app.js';
import { initializeSchema } from '../server/config/db.js';
import { db } from '../server/config/db.js';

// Ensure schema + roles exist (cold start)
try {
  initializeSchema();
  const roleCount = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
  if (roleCount === 0) {
    const roles = ['USER','ADMIN','SELLER','RESTAURANT','SERVICE_PROVIDER','DELIVERY_PARTNER'];
    const ins = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    roles.forEach(r => ins.run(r, r));
  }
} catch (e) { console.error('vercel init', e); }

export default app;
