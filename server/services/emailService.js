import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  // Gmail: 465 => SSL (secure true) is fastest, 587 => STARTTLS (secure false + requireTLS)
  const port = Number(env.smtp.port) || 587;
  const is465 = port === 465;
  const cfg = {
    host: env.smtp.host || 'smtp.gmail.com',
    port,
    secure: is465 ? true : !!env.smtp.secure,
    requireTLS: !is465,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: undefined,
  };
  if (env.smtp.user && env.smtp.pass) {
    cfg.auth = { user: env.smtp.user, pass: env.smtp.pass };
  }
  transporter = nodemailer.createTransport(cfg);
  // Verify asynchronously without crashing boot
  if (env.smtp.user && env.smtp.pass) {
    transporter.verify().then(() => {
      logger.info('SMTP connection verified');
    }).catch((err) => {
      logger.warn('SMTP connection failed');
      logger.error('SMTP verify error', err.message);
    });
  } else {
    logger.warn('SMTP not configured — emails will be logged but not sent');
  }
  return transporter;
}

function getFrontendUrl() {
  // Use first origin if multiple comma-separated
  const raw = env.frontendUrl || 'http://localhost:5500';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

export async function sendAdminPasswordResetEmail({ to, rawToken, expiresMinutes = 30 }) {
  const frontendUrl = getFrontendUrl();
  const resetUrl = `${frontendUrl}/#\/admin\/reset-password?token=${encodeURIComponent(rawToken)}`;
  // Also support clean path for future router changes
  const altUrl = `${frontendUrl}/admin/reset-password?token=${encodeURIComponent(rawToken)}`;

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0f172a;padding:24px 28px;text-align:center">
      <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
      <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO ADMIN</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Reset Your Admin Password</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Hello Admin,</p>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">We received a request to reset the password for your admin account (<strong>${to}</strong>). Click the button below to create a new password.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:14px">Reset Password</a>
      </div>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.5">Or copy and paste this link into your browser:</p>
      <p style="margin:0 0 16px;word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px;color:#334155">${resetUrl}</p>
      <p style="margin:0 0 12px;color:#334155;font-size:13px"><strong>This link will expire in ${expiresMinutes} minutes</strong> and can only be used once.</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5">If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      <div style="margin-top:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">
        <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.5"><strong>Security notice:</strong> For security reasons, never share this reset link with anyone. ZUNO will never ask for your password via email.</p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO — Modern Everyday Clothing</p>
    </div>
  </div>`;

  const text = `Hello Admin,

We received a request to reset the password for your admin account (${to}).

Reset your password by visiting:
${resetUrl}

This link will expire in ${expiresMinutes} minutes and can only be used once.

If you did not request this, you can safely ignore this email.

— ZUNO Admin`;

  // Properly format From: allow "ZUNO <email>" or plain email, ensure Gmail alignment
  const rawFrom = env.smtp.from || env.smtp.user || 'noreply@zuno.app';
  // If from already contains <>, keep as is, else wrap with display name if NOTIFY_EMAIL_FROM has it
  const from = rawFrom.includes('<') ? rawFrom : rawFrom;

  // If SMTP not configured, log and return without failing the flow
  if (!env.smtp.user || !env.smtp.pass) {
    logger.info(`[email mock] Would send admin reset to ${to} — link: ${resetUrl}`);
    logger.info(`[email mock] Preview URL for dev: ${resetUrl}`);
    return { mocked: true, resetUrl };
  }

  // Always log preview URL for debugging (without exposing to client)
  logger.info(`[email] Preparing admin reset for ${to} — link expires in ${expiresMinutes}m: ${resetUrl}`);

  const t = getTransporter();
  try {
    const info = await t.sendMail({
      from,
      to,
      subject: 'Reset Your Admin Password — ZUNO',
      text,
      html,
      // Ensure Gmail treats as transactional
      headers: { 'X-Mailer': 'ZUNO Admin Reset' },
    });
    logger.info(`Admin reset email sent to ${to} (${info.messageId || 'no-id'}) — accepted: ${(info.accepted||[]).join(',')} rejected: ${(info.rejected||[]).join(',')}`);
    if (info.rejected && info.rejected.length) logger.warn(`[email] Rejected recipients: ${info.rejected.join(',')}`);
    return { messageId: info.messageId, resetUrl, accepted: info.accepted, rejected: info.rejected };
  } catch (err) {
    logger.error('Failed to send admin reset email', err.message);
    // Log safe diagnostic without password
    logger.error(`[email] SMTP host=${env.smtp.host} port=${env.smtp.port} user=${env.smtp.user ? env.smtp.user.slice(0,3)+'***' : 'none'}`);
    throw new Error('EMAIL_FAILED');
  }
}

export async function sendAdminOtpEmail({ to, otp, expiresMinutes = 10 }) {
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0f172a;padding:24px 28px;text-align:center">
      <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
      <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO ADMIN</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Your Admin Password Reset OTP</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Hello Admin,</p>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">We received a request to reset the password for your admin account (<strong>${to}</strong>). Use the OTP below to verify your identity.</p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#f8fafc;border:2px dashed #1e40af;border-radius:12px;padding:16px 32px">
          <div style="font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0f172a">${otp}</div>
          <div style="font-size:11px;color:#64748b;letter-spacing:0.1em;margin-top:4px">ONE-TIME PASSWORD</div>
        </div>
      </div>
      <p style="margin:0 0 12px;color:#334155;font-size:13px;text-align:center"><strong>Expires in ${expiresMinutes} minutes</strong> • One-time use only</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5">Enter this OTP on the verification page to proceed to set a new password.</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5">If you did not request this, you can safely ignore this email. Your password will not be changed.</p>
      <div style="margin-top:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">
        <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.5"><strong>Security:</strong> Never share this OTP with anyone. ZUNO will never ask for it via phone.</p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO — Modern Everyday Clothing</p>
    </div>
  </div>`;

  const text = `Your admin OTP is: ${otp}\nExpires in ${expiresMinutes} minutes.\nIf you did not request, ignore.`;

  const rawFrom = env.smtp.from || env.smtp.user || 'noreply@zuno.app';
  const from = rawFrom.includes('<') ? rawFrom : rawFrom;

  if (!env.smtp.user || !env.smtp.pass) {
    logger.info(`[email mock] Would send admin OTP to ${to} — OTP: ${otp}`);
    return { mocked: true, otp };
  }

  logger.info(`[email] Sending admin OTP to ${to} — expires ${expiresMinutes}m`);
  const t = getTransporter();
  try {
    const info = await t.sendMail({
      from,
      to,
      subject: 'Your Admin Password Reset OTP — ZUNO',
      text,
      html,
      priority: 'high',
      headers: { 'X-Mailer': 'ZUNO Admin OTP', 'X-Priority': '1', 'Importance': 'high' },
      envelope: { from: env.smtp.user || from, to },
    });
    logger.info(`Admin OTP sent to ${to} (${info.messageId || 'no-id'}) — accepted: ${(info.accepted||[]).join(',')} — ${((Date.now()-Date.now())||0)}ms`);
    return { messageId: info.messageId, otp: env.isProduction ? undefined : otp };
  } catch (err) {
    logger.error('Failed to send admin OTP', err.message);
    // Try fallback non-pooled send once
    if (String(err.message).includes('timeout') || String(err.message).includes('socket')) {
      logger.warn('[email] Retrying OTP via fresh connection');
      try {
        const retryTx = nodemailer.createTransport({ host: env.smtp.host || 'smtp.gmail.com', port: Number(env.smtp.port)||587, secure: false, requireTLS: true, auth: { user: env.smtp.user, pass: env.smtp.pass } });
        const r2 = await retryTx.sendMail({ from, to, subject: 'Your Admin Password Reset OTP — ZUNO', text, html, priority: 'high' });
        logger.info(`Admin OTP retry sent to ${to} (${r2.messageId})`);
        return { messageId: r2.messageId, otp: env.isProduction ? undefined : otp };
      } catch (e2) { logger.error('OTP retry failed', e2.message); }
    }
    throw new Error('EMAIL_FAILED');
  }
}

// Dev/test helper — never expose credentials
export function isSmtpConfigured() {
  return !!(env.smtp.host && env.smtp.user && env.smtp.pass);
}
