import nodemailer from 'nodemailer';
import dns from 'node:dns';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Force IPv4 first — Render free tier IPv6 (2607:f8b0::) ENETUNREACH
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
// Also set global lookup to IPv4
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, cb) => {
  if (typeof options === 'function') { cb = options; options = {}; }
  return originalLookup(hostname, { family: 4, hints: dns.ADDRCONFIG, all: false, ...options }, cb);
};

// ── TalkSpace Reference Architecture: Centralized Email Service ──
// Application Startup
//   ↓ Load .env (env.js)
//   ↓ Validate Email Configuration (validateEmailConfig)
//   ↓ Initialize Email Provider (initializeEmailService) — once
//   ↓ Email Service Ready
//   ↓ Controllers / Utilities call sendEmail() — single client
//
// IMPORTANT: ONE transporter only. No duplicate clients in controllers.

function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  dns.lookup(hostname, { family: 4, hints: dns.ADDRCONFIG, all: false, ...options }, callback);
}

let transporter = null;
let initialized = false;
let initPromise = null;

export function validateEmailConfig() {
  const missing = [];
  if (!env.smtp.host) missing.push('SMTP_HOST');
  if (!env.smtp.port) missing.push('SMTP_PORT');
  if (!env.smtp.user) missing.push('SMTP_USER');
  if (!env.smtp.pass) missing.push('SMTP_PASS');
  if (!env.smtp.from) missing.push('SMTP_FROM');
  if (missing.length) {
    const msg = `Missing email configuration: ${missing.join(', ')}`;
    if (env.isProduction) {
      // Fail fast in production if email is mandatory for auth
      logger.error(msg);
      throw new Error(msg);
    } else {
      logger.warn(`[email] ${msg} — emails will be mocked in development`);
      return false;
    }
  }
  // Validate port/secure pairing
  const port = Number(env.smtp.port);
  if (port === 465 && !env.smtp.secure) {
    logger.warn('[email] SMTP_PORT 465 usually requires SMTP_SECURE=true (implicit TLS)');
  }
  if (port === 587 && env.smtp.secure) {
    logger.warn('[email] SMTP_PORT 587 usually uses STARTTLS with SMTP_SECURE=false');
  }
  // Validate sender format
  const from = env.smtp.from;
  if (from && !from.includes('@')) {
    logger.warn('[email] SMTP_FROM looks invalid: ' + from);
  }
  return true;
}

export async function initializeEmailService() {
  if (initialized) return transporter;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const hasConfig = !!(env.smtp.user && env.smtp.pass);
    if (!hasConfig) {
      validateEmailConfig();
      logger.warn('[email] SMTP not configured — emails will be logged but not sent. Set SMTP_USER/SMTP_PASS/SMTP_HOST');
      logger.info('[email] Email service ready (mock mode)');
      initialized = true;
      return null;
    }
    validateEmailConfig();
    const port = Number(env.smtp.port) || 587;
    const is465 = port === 465;
    const cfg = {
      host: env.smtp.host || 'smtp.gmail.com',
      port,
      secure: is465 ? true : !!env.smtp.secure,
      requireTLS: !is465,
      lookup: ipv4Lookup,
      pool: env.isProduction ? false : true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    };
    transporter = nodemailer.createTransport(cfg);
    // Verify in background — don't block boot (Render free tier blocks SMTP, verify will timeout ~7s)
    transporter.verify().then(() => {
      logger.info(`Email service ready — ${env.smtp.host}:${env.smtp.port} as ${env.smtp.user.slice(0, 3)}***`);
    }).catch(err => {
      logger.warn('[email] SMTP verify failed: ' + err.message + ' — will use fallback (Vercel/Brevo) at send time');
      if (String(err.message).includes('535') || String(err.message).includes('Authentication')) {
        logger.error('[email] SMTP auth failed — verify SMTP_USER and SMTP_PASS (Gmail App Password, 16 chars, no spaces)');
      }
    });
    logger.info('[email] Email service initialized — transporter created, verifying in background');
    initialized = true;
    return transporter;
  })();
  return initPromise;
}

