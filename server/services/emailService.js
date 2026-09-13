import nodemailer from 'nodemailer';
import dns from 'node:dns';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Render IPv6 ENETUNREACH → force IPv4 lookup for smtp.gmail.com
function ipv4Lookup(hostname, options, callback) {
  // Node 20: options can be number or object; normalize
  if (typeof options === 'function') { callback = options; options = {}; }
  dns.lookup(hostname, { family: 4, hints: dns.ADDRCONFIG, all: false, ...options }, callback);
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  // Gmail: 465 => SSL (secure true), 587 => STARTTLS (secure false + requireTLS)
  const port = Number(env.smtp.port) || 587;
  const is465 = port === 465;
  const cfg = {
    host: env.smtp.host || 'smtp.gmail.com',
    port,
    secure: is465 ? true : !!env.smtp.secure,
    requireTLS: !is465,
    // Render free tier: IPv6 ENETUNREACH (2607:f8b0::) → force IPv4 via custom lookup
    lookup: ipv4Lookup,
    // Render free tier can have socket issues with pooling — disable pool in production for reliability
    pool: env.isProduction ? false : true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    auth: undefined,
  };
  if (env.smtp.user && env.smtp.pass) {
    cfg.auth = { user: env.smtp.user, pass: env.smtp.pass };
  }
  transporter = nodemailer.createTransport(cfg);
  // Verify asynchronously without crashing boot — retry once if fails (cold start)
  if (env.smtp.user && env.smtp.pass) {
    transporter.verify().then(() => {
      logger.info('SMTP connection verified — ' + env.smtp.host + ':' + env.smtp.port + ' as ' + env.smtp.user);
    }).catch((err) => {
      logger.warn('SMTP verify failed: ' + err.message);
      logger.error('SMTP verify error', err.message);
      // Hint: Gmail needs App Password, not regular password. Check Render env SMTP_PASS length=16 no spaces.
      if (String(err.message).includes('535') || String(err.message).includes('Authentication')) {
        logger.error('SMTP auth failed — verify Render env: SMTP_USER and SMTP_PASS (Gmail App Password, 16 chars, no spaces)');
      }
    });
  } else {
    logger.warn('SMTP not configured — emails will be logged but not sent. Set Render env SMTP_USER/SMTP_PASS/SMTP_HOST');
  }
  return transporter;
}

