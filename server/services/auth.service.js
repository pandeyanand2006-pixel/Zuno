import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { generateId } from '../utils/id.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { isMongoConnected } from '../config/mongo.js';
import { User, Role, OtpCode } from '../models/index.js';
import { sendPasswordResetOtpEmail } from './emailService.js';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetSuccessEmail } from '../utils/email.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

function hashToken(raw) { return crypto.createHash('sha256').update(String(raw).trim()).digest('hex'); }
const OTP_EXPIRES_MINUTES = 10;
const TOKEN_EXPIRES_MINUTES = 15;
const VERIFICATION_EXPIRES_MINUTES = 10;
function generateOtp() { return String(crypto.randomInt(100000, 1000000)); }

async function getRoleDoc(name = 'USER') {
  if (useMongo()) return await Role.findOne({ name });
  return db.prepare('SELECT id FROM roles WHERE name = ?').get(name);
}
async function getRoleName(roleId) {
  if (!roleId) return 'USER';
  if (useMongo()) {
    try { const r = await Role.findById(roleId).lean(); return r ? r.name : 'USER'; } catch { return 'USER'; }
  }
  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(roleId);
  return role ? role.name : 'USER';
}
async function toPublicUser(user) {
  if (!user) return null;
  const roleName = user.role_name || await getRoleName(user.role_id);
  const id = String(user._id || user.id);
  return {
    id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: roleName,
    role_id: user.role_id,
    status: user.status,
    email_verified: !!user.email_verified,
    mobile_verified: !!user.mobile_verified,
    created_at: user.created_at,
  };
}

