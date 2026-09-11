import { verifyToken } from '../utils/jwt.js';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { User } from '../models/index.js';
import { unauthorized, forbidden } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    let token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token && req.cookies && req.cookies.ZUNO_token) token = req.cookies.ZUNO_token;

    if (!token) return unauthorized(res, 'Authentication required');

    const payload = verifyToken(token);
    if (!payload || !payload.sub) return unauthorized(res, 'Invalid or expired session');

    let user;
    if (env.mongoUri && isMongoConnected()) {
      try { user = await User.findById(payload.sub).lean(); } catch { user = null; }
      if (!user) return unauthorized(res, 'Account no longer exists');
      user = { id: String(user._id), name: user.name, email: user.email, mobile: user.mobile, role_id: user.role_id, status: user.status };
    } else {
      user = db.prepare('SELECT id, name, email, mobile, role_id, status FROM users WHERE id = ?').get(payload.sub);
      if (!user) return unauthorized(res, 'Account no longer exists');
    }
    if (user.status === 'suspended') return forbidden(res, 'Your account has been suspended');

    req.user = user;
    next();
  } catch (err) {
    logger.error('authMiddleware', err);
    return unauthorized(res, 'Invalid or expired session');
  }
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) return unauthorized(res);
    let roleName = 'USER';
    if (env.mongoUri && isMongoConnected()) {
      try { const { Role } = await import('../models/index.js'); const r = await Role.findById(req.user.role_id).lean(); roleName = r ? r.name : 'USER'; } catch {}
    } else {
      const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(req.user.role_id);
      roleName = role ? role.name : 'USER';
    }
    if (!roles.includes(roleName)) return forbidden(res, 'You do not have permission to perform this action');
    req.userRole = roleName;
    next();
  };
}

export async function attachRoleName(req, res, next) {
  if (req.user) {
    let roleName = 'USER';
    if (env.mongoUri && isMongoConnected()) {
      try { const { Role } = await import('../models/index.js'); const r = await Role.findById(req.user.role_id).lean(); roleName = r ? r.name : 'USER'; } catch {}
    } else {
      const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(req.user.role_id);
      roleName = role ? role.name : 'USER';
    }
    req.userRole = roleName;
  }
  next();
}