function getTransporter() {
  if (transporter) return transporter;
  // Lazy init if called before initializeEmailService (e.g., tests)
  const port = Number(env.smtp.port) || 587;
  const is465 = port === 465;
  const cfg = {
    host: env.smtp.host || 'smtp.gmail.com',
    port,
    secure: is465 ? true : !!env.smtp.secure,
    requireTLS: !is465,
    lookup: ipv4Lookup,
    pool: env.isProduction ? false : true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    auth: env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  };
  transporter = nodemailer.createTransport(cfg);
  return transporter;
}

function getFreshTransporter(overridePort) {
  const port = Number(overridePort ?? env.smtp.port) || 587;
  const is465 = port === 465;
  return nodemailer.createTransport({
    host: env.smtp.host || 'smtp.gmail.com',
    port,
    secure: is465 ? true : false,
    requireTLS: !is465,
    lookup: ipv4Lookup,
    pool: false,
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 15000,
    auth: env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  });
}

async function trySmtpWithFallback(mailOpts) {
  const primaryPort = Number(env.smtp.port) || 587;
  const fallbackPort = primaryPort === 587 ? 465 : 587;
  try {
    const t = primaryPort === 465 ? getFreshTransporter(465) : getTransporter();
    return await t.sendMail(mailOpts);
  } catch (e) {
    const isNet = String(e.message).includes('ENETUNREACH') || String(e.message).includes('ETIMEDOUT') || String(e.message).includes('ECONNREFUSED') || String(e.message).includes('timeout') || String(e.message).includes('Connection timeout');
    if (isNet) {
      logger.warn(`[email] SMTP ${primaryPort} blocked (timeout) — trying fallback port ${fallbackPort}`);
      try {
        const alt = getFreshTransporter(fallbackPort);
        return await alt.sendMail(mailOpts);
      } catch (e2) {
        // If fallback also fails with network, let outer catch handle Vercel/Brevo fallback
        throw e2;
      }
    }
    throw e;
  }
}

async function sendViaVercelProxy({ to, subject, html, text }) {
  const candidates = [];
  const rawFrontend = env.frontendUrl || '';
  rawFrontend.split(',').forEach(s => {
    const u = s.trim().replace(/\/$/, '');
    if (u && !u.includes('*') && u.startsWith('http')) {
      // Only try vercel-like frontends, not localhost
      if (u.includes('vercel.app') || u.includes('zunoshopping.store') || u.includes('zuno')) candidates.push(u + '/api/send-email');
    }
  });
  // Prioritize actual deployed Vercel URLs — www.zunoshopping.store is the production custom domain
  if (!candidates.includes('https://www.zunoshopping.store/api/send-email')) candidates.unshift('https://www.zunoshopping.store/api/send-email');
  // Fallback known deployments (in case custom domain not yet propagated)
  candidates.push('https://zuno.vercel.app/api/send-email');
  const urls = [...new Set(candidates)];
  for (const url of urls) {
    try {
      logger.info(`[email] Trying Vercel SMTP proxy ${url} for ${to.slice(0, 3)}***`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': env.jwtSecret || '' },
        body: JSON.stringify({ to, subject, html, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) return { messageId: data.messageId || 'vercel-' + Date.now(), via: 'vercel' };
      logger.warn(`[email] Vercel proxy ${url} failed: ${res.status} ${JSON.stringify(data).slice(0,200)}`);
    } catch (e) {
      logger.warn(`[email] Vercel proxy ${url} error: ${e.message}`);
    }
  }
  return null;
}

async function sendViaHttp({ to, subject, html, text }) {
  const from = env.smtp.from || env.smtp.user || 'ZUNO <zunoworld3121@gmail.com>';
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
      if (!res.ok) throw new Error(`Brevo ${res.status}`);
      return { messageId: data.messageId || 'brevo-' + Date.now(), via: 'brevo' };
    } catch (e) { logger.warn('Brevo HTTPS failed: ' + e.message); }
  }
  if (env.resend.apiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.resend.apiKey}` },
        body: JSON.stringify({ from, to, subject, html, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Resend ${res.status}`);
      return { messageId: data.id || 'resend-' + Date.now(), via: 'resend' };
    } catch (e) { logger.warn('Resend HTTPS failed: ' + e.message); }
  }
  return null;
}

function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return user.slice(0, 2) + '***@' + domain;
}

