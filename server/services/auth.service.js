import { db } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { generateId } from '../utils/id.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

function publicUser(user) {
  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: role ? role.name : 'USER',
    status: user.status,
    email_verified: !!user.email_verified,
    mobile_verified: !!user.mobile_verified,
    created_at: user.created_at,
  };
}

export const authService = {
  async register({ name, email, mobile, password }) {
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? OR mobile = ?')
      .get(email || 'x', mobile);
    if (existing) {
      const conflictMobile = db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
      throw new Error(conflictMobile ? 'MOBILE_EXISTS' : 'EMAIL_EXISTS');
    }

    const userRole = db.prepare("SELECT id FROM roles WHERE name = 'USER'").get();
    const password_hash = await hashPassword(password);
    const info = db
      .prepare(
        `INSERT INTO users (name, email, mobile, password_hash, role_id) VALUES (?, ?, ?, ?, ?)`
      )
      .run(name, email || null, mobile, password_hash, userRole.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    logger.audit('user.register', { id: user.id, mobile });
    return publicUser(user);
  },

  async login(identifier, password) {
    const user = db
      .prepare('SELECT * FROM users WHERE email = ? OR mobile = ?')
      .get(identifier, identifier);
    if (!user) throw new Error('INVALID_CREDENTIALS');
    const okPass = await comparePassword(password, user.password_hash);
    if (!okPass) throw new Error('INVALID_CREDENTIALS');

    const token = signToken({ sub: user.id, role: user.role_id, jti: generateId() });
    return { token, user: publicUser(user) };
  },

  me(userId) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('NOT_FOUND');
    return publicUser(user);
  },

  issueTokenForUser(user) {
    const token = signToken({ sub: user.id, role: user.role_id, jti: generateId() });
    return { token, user: publicUser(user) };
  },

  findOrCreateByMobile(mobile, name) {
    let user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    if (user) return user;
    const role = db.prepare("SELECT id FROM roles WHERE name = 'USER'").get();
    const info = db
      .prepare('INSERT INTO users (name, mobile, role_id, mobile_verified) VALUES (?, ?, ?, 1)')
      .run(name || 'ZUNO User', mobile, role.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  },

  findOrCreateByEmail(email, name) {
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) return user;
    const role = db.prepare("SELECT id FROM roles WHERE name = 'USER'").get();
    const info = db
      .prepare('INSERT INTO users (name, email, role_id, email_verified) VALUES (?, ?, ?, 1)')
      .run(name || 'ZUNO User', email, role.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  },

  async requestOtp({ mobile }) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM otp_codes WHERE mobile = ? AND purpose = ?').run(mobile, 'login');
    db.prepare('INSERT INTO otp_codes (mobile, code, purpose, expires_at) VALUES (?, ?, ?, ?)')
      .run(mobile, code, 'login', expires);
    logger.info(`OTP requested for ${mobile}`);
    // In production, send via SMS gateway. Dev fallback: return the code so the UI can autofill.
    return { devOtp: env.isProduction ? undefined : code };
  },

  verifyOtp({ mobile, code, name }) {
    const row = db.prepare('SELECT * FROM otp_codes WHERE mobile = ? AND purpose = ? ORDER BY id DESC LIMIT 1').get(mobile, 'login');
    if (!row) throw new Error('NO_OTP');
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('OTP_EXPIRED');
    if (row.code !== String(code)) throw new Error('OTP_INVALID');
    db.prepare('DELETE FROM otp_codes WHERE mobile = ? AND purpose = ?').run(mobile, 'login');
    const user = this.findOrCreateByMobile(mobile, name);
    return this.issueTokenForUser(user);
  },

  async googleLogin({ idToken }) {
    if (!idToken) throw new Error('TOKEN_REQUIRED');
    let payload;
    try {
      const resp = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
      if (!resp.ok) throw new Error('GOOGLE_INVALID');
      payload = await resp.json();
    } catch (e) {
      logger.error('google tokeninfo', e);
      throw new Error('GOOGLE_INVALID');
    }
    if (payload.aud !== env.google.clientId) throw new Error('GOOGLE_AUD_MISMATCH');
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new Error('GOOGLE_ISS_INVALID');
    if (Number(payload.exp) * 1000 < Date.now()) throw new Error('GOOGLE_EXPIRED');
    if (!payload.email) throw new Error('GOOGLE_NO_EMAIL');

    const user = this.findOrCreateByEmail(payload.email, payload.name || payload.email.split('@')[0]);
    return this.issueTokenForUser(user);
  },
};
