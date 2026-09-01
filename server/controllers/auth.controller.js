import { authService } from '../services/auth.service.js';
import { ok, fail, unauthorized, serverError } from '../utils/response.js';
import { signToken } from '../utils/jwt.js';
import { generateId } from '../utils/id.js';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';

function tokenFor(user) {
  const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(user.role) ||
    db.prepare('SELECT id FROM roles WHERE name = ?').get('USER');
  return signToken({ sub: user.id, role: role.id, jti: generateId() });
}

export async function register(req, res) {
  try {
    const user = await authService.register(req.validated);
    const token = tokenFor(user);
    return ok(res, { user, token }, 'Account created successfully', 201);
  } catch (err) {
    if (err.message === 'MOBILE_EXISTS') return fail(res, 'This mobile number is already registered', 409, 'MOBILE_EXISTS');
    if (err.message === 'EMAIL_EXISTS') return fail(res, 'This email is already registered', 409, 'EMAIL_EXISTS');
    logger.error('register', err);
    return serverError(res);
  }
}

export async function login(req, res) {
  try {
    const { token, user } = await authService.login(req.validated.identifier, req.validated.password);
    return ok(res, { token, user }, 'Logged in successfully');
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') return unauthorized(res, 'Invalid email/mobile or password');
    logger.error('login', err);
    return serverError(res);
  }
}

export function me(req, res) {
  try {
    const user = authService.me(req.user.id);
    return ok(res, { user });
  } catch (err) {
    return unauthorized(res, 'Session invalid');
  }
}

export function logout(req, res) {
  return ok(res, null, 'Logged out successfully');
}

export async function requestOtp(req, res) {
  try {
    const { devOtp } = await authService.requestOtp(req.validated);
    return ok(res, devOtp ? { devOtp } : {}, 'OTP sent to your mobile');
  } catch (err) {
    logger.error('requestOtp', err);
    return serverError(res);
  }
}

export async function verifyOtp(req, res) {
  try {
    const { token, user } = authService.verifyOtp(req.validated);
    return ok(res, { token, user }, 'Logged in via OTP');
  } catch (err) {
    if (err.message === 'NO_OTP') return fail(res, 'No OTP requested for this number', 400, 'NO_OTP');
    if (err.message === 'OTP_EXPIRED') return fail(res, 'OTP has expired. Request a new one', 400, 'OTP_EXPIRED');
    if (err.message === 'OTP_INVALID') return fail(res, 'Incorrect OTP', 401, 'OTP_INVALID');
    logger.error('verifyOtp', err);
    return serverError(res);
  }
}

export async function googleLogin(req, res) {
  try {
    const { token, user } = await authService.googleLogin(req.validated);
    return ok(res, { token, user }, 'Signed in with Google');
  } catch (err) {
    if (err.message === 'GOOGLE_INVALID') return fail(res, 'Could not verify Google sign-in', 401, 'GOOGLE_INVALID');
    if (err.message === 'GOOGLE_AUD_MISMATCH') return fail(res, 'Google client mismatch', 401, 'GOOGLE_AUD_MISMATCH');
    if (err.message === 'GOOGLE_ISS_INVALID') return fail(res, 'Invalid Google issuer', 401, 'GOOGLE_ISS_INVALID');
    if (err.message === 'GOOGLE_EXPIRED') return fail(res, 'Google session expired', 401, 'GOOGLE_EXPIRED');
    logger.error('googleLogin', err);
    return serverError(res);
  }
}
