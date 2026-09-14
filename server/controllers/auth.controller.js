import { authService } from '../services/auth.service.js';
import { ok, fail, unauthorized, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function register(req, res) {
  try {
    const result = await authService.register(req.validated);
    // TalkSpace pattern: if email provided, registration requires verification
    if (result && result.needsVerification) {
      const data = result._devOtp ? { user: result.user, devOtp: result._devOtp, needsVerification: true } : { user: result.user, needsVerification: true };
      return ok(res, data, result.message, 201);
    }
    // No verification needed (no email or legacy) — issue token immediately
    const user = result.user || result;
    const { token } = await authService.issueTokenForUser(user);
    return ok(res, { user, token }, 'Account created successfully', 201);
  } catch (err) {
    if (err.message === 'MOBILE_EXISTS') return fail(res, 'This mobile number is already registered', 409, 'MOBILE_EXISTS');
    if (err.message === 'EMAIL_EXISTS') return fail(res, 'This email is already registered', 409, 'EMAIL_EXISTS');
    logger.error('register', err);
    return serverError(res);
  }
}

export async function verifyEmail(req, res) {
  try {
    const { email, otp } = req.validated;
    const { token, user } = await authService.verifyEmail({ email, otp });
    return ok(res, { token, user }, 'Email verified successfully');
  } catch (err) {
    if (err.message === 'OTP_INVALID') return fail(res, 'Invalid OTP. Please check and try again.', 400, 'OTP_INVALID');
    if (err.message === 'OTP_EXPIRED') return fail(res, 'OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED');
    if (err.message === 'NOT_FOUND') return fail(res, 'User not found', 404);
    if (err.message === 'OTP_REQUIRED') return fail(res, 'OTP is required', 400);
    logger.error('verifyEmail', err);
    return serverError(res);
  }
}

export async function resendVerification(req, res) {
  try {
    const { email } = req.validated;
    const result = await authService.resendVerification({ email });
    const data = result._devOtp ? { devOtp: result._devOtp } : null;
    return ok(res, data, result.message);
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'User not found', 404);
    if (err.message === 'ALREADY_VERIFIED') return fail(res, 'Email already verified', 400, 'ALREADY_VERIFIED');
    if (err.message === 'COOLDOWN') return fail(res, 'Please wait 60 seconds before requesting another code', 429, 'COOLDOWN');
    logger.error('resendVerification', err);
    return serverError(res);
  }
}

export async function login(req, res) {
  try {
    const { token, user } = await authService.login(req.validated.identifier, req.validated.password);
    return ok(res, { token, user }, 'Logged in successfully');
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') return unauthorized(res, 'Invalid email/mobile or password');
    if (err.message === 'EMAIL_NOT_VERIFIED') return fail(res, 'Please verify your email before logging in. OTP sent to your email.', 403, 'EMAIL_NOT_VERIFIED');
    logger.error('login', err);
    return serverError(res);
  }
}

export async function me(req, res) {
  try {
    const user = await authService.me(req.user.id);
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
    const { token, user } = await authService.verifyOtp(req.validated);
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

export async function forgotPassword(req, res) {
  try {
    const { email } = req.validated;
    const result = await authService.forgotPassword(email);
    const data = result._devOtp ? { devOtp: result._devOtp } : null;
    return ok(res, data, result.message);
  } catch (err) {
    if (err.message === 'COOLDOWN') return fail(res, 'Please wait 60 seconds before requesting another OTP', 429, 'COOLDOWN');
    logger.error('user forgotPassword', err);
    return serverError(res);
  }
}
export async function verifyForgotOtp(req, res) {
  try {
    const { email, otp } = req.validated;
    const result = await authService.verifyForgotOtp(email, otp);
    return ok(res, { token: result.token }, result.message);
  } catch (err) {
    if (err.message === 'OTP_INVALID') return fail(res, 'Invalid OTP. Please check and try again.', 400, 'OTP_INVALID');
    if (err.message === 'OTP_EXPIRED') return fail(res, 'OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED');
    logger.error('user verifyForgotOtp', err);
    return serverError(res);
  }
}
export async function resetPassword(req, res) {
  try {
    const { token, password } = req.validated;
    const result = await authService.resetPasswordWithToken(token, password);
    return ok(res, null, result.message);
  } catch (err) {
    if (err.message === 'TOKEN_INVALID') return fail(res, 'This reset token is invalid.', 400, 'TOKEN_INVALID');
    if (err.message === 'TOKEN_EXPIRED') return fail(res, 'This reset token has expired. Please request a new OTP.', 400, 'TOKEN_EXPIRED');
    logger.error('user resetPassword', err);
    return serverError(res);
  }
}
