import { verifyToken } from '../utils/jwt.js';
import { db } from '../config/db.js';
import { unauthorized, forbidden } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    let token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token && req.cookies && req.cookies.zuno_token) token = req.cookies.zuno_token;

    if (!token) return unauthorized(res, 'Authentication required');

    const payload = verifyToken(token);
    if (!payload || !payload.sub) return unauthorized(res, 'Invalid or expired session');

    const user = db.prepare('SELECT id, name, email, mobile, role_id, status FROM users WHERE id = ?').get(payload.sub);
    if (!user) return unauthorized(res, 'Account no longer exists');
    if (user.status === 'suspended') return forbidden(res, 'Your account has been suspended');

    req.user = user;
    next();
  } catch (err) {
    logger.error('authMiddleware', err);
    return unauthorized(res, 'Invalid or expired session');
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(req.user.role_id);
    if (!role || !roles.includes(role.name)) {
      return forbidden(res, 'You do not have permission to perform this action');
    }
    req.userRole = role.name;
    next();
  };
}

export function attachRoleName(req, res, next) {
  if (req.user) {
    const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(req.user.role_id);
    req.userRole = role ? role.name : 'USER';
  }
  next();
}