/**
 * Centralized sendEmail — TalkSpace pattern
 * @param {{to: string, subject: string, html: string, text?: string}} opts
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!to || !subject || !html) throw new Error('sendEmail: to, subject, html required');
  if (!initialized && !transporter) {
    // Ensure service is initialized (non-blocking for tests)
    await initializeEmailService().catch(() => {});
  }
  const masked = maskEmail(to);
  if (!env.smtp.user || !env.smtp.pass) {
    logger.info(`[email mock] Would send to ${masked} — subject: "${subject}"`);
    return { mocked: true };
  }
  const rawFrom = env.smtp.from || env.smtp.user || 'noreply@zuno.app';
  const from = rawFrom.includes('<') ? rawFrom : (rawFrom.includes('@') && rawFrom !== env.smtp.user ? rawFrom : `ZUNO <${rawFrom}>`);
  const mailOpts = {
    from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').slice(0, 500),
    priority: 'high',
    headers: { 'X-Mailer': 'ZUNO', 'X-Priority': '1', 'Importance': 'high' },
    envelope: { from: env.smtp.user, to },
  };
  try {
    const info = await trySmtpWithFallback(mailOpts);
    if (info.rejected && info.rejected.length) {
      logger.error(`[email] Rejected for ${masked}: ${info.rejected.join(',')}`);
      throw new Error('EMAIL_REJECTED: ' + info.rejected.join(','));
    }
    if (!info.accepted || info.accepted.length === 0) {
      logger.error(`[email] Not accepted for ${masked}`);
      throw new Error('EMAIL_FAILED');
    }
    logger.info(`[email] Sent to ${masked} — ${info.messageId || 'ok'} via SMTP`);
    return { messageId: info.messageId, accepted: info.accepted };
  } catch (err) {
    const msg = String(err.message || '');
    const isNoSuchUser = msg.includes('550') && msg.includes('5.1.1');
    if (isNoSuchUser || msg.startsWith('EMAIL_REJECTED')) {
      logger.error(`[email] Invalid recipient ${masked}: ${msg}`);
      throw new Error('EMAIL_FAILED');
    }
    const isNetworkBlock = msg.includes('ENETUNREACH') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || msg.includes('timeout');
    if (isNetworkBlock) {
      logger.warn(`[email] SMTP blocked for ${masked} — trying Vercel proxy then HTTPS fallback`);
      const vercelRes = await sendViaVercelProxy({ to, subject, html, text: mailOpts.text });
      if (vercelRes) return vercelRes;
      const httpRes = await sendViaHttp({ to, subject, html, text: mailOpts.text });
      if (httpRes) return httpRes;
    }
    // Retry via fresh transporter
    try {
      logger.warn(`[email] Retrying via fresh connection for ${masked}`);
      const fresh = getFreshTransporter();
      const r2 = await fresh.sendMail(mailOpts);
      if (r2.rejected && r2.rejected.length) throw new Error('EMAIL_REJECTED: ' + r2.rejected.join(','));
      logger.info(`[email] Retry sent to ${masked} — ${r2.messageId}`);
      return { messageId: r2.messageId };
    } catch (e2) {
      const m2 = String(e2.message || '');
      if (m2.includes('550') && m2.includes('5.1.1')) {
        logger.error(`[email] Invalid recipient on retry ${masked}`);
        throw new Error('EMAIL_FAILED');
      }
      if (m2.includes('ENETUNREACH') || m2.includes('ETIMEDOUT')) {
        const v2 = await sendViaVercelProxy({ to, subject, html, text: mailOpts.text });
        if (v2) return v2;
        const h2 = await sendViaHttp({ to, subject, html, text: mailOpts.text });
        if (h2) return h2;
      }
      logger.error(`[email] Failed for ${masked}: ${m2} — host=${env.smtp.host} port=${env.smtp.port} user=${env.smtp.user ? env.smtp.user.slice(0, 3) + '***' : 'none'}`);
      throw new Error('EMAIL_FAILED');
    }
  }
}

export function isEmailReady() {
  return initialized && !!(env.smtp.user && env.smtp.pass);
}

export default { initializeEmailService, validateEmailConfig, sendEmail, isEmailReady };