export const authService = {
  async register({ name, email, mobile, password }) {
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
    if (useMongo()) {
      const existing = await User.findOne({ $or: [{ email: normalizedEmail || '__none' }, { mobile }] });
      if (existing) {
        const conflictMobile = await User.findOne({ mobile });
        throw new Error(conflictMobile ? 'MOBILE_EXISTS' : 'EMAIL_EXISTS');
      }
      const role = await Role.findOne({ name: 'USER' });
      const password_hash = await hashPassword(password);
      const user = await User.create({ name, email: normalizedEmail || null, mobile, password_hash, role_id: role._id, role_name: 'USER', email_verified: normalizedEmail ? false : true });
      logger.audit('user.register', { id: String(user._id), mobile });
      // ── Registration + Email Verification Flow (TalkSpace pattern) ──
      if (normalizedEmail) {
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000);
        await OtpCode.deleteMany({ email: normalizedEmail, purpose: 'verify' });
        await OtpCode.create({ email: normalizedEmail, code: otp, purpose: 'verify', expires_at: expiresAt });
        logger.info(`[register] Verification email requested for ${normalizedEmail.slice(0, 3)}***`);
        try {
          await Promise.race([
            sendVerificationEmail({ to: normalizedEmail, otp, expiresMinutes: VERIFICATION_EXPIRES_MINUTES }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('EMAIL_TIMEOUT')), 30000)),
          ]);
          logger.info(`[register] Verification email sent to ${normalizedEmail.slice(0, 3)}***`);
        } catch (err) {
          logger.error(`[register] Verification email failed for ${normalizedEmail.slice(0, 3)}***: ${err.message}`);
          // Don't expose failure as success — throw so controller can handle, but keep user created
          // We still want to inform frontend that verification email failed
          // For now, log and continue; frontend will allow resend
          if (!env.isProduction) logger.info(`[DEV VERIFY OTP] for ${normalizedEmail}: ${otp}`);
          // Throw to make caller aware — but we don't delete user
          // Instead, return special flag
          const pub = await toPublicUser(user.toObject());
          return { user: pub, needsVerification: true, verificationEmailFailed: true, message: 'Account created but verification email failed. Please resend code.', _devOtp: env.isProduction ? undefined : otp };
        }
        if (!env.isProduction) logger.info(`[DEV VERIFY OTP] for ${normalizedEmail}: ${otp} (expires ${VERIFICATION_EXPIRES_MINUTES}m)`);
        const pub = await toPublicUser(user.toObject());
        return { user: pub, needsVerification: true, message: 'Account created. Verification OTP sent to email.', _devOtp: env.isProduction ? undefined : otp };
      }
      return toPublicUser(user.toObject());
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR mobile = ?').get(normalizedEmail || 'x', mobile);
    if (existing) {
      const conflictMobile = db.prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
      throw new Error(conflictMobile ? 'MOBILE_EXISTS' : 'EMAIL_EXISTS');
    }
    const userRole = db.prepare("SELECT id FROM roles WHERE name = 'USER'").get();
    const password_hash = await hashPassword(password);
    const emailVerified = normalizedEmail ? 0 : 1;
    const info = db.prepare('INSERT INTO users (name, email, mobile, password_hash, role_id, email_verified) VALUES (?, ?, ?, ?, ?, ?)').run(name, normalizedEmail || null, mobile, password_hash, userRole.id, emailVerified);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    logger.audit('user.register', { id: user.id, mobile });
    if (normalizedEmail) {
      const otp = generateOtp();
      const expiresIso = new Date(Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000).toISOString();
      db.prepare('DELETE FROM otp_codes WHERE email = ? AND purpose = ?').run(normalizedEmail, 'verify');
      db.prepare('INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)').run(normalizedEmail, otp, 'verify', expiresIso);
      logger.info(`[register] Verification email requested for ${normalizedEmail.slice(0, 3)}***`);
      try {
        await Promise.race([
          sendVerificationEmail({ to: normalizedEmail, otp, expiresMinutes: VERIFICATION_EXPIRES_MINUTES }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('EMAIL_TIMEOUT')), 30000)),
        ]);
        logger.info(`[register] Verification email sent to ${normalizedEmail.slice(0, 3)}***`);
      } catch (err) {
        logger.error(`[register] Verification email failed for ${normalizedEmail.slice(0, 3)}***: ${err.message}`);
        if (!env.isProduction) logger.info(`[DEV VERIFY OTP] for ${normalizedEmail}: ${otp}`);
        const pub = await toPublicUser(user);
        return { user: pub, needsVerification: true, verificationEmailFailed: true, message: 'Account created but verification email failed. Please resend code.', _devOtp: env.isProduction ? undefined : otp };
      }
      if (!env.isProduction) logger.info(`[DEV VERIFY OTP] for ${normalizedEmail}: ${otp} (expires ${VERIFICATION_EXPIRES_MINUTES}m)`);
      const pub = await toPublicUser(user);
      return { user: pub, needsVerification: true, message: 'Account created. Verification OTP sent to email.', _devOtp: env.isProduction ? undefined : otp };
    }
    return toPublicUser(user);
  },

  // ── Email Verification (TalkSpace pattern) ──
  async verifyEmail({ email, otp }) {
    const normalized = String(email).toLowerCase().trim();
    const code = String(otp).trim();
    if (!code) throw new Error('OTP_REQUIRED');
    const now = new Date();
    if (useMongo()) {
      const row = await OtpCode.findOne({ email: normalized, purpose: 'verify' }).sort({ _id: -1 });
      if (!row) throw new Error('OTP_INVALID');
      if (new Date(row.expires_at).getTime() < now.getTime()) throw new Error('OTP_EXPIRED');
      if (row.code !== code) throw new Error('OTP_INVALID');
      await OtpCode.deleteMany({ email: normalized, purpose: 'verify' });
      const user = await User.findOne({ email: normalized });
      if (!user) throw new Error('NOT_FOUND');
      // Already verified? Idempotent
      if (user.email_verified) return this.issueTokenForUser(user);
      user.email_verified = true;
      await user.save();
      // Welcome email — non-blocking but await with catch (TalkSpace: await then handle)
      try {
        await sendWelcomeEmail({ to: normalized, name: user.name });
      } catch (e) { logger.warn(`[verify] Welcome email failed for ${normalized.slice(0, 3)}***: ${e.message}`); }
      logger.info(`[verify] Email verified for ${normalized}`);
      return this.issueTokenForUser(user);
    }
    const row = db.prepare('SELECT * FROM otp_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1').get(normalized, 'verify');
    if (!row) throw new Error('OTP_INVALID');
    if (new Date(row.expires_at).getTime() < now.getTime()) throw new Error('OTP_EXPIRED');
    if (row.code !== code) throw new Error('OTP_INVALID');
    db.prepare('DELETE FROM otp_codes WHERE email = ? AND purpose = ?').run(normalized, 'verify');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
    if (!user) throw new Error('NOT_FOUND');
    if (user.email_verified) {
      return this.issueTokenForUser(user);
    }
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    try {
      await sendWelcomeEmail({ to: normalized, name: updated.name });
    } catch (e) { logger.warn(`[verify] Welcome email failed for ${normalized.slice(0, 3)}***: ${e.message}`); }
    logger.info(`[verify] Email verified for ${normalized} (SQLite)`);
    return this.issueTokenForUser(updated);
  },

  async resendVerification({ email }) {
    const normalized = String(email).toLowerCase().trim();
    const cooldownMs = 30 * 1000;
    let user = null;
    if (useMongo()) {
      user = await User.findOne({ email: normalized });
      if (!user) throw new Error('NOT_FOUND');
      if (user.email_verified) throw new Error('ALREADY_VERIFIED');
      // Cooldown 30s — use created_at for accuracy
      const recent = await OtpCode.findOne({ email: normalized, purpose: 'verify' }).sort({ created_at: -1 });
      if (recent && recent.created_at && new Date(recent.created_at).getTime() > Date.now() - cooldownMs) {
        throw new Error('COOLDOWN');
      } else if (recent && !recent.created_at && new Date(recent.expires_at).getTime() > Date.now() + (VERIFICATION_EXPIRES_MINUTES * 60 * 1000 - cooldownMs)) {
        // fallback if created_at missing
        throw new Error('COOLDOWN');
      }
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000);
      await OtpCode.deleteMany({ email: normalized, purpose: 'verify' });
      await OtpCode.create({ email: normalized, code: otp, purpose: 'verify', expires_at: expiresAt });
      logger.info(`[resend] Verification email requested for ${normalized.slice(0, 3)}***`);
      await Promise.race([
        sendVerificationEmail({ to: normalized, otp, expiresMinutes: VERIFICATION_EXPIRES_MINUTES }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('EMAIL_TIMEOUT')), 30000)),
      ]);
      logger.info(`[resend] Verification email sent to ${normalized.slice(0, 3)}***`);
      return { message: 'Verification OTP resent.', _devOtp: env.isProduction ? undefined : otp };
    }
    user = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(normalized);
    if (!user) throw new Error('NOT_FOUND');
    if (user.email_verified) throw new Error('ALREADY_VERIFIED');
    const recentRow = db.prepare('SELECT created_at, expires_at FROM otp_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1').get(normalized, 'verify');
    if (recentRow && recentRow.created_at && new Date(recentRow.created_at).getTime() > Date.now() - cooldownMs) {
      throw new Error('COOLDOWN');
    } else if (recentRow && recentRow.expires_at && new Date(recentRow.expires_at).getTime() > Date.now() + (VERIFICATION_EXPIRES_MINUTES * 60 * 1000 - cooldownMs)) {
      throw new Error('COOLDOWN');
    }
    const otp = generateOtp();
    const expiresIso = new Date(Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000).toISOString();
    db.prepare('DELETE FROM otp_codes WHERE email = ? AND purpose = ?').run(normalized, 'verify');
    db.prepare('INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)').run(normalized, otp, 'verify', expiresIso);
    logger.info(`[resend] Verification email requested for ${normalized.slice(0, 3)}***`);
    await Promise.race([
      sendVerificationEmail({ to: normalized, otp, expiresMinutes: VERIFICATION_EXPIRES_MINUTES }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('EMAIL_TIMEOUT')), 30000)),
    ]);
    logger.info(`[resend] Verification email sent to ${normalized.slice(0, 3)}*** (SQLite)`);
    return { message: 'Verification OTP resent.', _devOtp: env.isProduction ? undefined : otp };
  },

  async login(identifier, password) {
    if (useMongo()) {
      const user = await User.findOne({ $or: [{ email: identifier }, { mobile: identifier }] });
      if (!user) throw new Error('INVALID_CREDENTIALS');
      const okPass = await comparePassword(password, user.password_hash);
      if (!okPass) throw new Error('INVALID_CREDENTIALS');
      // FIX: allow login with correct password even if email not verified
      // Previously: if (user.email && !user.email_verified) throw EMAIL_NOT_VERIFIED -> blocked admin zunoworld3121@gmail.com
      // Owner requested: correct email+password must log in directly, no OTP
      const pub = await toPublicUser(user.toObject());
      const token = signToken({ sub: pub.id, role: pub.role_id, jti: generateId() });
      return { token, user: pub };
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR mobile = ?').get(identifier, identifier);
    if (!user) throw new Error('INVALID_CREDENTIALS');
    const okPass = await comparePassword(password, user.password_hash);
    if (!okPass) throw new Error('INVALID_CREDENTIALS');
    // FIX: allow login with correct password even if email not verified
    const pub = await toPublicUser(user);
    const token = signToken({ sub: pub.id, role: pub.role_id, jti: generateId() });
    return { token, user: pub };
  },

  async me(userId) {
    if (useMongo()) {
      const user = await User.findById(userId);
      if (!user) throw new Error('NOT_FOUND');
      return toPublicUser(user.toObject());
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('NOT_FOUND');
    return toPublicUser(user);
  },

  async issueTokenForUser(user) {
    const pub = await toPublicUser(user._id ? user.toObject ? user.toObject() : user : user);
    const token = signToken({ sub: pub.id, role: pub.role_id, jti: generateId() });
    return { token, user: pub };
  },

  async findOrCreateByMobile(mobile, name) {
    if (useMongo()) {
      let user = await User.findOne({ mobile });
      if (user) return user;
      const role = await Role.findOne({ name: 'USER' });
      user = await User.create({ name: name || 'ZUNO User', mobile, role_id: role._id, role_name: 'USER', mobile_verified: true });
      return user;
    }
    let user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    if (user) return user;
    const role = db.prepare("SELECT id FROM roles WHERE name = 'USER'").get();
    const info = db.prepare('INSERT INTO users (name, mobile, role_id, mobile_verified) VALUES (?, ?, ?, 1)').run(name || 'ZUNO User', mobile, role.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  },

  async findOrCreateByEmail(email, name) {
    if (useMongo()) {
      let user = await User.findOne({ email });
      if (user) return user;
      const role = await Role.findOne({ name: 'USER' });
      user = await User.create({ name: name || 'ZUNO User', email, role_id: role._id, role_name: 'USER', email_verified: true });
      return user;
    }
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) return user;
    const role = db.prepare("SELECT id FROM roles WHERE name = 'USER'").get();
    const info = db.prepare('INSERT INTO users (name, email, role_id, email_verified) VALUES (?, ?, ?, 1)').run(name || 'ZUNO User', email, role.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  },

  async requestOtp({ mobile }) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    if (useMongo()) {
      await OtpCode.deleteMany({ mobile, purpose: 'login' });
      await OtpCode.create({ mobile, code, purpose: 'login', expires_at: expires });
      logger.info(`OTP requested for ${mobile}`);
      return { devOtp: env.isProduction ? undefined : code };
    }
    const expiresIso = expires.toISOString();
    db.prepare('DELETE FROM otp_codes WHERE mobile = ? AND purpose = ?').run(mobile, 'login');
    db.prepare('INSERT INTO otp_codes (mobile, code, purpose, expires_at) VALUES (?, ?, ?, ?)').run(mobile, code, 'login', expiresIso);
    logger.info(`OTP requested for ${mobile}`);
    return { devOtp: env.isProduction ? undefined : code };
  },

  async verifyOtp({ mobile, code, name }) {
    if (useMongo()) {
      const row = await OtpCode.findOne({ mobile, purpose: 'login' }).sort({ _id: -1 });
      if (!row) throw new Error('NO_OTP');
      if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('OTP_EXPIRED');
      if (row.code !== String(code)) throw new Error('OTP_INVALID');
      await OtpCode.deleteMany({ mobile, purpose: 'login' });
      const user = await this.findOrCreateByMobile(mobile, name);
      return this.issueTokenForUser(user);
    }
    const row = db.prepare('SELECT * FROM otp_codes WHERE mobile = ? AND purpose = ? ORDER BY id DESC LIMIT 1').get(mobile, 'login');
    if (!row) throw new Error('NO_OTP');
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error('OTP_EXPIRED');
    if (row.code !== String(code)) throw new Error('OTP_INVALID');
    db.prepare('DELETE FROM otp_codes WHERE mobile = ? AND purpose = ?').run(mobile, 'login');
    const user = await this.findOrCreateByMobile(mobile, name);
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
    const user = await this.findOrCreateByEmail(payload.email, payload.name || payload.email.split('@')[0]);
    return this.issueTokenForUser(user);
  },

  // --- User Forgot Password (email OTP flow, live) ---
  async forgotPassword(email) {
    const normalized = String(email).toLowerCase().trim();
    const genericMessage = 'If an account exists with this email, an OTP has been sent.';
    let user = null;
    if (useMongo()) {
      user = await User.findOne({ email: normalized });
    } else {
      user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(normalized);
    }
    if (!user) return { message: genericMessage };

    // Cooldown: if OTP was sent within last 30s, don't spam (prevents duplicate emails from double-click/fallback retry)
    const cooldownMs = 30 * 1000;
    if (useMongo()) {
      const existing = await User.findOne({ email: normalized });
      if (existing && existing.resetOtpExpires) {
        // created ≈ expires - OTP_EXPIRES; check if created was within cooldown window
        const createdMs = new Date(existing.resetOtpExpires).getTime() - OTP_EXPIRES_MINUTES * 60 * 1000;
        if (createdMs > Date.now() - cooldownMs) throw new Error('COOLDOWN');
      }
    } else {
      const row = db.prepare('SELECT reset_otp_expires FROM users WHERE email = ?').get(normalized);
      if (row && row.reset_otp_expires) {
        const createdMs = new Date(row.reset_otp_expires).getTime() - OTP_EXPIRES_MINUTES * 60 * 1000;
        if (createdMs > Date.now() - cooldownMs) throw new Error('COOLDOWN');
      }
    }

    const otp = generateOtp();
    const hashed = hashToken(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    const expiresIso = expiresAt.toISOString();

    if (useMongo()) {
      const u = await User.findOne({ email: normalized });
      u.resetOtpHash = hashed;
      u.resetOtpExpires = expiresAt;
      u.resetPasswordToken = null;
      u.resetPasswordExpires = null;
      await u.save();
    } else {
      db.prepare('UPDATE users SET reset_otp_hash = ?, reset_otp_expires = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?').run(hashed, expiresIso, user.id);
    }

    // Log OTP only in dev — in production OTP goes only via email (not log) for security
    if (!env.isProduction) logger.info(`[DEV USER OTP] for ${normalized}: ${otp} (expires ${OTP_EXPIRES_MINUTES}m)`);

    // Deliver via email synchronously with timeout guard — ensures user actually gets email on mobile
    // Do not use fire-and-forget void here; we await so Render logs capture delivery status before response
    try {
      const result = await Promise.race([
        sendPasswordResetOtpEmail({ to: normalized, otp, expiresMinutes: OTP_EXPIRES_MINUTES, isAdmin: false }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('EMAIL_TIMEOUT')), 30000)),
      ]);
      if (result && result.mocked) {
        logger.warn(`[USER OTP] SMTP not configured — OTP for ${normalized} logged as mock (set Render SMTP env to deliver via email)`);
        if (!env.isProduction) logger.info(`[USER OTP] mock preview: ${otp}`);
      } else {
        logger.info(`[USER OTP] email delivered to ${normalized} — ${result.messageId || 'ok'}`);
      }
    } catch (err) {
      logger.error('User forgot OTP email failed for ' + normalized + ': ' + (err.message || err));
      // If email fails in production, still keep OTP stored but log clearly — frontend will show generic success
      // but ops can check Render logs for EMAIL_FAILED. Don't expose OTP to client in prod.
      if (!env.isProduction) logger.warn(`[USER OTP] fallback dev OTP for ${normalized}: ${otp}`);
    }
    logger.info(`[USER OTP] generated for ${normalized} — queued`);
    return { message: genericMessage, _devOtp: env.isProduction ? undefined : otp };
  },

  async verifyForgotOtp(email, otp) {
    const normalized = String(email).toLowerCase().trim();
    const rawOtp = String(otp).trim();
    if (!rawOtp) throw new Error('OTP_REQUIRED');
    const hashed = hashToken(rawOtp);
    const now = new Date();
    let user = null;
    if (useMongo()) {
      user = await User.findOne({ email: normalized });
      if (!user) throw new Error('OTP_INVALID');
      if (!user.resetOtpHash || user.resetOtpHash !== hashed) throw new Error('OTP_INVALID');
      if (!user.resetOtpExpires || new Date(user.resetOtpExpires).getTime() < now.getTime()) throw new Error('OTP_EXPIRED');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHashed = hashToken(rawToken);
      const tokenExpires = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000);
      user.resetPasswordToken = tokenHashed;
      user.resetPasswordExpires = tokenExpires;
      user.resetOtpHash = null;
      user.resetOtpExpires = null;
      await user.save();
      logger.info(`[USER OTP] verified for ${normalized}`);
      return { token: rawToken, message: 'OTP verified successfully.' };
    } else {
      user = db.prepare('SELECT id, reset_otp_hash, reset_otp_expires FROM users WHERE email = ?').get(normalized);
      if (!user) throw new Error('OTP_INVALID');
      if (!user.reset_otp_hash || user.reset_otp_hash !== hashed) throw new Error('OTP_INVALID');
      if (!user.reset_otp_expires || new Date(user.reset_otp_expires).getTime() < now.getTime()) throw new Error('OTP_EXPIRED');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHashed = hashToken(rawToken);
      const tokenExpiresIso = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET reset_password_token = ?, reset_password_expires = ?, reset_otp_hash = NULL, reset_otp_expires = NULL WHERE id = ?').run(tokenHashed, tokenExpiresIso, user.id);
      logger.info(`[USER OTP] verified for ${normalized} (SQLite)`);
      return { token: rawToken, message: 'OTP verified successfully.' };
    }
  },

  async resetPasswordWithToken(token, newPassword) {
    if (!token || !newPassword) throw new Error('VALIDATION');
    const hashed = hashToken(String(token).trim());
    const now = new Date();
    let user = null;
    if (useMongo()) {
      user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: now } });
      if (!user) {
        const expired = await User.findOne({ resetPasswordToken: hashed });
        if (expired) throw new Error('TOKEN_EXPIRED');
        throw new Error('TOKEN_INVALID');
      }
    } else {
      user = db.prepare('SELECT id, reset_password_token, reset_password_expires FROM users WHERE reset_password_token = ?').get(hashed);
      if (!user) throw new Error('TOKEN_INVALID');
      if (!user.reset_password_expires || new Date(user.reset_password_expires).getTime() < now.getTime()) throw new Error('TOKEN_EXPIRED');
    }
    const newHash = await hashPassword(String(newPassword));
    let emailForSuccess = null;
    if (useMongo()) {
      emailForSuccess = user.email;
      user.password_hash = newHash;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      user.resetOtpHash = null;
      user.resetOtpExpires = null;
      await user.save();
    } else {
      const full = db.prepare('SELECT email FROM users WHERE id = ?').get(user.id);
      emailForSuccess = full ? full.email : null;
      db.prepare('UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL, reset_otp_hash = NULL, reset_otp_expires = NULL WHERE id = ?').run(newHash, user.id);
    }
    logger.audit('user.password.reset', { tokenHash: hashed.slice(0, 8) + '...' });
    if (emailForSuccess) {
      try {
        await sendPasswordResetSuccessEmail({ to: emailForSuccess });
      } catch (e) { logger.warn(`[reset] Success email failed for ${emailForSuccess.slice(0, 3)}***: ${e.message}`); }
    }
    return { message: 'Your password has been reset successfully. You can now log in with your new password.' };
  },
};
