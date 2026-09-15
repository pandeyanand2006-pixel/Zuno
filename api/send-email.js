import nodemailer from 'nodemailer';

// Vercel serverless – this runs on AWS Lambda where SMTP 587 is NOT blocked (unlike Render free)
// It uses the same Gmail App Password you provided in .env, so no Brevo needed.
// Render will call this via HTTPS (443) when its own SMTP is ENETUNREACH.

// Read env at request time (Vercel reuses function containers; env may change between deploys)
function getSmtpConfig() {
  return {
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim(),
    from: (process.env.SMTP_FROM || process.env.NOTIFY_EMAIL_FROM || '').trim() || ((process.env.SMTP_USER || '').trim() ? `ZUNO <${(process.env.SMTP_USER || '').trim()}>` : ''),
    host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
    port: Number(process.env.SMTP_PORT) || 587,
  };
}

// Simple in-memory rate limit for Vercel Lambda (per-container, best-effort)
const rateMap = new Map(); // ip -> {count, resetAt}
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 20; // 20 emails/min per IP — generous for OTP, strict enough to prevent relay abuse
  let entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    rateMap.set(ip, entry);
    return true;
  }
  entry.count++;
  if (entry.count > max) return false;
  return true;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export default async function handler(req, res) {
  // CORS – allow Render backend and Vercel frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  // Rate limit by IP (best-effort)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ success: false, message: 'Too many requests — try again in 60 seconds', code: 'RATE_LIMITED' });
  }

  // Shared secret to avoid open relay – must match Render's INTERNAL_EMAIL_SECRET or JWT_SECRET
  // IMPORTANT: if expectedSecret is set in production, requests MUST provide matching secret; no-secret = 401 (not open relay)
  const expectedSecret = (process.env.INTERNAL_EMAIL_SECRET || process.env.JWT_SECRET || '').trim();
  const gotSecret = (req.headers['x-internal-secret'] || req.body?.internalSecret || '').trim();
  if (expectedSecret) {
    if (!gotSecret || gotSecret !== expectedSecret) {
      console.warn(`[vercel-email] reject: missing/invalid secret from ${clientIp}`);
      return res.status(401).json({ success: false, message: 'Unauthorized — invalid secret' });
    }
  } else {
    // No secret configured on Vercel — allow but log warning (dev mode). In production you SHOULD set INTERNAL_EMAIL_SECRET or JWT_SECRET.
    console.warn('[vercel-email] WARNING: INTERNAL_EMAIL_SECRET/JWT_SECRET not set on Vercel — endpoint is not authenticated');
  }

  const { to, otp, subject, html, text } = req.body || {};
  if (!to || !isValidEmail(to)) return res.status(400).json({ success: false, message: 'valid to email required' });
  // Basic payload size guard — prevent abuse sending huge html
  if (html && String(html).length > 50000) return res.status(400).json({ success: false, message: 'html too large' });
  if (subject && String(subject).length > 200) return res.status(400).json({ success: false, message: 'subject too long' });

  const finalSubject = subject || (otp ? 'Your Password Reset OTP — ZUNO' : 'ZUNO Notification');
  const finalHtml = html || (otp ? `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto"><h2>Your OTP</h2><div style="font-size:32px;font-weight:800;letter-spacing:0.3em">${String(otp).slice(0, 10)}</div><p>Expires in 10 minutes.</p></div>` : `<div>Notification</div>`);
  const finalText = text || (otp ? `Your ZUNO OTP is: ${otp} (expires 10 min)` : 'ZUNO notification');

  const cfg = getSmtpConfig();
  if (!cfg.user || !cfg.pass) {
    console.error('[vercel-email] SMTP not configured');
    return res.status(500).json({ success: false, message: 'SMTP not configured on Vercel' });
  }

  // Mask recipient in logs — never log full email or otp in production
  const masked = String(to).split('@')[0].slice(0, 2) + '***@' + String(to).split('@')[1];

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      requireTLS: cfg.port !== 465,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    });
    const info = await transporter.sendMail({
      from: cfg.from,
      to,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    });
    // Never log OTP value
    console.log(`[vercel-email] sent to ${masked} via ${cfg.host}:${cfg.port} (${info.messageId || 'ok'})`);
    return res.status(200).json({ success: true, messageId: info.messageId, accepted: info.accepted });
  } catch (e) {
    // Never log to email in full if it contains PII; use masked
    console.error(`[vercel-email] failed for ${masked}:`, String(e.message).slice(0, 200));
    return res.status(500).json({ success: false, message: String(e.message).slice(0, 300) });
  }
}