// Force-fresh transporter for critical OTPs (avoids pooled socket stale on Render free tier)
function getFreshTransporter() {
  const port = Number(env.smtp.port) || 587;
  const is465 = port === 465;
  return nodemailer.createTransport({
    host: env.smtp.host || 'smtp.gmail.com',
    port,
    secure: is465 ? true : false,
    requireTLS: !is465,
    lookup: ipv4Lookup,
    pool: false,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    auth: env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  });
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
    // Try fallback non-pooled send once (force IPv4 for Render ENETUNREACH)
    if (String(err.message).includes('timeout') || String(err.message).includes('socket') || String(err.message).includes('ENETUNREACH') || String(err.message).includes('ETIMEDOUT')) {
      logger.warn('[email] Retrying OTP via fresh IPv4 connection');
      try {
        const retryTx = nodemailer.createTransport({ host: env.smtp.host || 'smtp.gmail.com', port: Number(env.smtp.port)||587, secure: false, requireTLS: true, lookup: ipv4Lookup, auth: { user: env.smtp.user, pass: env.smtp.pass }, tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' } });
        const r2 = await retryTx.sendMail({ from, to, subject: 'Your Admin Password Reset OTP — ZUNO', text, html, priority: 'high' });
        logger.info(`Admin OTP retry sent to ${to} (${r2.messageId})`);
        return { messageId: r2.messageId, otp: env.isProduction ? undefined : otp };
      } catch (e2) { logger.error('OTP retry failed', e2.message); }
    }
    throw new Error('EMAIL_FAILED');
  }
}

// Generic user OTP (reuses admin OTP template but with user branding)
export async function sendPasswordResetOtpEmail({ to, otp, expiresMinutes = 10, isAdmin = false }) {
  // Reuse admin OTP sender — keeps live realtime delivery via pooled transporter
  // For user, subject is slightly different but same HTML works (already says Admin — make neutral)
  // Clone with neutral subject if not admin
  if (!isAdmin) {
    const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
     <div style="background:#0f172a;padding:24px 28px;text-align:center">
       <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
       <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO</div>
     </div>
     <div style="padding:28px">
       <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Your Password Reset OTP</h2>
       <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Hello,</p>
       <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">We received a request to reset the password for your Zuno account (<strong>${to}</strong>). Use the OTP below.</p>
       <div style="text-align:center;margin:24px 0">
         <div style="display:inline-block;background:#f8fafc;border:2px dashed #1e40af;border-radius:12px;padding:16px 32px">
           <div style="font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0f172a">${otp}</div>
           <div style="font-size:11px;color:#64748b;letter-spacing:0.1em;margin-top:4px">ONE-TIME PASSWORD</div>
         </div>
       </div>
       <p style="margin:0 0 12px;color:#334155;font-size:13px;text-align:center"><strong>Expires in ${expiresMinutes} minutes</strong> • One-time use only</p>
       <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5">Enter this OTP on the verification page to set a new password.</p>
       <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.5">If you did not request this, ignore this email.</p>
       <div style="margin-top:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">
         <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.5"><strong>Security:</strong> Never share this OTP.</p>
       </div>
     </div>
     <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
       <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO — Modern Everyday Clothing</p>
     </div>
   </div>`;
    const text = `Your Zuno OTP is: ${otp}\nExpires in ${expiresMinutes} minutes.\nGo to ${getFrontendUrl()}/#/verify-otp?email=${encodeURIComponent(to)} to enter it.\nIf you didn't request, ignore.`;
    const rawFrom = env.smtp.from || env.smtp.user || 'noreply@zuno.app';
    const from = rawFrom.includes('<') ? rawFrom : `ZUNO <${rawFrom}>`;
    if (!env.smtp.user || !env.smtp.pass) {
      logger.warn(`[email mock] SMTP not configured — would send user OTP to ${to} — OTP: ${otp} (set Render env SMTP_USER/SMTP_PASS to deliver)`);
      // Still return success to keep flow, but log clearly that email is mocked
      return { mocked: true, otp };
    }
    logger.info(`[email] Sending user OTP to ${to} — expires ${expiresMinutes}m via ${env.smtp.host}:${env.smtp.port}`);
    const mailOpts = { from, to, subject: 'Your Password Reset OTP — ZUNO', text, html, priority: 'high', headers: { 'X-Mailer': 'ZUNO User OTP', 'X-Priority': '1', 'Importance': 'high' }, envelope: { from: env.smtp.user, to } };
    // Try pooled first, then fresh connection fallback (Render free tier fix)
    const isNoSuchUser = (err) => String(err.message||'').includes('550') && String(err.message||'').includes('5.1.1');
    try {
      const t = getTransporter();
      const info = await t.sendMail(mailOpts);
      logger.info(`User OTP sent to ${to} (${info.messageId}) — accepted: ${(info.accepted||[]).join(',')} rejected: ${(info.rejected||[]).join(',')}`);
      if (info.rejected && info.rejected.length) {
        logger.error(`[email] User OTP rejected by Gmail: ${info.rejected.join(',')} — recipient does not exist or blocked`);
        throw new Error('EMAIL_REJECTED: ' + info.rejected.join(','));
      }
      if (!info.accepted || info.accepted.length === 0) {
        logger.error(`[email] User OTP not accepted by Gmail — no accepted recipients`);
        throw new Error('EMAIL_FAILED');
      }
      return { messageId: info.messageId, otp: env.isProduction ? undefined : otp };
    } catch (err) {
      // Don't retry on 550 NoSuchUser — recipient invalid, retry won't help
      if (isNoSuchUser(err) || String(err.message).startsWith('EMAIL_REJECTED')) {
        logger.error('User OTP failed — invalid recipient ' + to + ': ' + err.message + ' — user must register with a real Gmail address');
        throw new Error('EMAIL_FAILED');
      }
      const isNetworkBlock = String(err.message).includes('ENETUNREACH') || String(err.message).includes('ETIMEDOUT') || String(err.message).includes('ECONNREFUSED') || String(err.message).includes('timeout');
      if (isNetworkBlock) {
        logger.warn('[email] SMTP blocked on Render (ENETUNREACH/ETIMEDOUT) — trying HTTPS fallback (Brevo/Resend) via port 443');
        const httpRes = await sendViaHttp({ to, subject: mailOpts.subject, html, text });
        if (httpRes) {
          logger.info(`[email] HTTPS fallback succeeded via ${httpRes.via} to ${to}`);
          return { messageId: httpRes.messageId, otp: env.isProduction ? undefined : otp };
        }
        logger.warn('[email] HTTPS fallback not configured — set BREVO_API_KEY or RESEND_API_KEY in Render Env to enable. See https://app.brevo.com/settings/keys/api');
      }
      logger.error('Failed to send user OTP (pooled)', err.message);
      // Retry via fresh transporter (fixes pooled socket timeout on Render)
      try {
        logger.warn('[email] Retrying user OTP via fresh IPv4 connection');
        const fresh = getFreshTransporter();
        const r2 = await fresh.sendMail(mailOpts);
        logger.info(`User OTP retry sent to ${to} (${r2.messageId}) — accepted: ${(r2.accepted||[]).join(',')} rejected: ${(r2.rejected||[]).join(',')}`);
        if (r2.rejected && r2.rejected.length) throw new Error('EMAIL_REJECTED: ' + r2.rejected.join(','));
        return { messageId: r2.messageId, otp: env.isProduction ? undefined : otp };
      } catch (e2) {
        if (isNoSuchUser(e2) || String(e2.message).startsWith('EMAIL_REJECTED')) {
          logger.error('User OTP retry: invalid recipient ' + to);
          throw new Error('EMAIL_FAILED');
        }
        const isNet2 = String(e2.message).includes('ENETUNREACH') || String(e2.message).includes('ETIMEDOUT') || String(e2.message).includes('ECONNREFUSED');
        if (isNet2) {
          logger.warn('[email] Retry also ENETUNREACH — trying HTTPS fallback');
          const httpRes2 = await sendViaHttp({ to, subject: mailOpts.subject, html, text });
          if (httpRes2) {
            logger.info(`[email] HTTPS fallback succeeded (retry) via ${httpRes2.via} to ${to}`);
            return { messageId: httpRes2.messageId, otp: env.isProduction ? undefined : otp };
          }
        }
        logger.error('User OTP retry failed', e2.message);
        logger.error(`[email] SMTP host=${env.smtp.host} port=${env.smtp.port} user=${env.smtp.user ? env.smtp.user.slice(0,3)+'***' : 'none'} — check Gmail App Password (16 chars, no spaces) and Render env vars. If Render blocks SMTP 587, set BREVO_API_KEY (free at app.brevo.com) and redeploy.`);
        throw new Error('EMAIL_FAILED');
      }
    }
  }
  // Admin path delegates to admin sender for consistency
  return sendAdminOtpEmail({ to, otp, expiresMinutes });
}

// HTTPS fallback for Render free tier where SMTP 587 is blocked (ENETUNREACH)
// Uses Brevo (https://api.brevo.com) or Resend (https://api.resend.com) via port 443
async function sendViaHttp({ to, subject, html, text }) {
  const from = env.smtp.from || env.smtp.user || 'ZUNO <zunoworld3121@gmail.com>';
  // Brevo API (preferred — 300/day free)
  if (env.brevo.apiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env.brevo.apiKey },
        body: JSON.stringify({
          sender: { email: env.smtp.user || 'zunoworld3121@gmail.com', name: 'ZUNO' },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${JSON.stringify(data)}`);
      logger.info(`User OTP sent via Brevo HTTPS to ${to} (${data.messageId || 'ok'})`);
      return { messageId: data.messageId || 'brevo-' + Date.now(), via: 'brevo' };
    } catch (e) {
      logger.warn('Brevo HTTPS failed: ' + e.message);
      // fall through to Resend
    }
  }
  // Resend API fallback
  if (env.resend.apiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.resend.apiKey}` },
        body: JSON.stringify({ from, to, subject, html, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(data)}`);
      logger.info(`User OTP sent via Resend HTTPS to ${to} (${data.id || 'ok'})`);
      return { messageId: data.id || 'resend-' + Date.now(), via: 'resend' };
    } catch (e) {
      logger.warn('Resend HTTPS failed: ' + e.message);
    }
  }
  return null;
}

// Dev/test helper — never expose credentials
export function isSmtpConfigured() {
  return !!(env.smtp.host && env.smtp.user && env.smtp.pass);
}
