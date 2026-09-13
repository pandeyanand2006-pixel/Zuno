import { adminAuthService } from '../services/adminAuth.service.js';
import { ok, fail, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function forgotPassword(req, res) {
  try {
    const { email } = req.validated;
    const result = await adminAuthService.forgotPassword(email);
    // In dev, include previewUrl so tester can click even if inbox delayed/spam
    const data = result._previewUrl ? { previewUrl: result._previewUrl } : null;
    // Never expose raw token; previewUrl is only in non-production
    return ok(res, data, result.message);
  } catch (err) {
    logger.error('admin forgotPassword', err);
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
