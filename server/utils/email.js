import { sendEmail } from '../config/email.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// ── Email Utility / Template Layer — TalkSpace pattern ──
// Controllers → Email Utility → Central Email Service → SMTP Provider → Inbox
// No utility creates its own transporter. All delegate to central sendEmail.

function frontendUrl() {
  const raw = env.frontendUrl || 'http://localhost:5500';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

export async function sendVerificationEmail({ to, otp, expiresMinutes = 10 }) {
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0f172a;padding:24px 28px;text-align:center">
      <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
      <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Verify Your Email</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">Welcome to ZUNO! Please verify your email <strong>${to}</strong>.</p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#f8fafc;border:2px dashed #1e40af;border-radius:12px;padding:16px 32px">
          <div style="font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0f172a">${otp}</div>
          <div style="font-size:11px;color:#64748b;letter-spacing:0.1em;margin-top:4px">VERIFICATION CODE</div>
        </div>
      </div>
      <p style="margin:0 0 12px;color:#334155;font-size:13px;text-align:center"><strong>Expires in ${expiresMinutes} minutes</strong> • One-time use</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px">Enter this code on the verification page to activate your account.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO</p>
    </div>
  </div>`;
  const text = `Your ZUNO verification code is: ${otp}\nExpires in ${expiresMinutes} minutes.`;
  return sendEmail({ to, subject: 'Verify Your Email — ZUNO', html, text });
}

export async function sendWelcomeEmail({ to, name }) {
  const displayName = name ? String(name).split(' ')[0] : 'there';
  const url = frontendUrl();
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0f172a;padding:24px 28px;text-align:center">
      <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
      <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Welcome to ZUNO, ${displayName}!</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Your email has been verified. You can now shop, customize tees, and track orders.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${url}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:14px">Start Shopping</a>
      </div>
      <p style="margin:0;color:#64748b;font-size:13px">Need help? Reply to this email.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO</p>
    </div>
  </div>`;
  const text = `Welcome to ZUNO, ${displayName}! Your email is verified. Visit ${url} to start shopping.`;
  // Welcome emails are non-critical — log but don't throw if fails
  try {
    return await sendEmail({ to, subject: 'Welcome to ZUNO — Your email is verified', html, text });
  } catch (e) {
    logger.warn(`[email] Welcome email to ${to.slice(0, 3)}*** failed (non-critical): ${e.message}`);
    return null;
  }
}

export async function sendForgotPasswordOtpEmail({ to, otp, expiresMinutes = 10 }) {
  // Reuse centralized OTP flow — same as user forgot password
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0f172a;padding:24px 28px;text-align:center">
      <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
      <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Your Password Reset OTP</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">We received a request to reset the password for <strong>${to}</strong>.</p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#f8fafc;border:2px dashed #1e40af;border-radius:12px;padding:16px 32px">
          <div style="font-size:32px;font-weight:800;letter-spacing:0.25em;color:#0f172a">${otp}</div>
          <div style="font-size:11px;color:#64748b;letter-spacing:0.1em;margin-top:4px">ONE-TIME PASSWORD</div>
        </div>
      </div>
      <p style="margin:0 0 12px;color:#334155;font-size:13px;text-align:center"><strong>Expires in ${expiresMinutes} minutes</strong> • One-time use</p>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px">If you didn't request, ignore.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO</p>
    </div>
  </div>`;
  const text = `Your ZUNO password reset OTP is: ${otp}\nExpires in ${expiresMinutes} minutes.`;
  return sendEmail({ to, subject: 'Your Password Reset OTP — ZUNO', html, text });
}

export async function sendPasswordResetSuccessEmail({ to }) {
  const url = frontendUrl();
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0f172a;padding:24px 28px;text-align:center">
      <div style="display:inline-block;background:#fff;color:#0f172a;width:40px;height:40px;border-radius:10px;line-height:40px;font-weight:800;letter-spacing:0.08em">Z</div>
      <div style="color:#fff;font-weight:800;letter-spacing:0.12em;margin-top:8px;font-size:14px">ZUNO</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Password Reset Successful</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">Your password for <strong>${to}</strong> has been changed.</p>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">You can now log in with your new password.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${url}/#/login" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:14px">Log In</a>
      </div>
      <p style="margin:0;color:#64748b;font-size:13px">If you didn't make this change, contact support immediately.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px">© ${new Date().getFullYear()} ZUNO</p>
    </div>
  </div>`;
  const text = `Your password for ${to} has been reset. Log in at ${url}/#/login`;
  try {
    return await sendEmail({ to, subject: 'Your ZUNO Password Has Been Reset', html, text });
  } catch (e) {
    logger.warn(`[email] Reset success email to ${to.slice(0, 3)}*** failed (non-critical): ${e.message}`);
    return null;
  }
}
