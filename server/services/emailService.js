import { env } from '../config/env.js';
import { sendEmail as centralSendEmail, isEmailReady } from '../config/email.js';
import { logger } from '../utils/logger.js';

// ── Centralized Email Service — TalkSpace pattern ──
// All controllers MUST call sendEmail() here, not create their own transporter.
// This file is the single email client for Zuno.
// Legacy template functions delegate to central sendEmail.

function getFrontendUrl() {
  const raw = env.frontendUrl || 'http://localhost:5500';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

export async function sendEmail({ to, subject, html, text }) {
  // Thin wrapper — validates and delegates to central service
  return centralSendEmail({ to, subject, html, text });
}

export async function sendAdminPasswordResetEmail({ to, rawToken, expiresMinutes = 30 }) {
  const frontendUrl = getFrontendUrl();
  const resetUrl = `${frontendUrl}/#/admin/reset-password?token=${encodeURIComponent(rawToken)}`;
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0f172a;padding:24px 28px;text-align:center">
      <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
      <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO ADMIN</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Reset Your Admin Password</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">We received a request to reset the password for your admin account (<strong>${to}</strong>).</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:14px">Reset Password</a>
      </div>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px">Or copy this link:</p>
      <p style="margin:0 0 16px;word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px;color:#334155">${resetUrl}</p>
      <p style="margin:0 0 12px;color:#334155;font-size:13px"><strong>Expires in ${expiresMinutes} minutes</strong> — one-time use.</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px">If you did not request this, ignore this email.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO</p>
    </div>
  </div>`;
  const text = `Reset your admin password: ${resetUrl}\nExpires in ${expiresMinutes} minutes.`;
  // Use central service — await ensures caller knows success/failure (no fire-and-forget)
  return sendEmail({ to, subject: 'Reset Your Admin Password — ZUNO', html, text });
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
      <p style="margin:0 0 16px;color:#475569;font-size:14px">Use the OTP below for <strong>${to}</strong>.</p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#f8fafc;border:2px dashed #1e40af;border-radius:12px;padding:16px 32px">
          <div style="font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0f172a">${otp}</div>
          <div style="font-size:11px;color:#64748b;letter-spacing:0.1em;margin-top:4px">ONE-TIME PASSWORD</div>
        </div>
      </div>
      <p style="margin:0 0 12px;color:#334155;font-size:13px;text-align:center"><strong>Expires in ${expiresMinutes} minutes</strong> • One-time use</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px">If you did not request, ignore.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO</p>
    </div>
  </div>`;
  const text = `Your admin OTP is: ${otp}\nExpires in ${expiresMinutes} minutes.`;
  return sendEmail({ to, subject: 'Your Admin Password Reset OTP — ZUNO', html, text });
}

export async function sendPasswordResetOtpEmail({ to, otp, expiresMinutes = 10, isAdmin = false }) {
  if (isAdmin) return sendAdminOtpEmail({ to, otp, expiresMinutes });
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
     <div style="background:#0f172a;padding:24px 28px;text-align:center">
       <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
       <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO</div>
     </div>
     <div style="padding:28px">
       <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Your Password Reset OTP</h2>
       <p style="margin:0 0 16px;color:#475569;font-size:14px">Use the OTP below for <strong>${to}</strong>.</p>
       <div style="text-align:center;margin:24px 0">
         <div style="display:inline-block;background:#f8fafc;border:2px dashed #1e40af;border-radius:12px;padding:16px 32px">
           <div style="font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0f172a">${otp}</div>
           <div style="font-size:11px;color:#64748b;letter-spacing:0.1em;margin-top:4px">ONE-TIME PASSWORD</div>
         </div>
       </div>
       <p style="margin:0 0 12px;color:#334155;font-size:13px;text-align:center"><strong>Expires in ${expiresMinutes} minutes</strong> • One-time use</p>
       <p style="margin:0 0 12px;color:#64748b;font-size:13px">Enter this OTP on the verification page to set a new password.</p>
       <p style="margin:0 0 12px;color:#64748b;font-size:13px">If you did not request, ignore.</p>
     </div>
     <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
       <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO</p>
     </div>
   </div>`;
  const text = `Your Zuno OTP is: ${otp}\nExpires in ${expiresMinutes} minutes.\nIf you didn't request, ignore.`;
  return sendEmail({ to, subject: 'Your Password Reset OTP — ZUNO', html, text });
}

export function isSmtpConfigured() {
  return isEmailReady() || !!(env.smtp.host && env.smtp.user && env.smtp.pass);
}

// Re-export central for direct use
export { isEmailReady };
