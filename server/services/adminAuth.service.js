import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { User, Role } from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { sendAdminOtpEmail } from './emailService.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw).trim()).digest('hex');
}

const OTP_EXPIRES_MINUTES = 10;
const TOKEN_EXPIRES_MINUTES = 15;

function generateOtp() {
  // 6-digit cryptographically secure
  return String(crypto.randomInt(100000, 1000000));
}

export const adminAuthService = {
  async forgotPassword(email) {
    const normalized = String(email).toLowerCase().trim();
    const genericMessage = 'If an admin account exists with this email, an OTP has been sent.';

    let adminUser = null;
    if (useMongo()) {
      const role = await Role.findOne({ name: 'ADMIN' });
      if (!role) return { message: genericMessage };
      adminUser = await User.findOne({ email: normalized, role_id: role._id });
      if (!adminUser) adminUser = await User.findOne({ email: normalized, role_name: 'ADMIN' });
    } else {
      const role = db.prepare("SELECT id FROM roles WHERE name = 'ADMIN'").get();
      if (!role) return { message: genericMessage };
      adminUser = db.prepare('SELECT id, email FROM users WHERE email = ? AND role_id = ?').get(normalized, role.id);
    }

    if (!adminUser) {
      return { message: genericMessage };
    }

    // Cooldown 30s — prevent duplicate emails from double-click
    const cooldownMs = 30 * 1000;
    if (useMongo()) {
      const existing = await User.findOne({ email: normalized });
      if (existing && existing.resetOtpExpires) {
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
      adminUser.resetOtpHash = hashed;
      adminUser.resetOtpExpires = expiresAt;
      // Clear any previous verified token
      adminUser.resetPasswordToken = null;
      adminUser.resetPasswordExpires = null;
      await adminUser.save();
    } else {
      db.prepare('UPDATE users SET reset_otp_hash = ?, reset_otp_expires = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?').run(hashed, expiresIso, adminUser.id);
    }

    if (!env.isProduction) logger.info(`[DEV OTP] for ${normalized}: ${otp} (expires ${OTP_EXPIRES_MINUTES}m)`);

    // Await email delivery with timeout so Render logs capture result before response (fixes "OTP only in render log" confusion)
    try {
      const result = await Promise.race([
        sendAdminOtpEmail({ to: normalized, otp, expiresMinutes: OTP_EXPIRES_MINUTES }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('EMAIL_TIMEOUT')), 30000)),
      ]);
      if (result && result.mocked) logger.warn(`[ADMIN OTP] SMTP not configured — mock OTP for ${normalized}: ${otp} (set Render SMTP env)`);
      else logger.info(`[ADMIN OTP] email delivered to ${normalized} — ${result.messageId || 'ok'} (${result.mocked ? 'mock' : 'smtp'})`);
    } catch (err) {
      logger.error('Admin forgot OTP email failed for ' + normalized + ': ' + (err.message || err));
      if (!env.isProduction) logger.warn(`[ADMIN OTP] fallback dev OTP for ${normalized}: ${otp}`);
    }

    logger.info(`[ADMIN OTP] generated for ${normalized} — expires ${OTP_EXPIRES_MINUTES}m — queued for delivery`);

    return { message: genericMessage, _devOtp: env.isProduction ? undefined : otp };
  },

  async verifyOtp(email, otp) {
    const normalized = String(email).toLowerCase().trim();
    const rawOtp = String(otp).trim();
    if (!rawOtp) throw new Error('OTP_REQUIRED');
    const hashed = hashToken(rawOtp);
    const now = new Date();

    let adminUser = null;
    if (useMongo()) {
      const role = await Role.findOne({ name: 'ADMIN' });
      if (!role) throw new Error('OTP_INVALID');
      adminUser = await User.findOne({ email: normalized, role_id: role._id });
      if (!adminUser) adminUser = await User.findOne({ email: normalized, role_name: 'ADMIN' });
      if (!adminUser) throw new Error('OTP_INVALID');

      if (!adminUser.resetOtpHash || adminUser.resetOtpHash !== hashed) throw new Error('OTP_INVALID');
      if (!adminUser.resetOtpExpires || new Date(adminUser.resetOtpExpires).getTime() < now.getTime()) throw new Error('OTP_EXPIRED');

      // Valid — issue verified reset token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHashed = hashToken(rawToken);
      const tokenExpires = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000);
      adminUser.resetPasswordToken = tokenHashed;
      adminUser.resetPasswordExpires = tokenExpires;
      adminUser.resetOtpHash = null;
      adminUser.resetOtpExpires = null;
      await adminUser.save();
      logger.info(`[ADMIN OTP] verified for ${normalized} — issued reset token`);
      return { token: rawToken, message: 'OTP verified successfully.' };
    } else {
      const role = db.prepare("SELECT id FROM roles WHERE name='ADMIN'").get();
      if (!role) throw new Error('OTP_INVALID');
      adminUser = db.prepare('SELECT id, reset_otp_hash, reset_otp_expires FROM users WHERE email = ? AND role_id = ?').get(normalized, role.id);
      if (!adminUser) throw new Error('OTP_INVALID');
      if (!adminUser.reset_otp_hash || adminUser.reset_otp_hash !== hashed) throw new Error('OTP_INVALID');
      if (!adminUser.reset_otp_expires || new Date(adminUser.reset_otp_expires).getTime() < now.getTime()) throw new Error('OTP_EXPIRED');

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHashed = hashToken(rawToken);
      const tokenExpiresIso = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET reset_password_token = ?, reset_password_expires = ?, reset_otp_hash = NULL, reset_otp_expires = NULL WHERE id = ?').run(tokenHashed, tokenExpiresIso, adminUser.id);
      logger.info(`[ADMIN OTP] verified for ${normalized} — issued reset token (SQLite)`);
      return { token: rawToken, message: 'OTP verified successfully.' };
    }
  },

  async resetPassword(token, newPassword) {
    if (!token || !newPassword) throw new Error('VALIDATION');

    const hashed = hashToken(String(token).trim());
    const now = new Date();

    let user = null;
    if (useMongo()) {
      user = await User.findOne({
        resetPasswordToken: hashed,
        resetPasswordExpires: { $gt: now },
      });
      if (!user) {
        const expired = await User.findOne({ resetPasswordToken: hashed });
        if (expired) throw new Error('TOKEN_EXPIRED');
        throw new Error('TOKEN_INVALID');
      }
    } else {
      user = db.prepare('SELECT id, reset_password_token, reset_password_expires FROM users WHERE reset_password_token = ?').get(hashed);
      if (!user) throw new Error('TOKEN_INVALID');
      if (!user.reset_password_expires || new Date(user.reset_password_expires).getTime() < now.getTime()) {
        throw new Error('TOKEN_EXPIRED');
      }
    }

    const newHash = await hashPassword(String(newPassword));

    if (useMongo()) {
      user.password_hash = newHash;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      // Also clear any leftover OTP
      user.resetOtpHash = null;
      user.resetOtpExpires = null;
      await user.save();
    } else {
      db.prepare('UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL, reset_otp_hash = NULL, reset_otp_expires = NULL WHERE id = ?').run(newHash, user.id);
    }

    logger.audit('admin.password.reset', { tokenHash: hashed.slice(0, 8) + '...' });

    return { message: 'Your password has been reset successfully. You can now log in with your new password.' };
  }
};
