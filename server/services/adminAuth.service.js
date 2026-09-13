import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { User, Role } from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { sendAdminPasswordResetEmail } from './emailService.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const EXPIRES_MINUTES = 30;

export const adminAuthService = {
  async forgotPassword(email) {
    const normalized = String(email).toLowerCase().trim();
    const genericMessage = 'If an admin account exists with this email, a password reset link has been sent.';

    let adminUser = null;
    let adminRoleId = null;

    if (useMongo()) {
      const role = await Role.findOne({ name: 'ADMIN' });
      if (!role) return { message: genericMessage };
      adminRoleId = role._id;
      adminUser = await User.findOne({ email: normalized, role_id: role._id });
      if (!adminUser) {
        // Also check role_name fallback
        adminUser = await User.findOne({ email: normalized, role_name: 'ADMIN' });
      }
    } else {
      const role = db.prepare("SELECT id FROM roles WHERE name = 'ADMIN'").get();
      if (!role) return { message: genericMessage };
      adminRoleId = role.id;
      adminUser = db.prepare('SELECT id, email FROM users WHERE email = ? AND role_id = ?').get(normalized, role.id);
    }

    if (!adminUser) {
      // Generic success — do not reveal
      return { message: genericMessage };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000);
    const expiresIso = expiresAt.toISOString();

    if (useMongo()) {
      adminUser.resetPasswordToken = hashed;
      adminUser.resetPasswordExpires = expiresAt;
      await adminUser.save();
    } else {
      db.prepare('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?').run(hashed, expiresIso, adminUser.id);
    }

    // Send email — do not throw email failures to user enumeration; log and still return generic success
    let emailResult = null;
    try {
      emailResult = await sendAdminPasswordResetEmail({ to: normalized, rawToken, expiresMinutes: EXPIRES_MINUTES });
    } catch (err) {
      if (err.message === 'EMAIL_FAILED') {
        logger.error('Admin forgot-password email failed for ' + normalized, err.message);
      } else {
        logger.error('Admin forgot-password email unexpected error', err.message);
      }
    }

    // Always log preview link for server-side debugging (never expose token in prod response)
    const frontendUrl = (env.frontendUrl || 'http://localhost:5500').split(',')[0].trim();
    const previewUrl = `${frontendUrl}/#/admin/reset-password?token=${rawToken}`;
    logger.info(`[ADMIN RESET] token generated for ${normalized} — preview: ${previewUrl} — email ${emailResult?.messageId ? 'sent '+emailResult.messageId : emailResult?.mocked ? 'mocked' : 'attempted'}`);

    return { message: genericMessage, _devToken: env.isProduction ? undefined : rawToken, _previewUrl: env.isProduction ? undefined : previewUrl };
  },

  async resetPassword(token, newPassword) {
    if (!token || !newPassword) throw new Error('VALIDATION');

    const hashed = hashToken(String(token).trim());
    const now = new Date();
    const nowIso = now.toISOString();

    let user = null;
    if (useMongo()) {
      user = await User.findOne({
        resetPasswordToken: hashed,
        resetPasswordExpires: { $gt: now },
      });
      if (!user) {
        // Check if token exists but expired
        const expired = await User.findOne({ resetPasswordToken: hashed });
        if (expired) throw new Error('TOKEN_EXPIRED');
        throw new Error('TOKEN_INVALID');
      }
    } else {
      // SQLite: token is stored as hex hash, expires as ISO string
      user = db.prepare('SELECT id, reset_password_token, reset_password_expires FROM users WHERE reset_password_token = ?').get(hashed);
      if (!user) throw new Error('TOKEN_INVALID');
      if (!user.reset_password_expires || new Date(user.reset_password_expires).getTime() < now.getTime()) {
        throw new Error('TOKEN_EXPIRED');
      }
    }

    // Password already validated by zod; hash and save, invalidate token
    const newHash = await hashPassword(String(newPassword));

    if (useMongo()) {
      user.password_hash = newHash;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
    } else {
      db.prepare('UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?').run(newHash, user.id);
    }

    logger.audit('admin.password.reset', { tokenHash: hashed.slice(0, 8) + '...' });

    return { message: 'Your password has been reset successfully. You can now log in with your new password.' };
  }
};
