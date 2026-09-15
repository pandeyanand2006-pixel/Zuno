import { adminAuthService } from '../services/adminAuth.service.js';
import { ok, fail, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function forgotPassword(req, res) {
  try {
    const { email } = req.validated;
    const result = await adminAuthService.forgotPassword(email);
    const data = result._devOtp ? { devOtp: result._devOtp } : null;
    return ok(res, data, result.message);
  } catch (err) {
    if (err.message === 'COOLDOWN') return fail(res, 'Please wait 30 seconds before requesting another OTP', 429, 'COOLDOWN');
    logger.error('admin forgotPassword', err);
    return serverError(res);
  }
}

export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.validated;
    const result = await adminAuthService.verifyOtp(email, otp);
    return ok(res, { token: result.token }, result.message);
  } catch (err) {
    if (err.message === 'OTP_INVALID') return fail(res, 'Invalid OTP. Please check and try again.', 400, 'OTP_INVALID');
    if (err.message === 'OTP_EXPIRED') return fail(res, 'OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED');
    if (err.message === 'OTP_REQUIRED') return fail(res, 'OTP is required', 400);
    logger.error('admin verifyOtp', err);
    return serverError(res);
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.validated;
    const result = await adminAuthService.resetPassword(token, password);
    return ok(res, null, result.message);
  } catch (err) {
    if (err.message === 'TOKEN_INVALID') return fail(res, 'This password reset link is invalid.', 400, 'TOKEN_INVALID');
    if (err.message === 'TOKEN_EXPIRED') return fail(res, 'This password reset link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
    if (err.message === 'VALIDATION') return fail(res, 'Token and password are required', 400);
    logger.error('admin resetPassword', err);
    return serverError(res);
  }
}
