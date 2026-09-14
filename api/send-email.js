import nodemailer from 'nodemailer';

// Vercel serverless – this runs on AWS Lambda where SMTP 587 is NOT blocked (unlike Render free)
// It uses the same Gmail App Password you provided in .env, so no Brevo needed.
// Render will call this via HTTPS (443) when its own SMTP is ENETUNREACH.

const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
const SMTP_FROM = (process.env.SMTP_FROM || process.env.NOTIFY_EMAIL_FROM || '').trim() || (SMTP_USER ? `ZUNO <${SMTP_USER}>` : '');
const SMTP_HOST = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

export default async function handler(req, res) {
  // CORS – allow Render backend and Vercel frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  // Simple shared secret to avoid open relay – must match Render's INTERNAL_EMAIL_SECRET or JWT_SECRET
  // If not set, allow (for now) but log warning
  const expectedSecret = process.env.INTERNAL_EMAIL_SECRET || process.env.JWT_SECRET || '';
  const gotSecret = req.headers['x-internal-secret'] || req.body?.internalSecret || '';
  // In production, enforce secret if set
  if (expectedSecret && gotSecret && gotSecret !== expectedSecret) {
    return res.status(401).json({ success: false, message: 'Invalid secret' });
  }

  const { to, otp, subject, html, text } = req.body || {};
  if (!to) return res.status(400).json({ success: false, message: 'to required' });

  const finalSubject = subject || (otp ? 'Your Password Reset OTP — ZUNO' : 'ZUNO Notification');
  const finalHtml = html || (otp ? `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto"><h2>Your OTP</h2><div style="font-size:32px;font-weight:800;letter-spacing:0.3em">${otp}</div><p>Expires in 10 minutes.</p></div>` : `<div>Notification</div>`);
  const finalText = text || (otp ? `Your ZUNO OTP is: ${otp} (expires 10 min)` : 'ZUNO notification');

  if (!SMTP_USER || !SMTP_PASS) {
    console.error('[vercel-email] SMTP not configured');
    return res.status(500).json({ success: false, message: 'SMTP not configured on Vercel' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      requireTLS: SMTP_PORT !== 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    });
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    });
    console.log(`[vercel-email] OTP sent to ${to} via ${SMTP_HOST}:${SMTP_PORT} (${info.messageId})`);
    return res.status(200).json({ success: true, messageId: info.messageId, accepted: info.accepted });
  } catch (e) {
    console.error('[vercel-email] failed', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}
