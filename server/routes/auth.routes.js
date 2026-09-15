import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, me, logout, requestOtp, verifyOtp, googleLogin, forgotPassword, verifyForgotOtp, resetPassword, verifyEmail, resendVerification } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema, googleSchema, userForgotSchema, userVerifyOtpSchema, userResetSchema, verifyEmailSchema, resendVerificationSchema } from '../validators/auth.validators.js';

const router = Router();

const forgotLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, standardHeaders:true, legacyHeaders:false, message:{ success:false, message:'Too many requests. Please try again later.', code:'RATE_LIMITED', data:null }});
const verifyLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, standardHeaders:true, legacyHeaders:false, message:{ success:false, message:'Too many requests. Please try again later.', code:'RATE_LIMITED', data:null }});
const resetLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, standardHeaders:true, legacyHeaders:false, message:{ success:false, message:'Too many requests. Please try again later.', code:'RATE_LIMITED', data:null }});
const resendLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, standardHeaders:true, legacyHeaders:false, message:{ success:false, message:'Too many requests. Please try again later.', code:'RATE_LIMITED', data:null }});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/otp/request', validate(otpRequestSchema), requestOtp);
router.post('/otp/verify', validate(otpVerifySchema), verifyOtp);
router.post('/google', validate(googleSchema), googleLogin);
router.get('/me', authMiddleware, me);
router.post('/logout', authMiddleware, logout);
// User forgot password (email OTP, live)
router.post('/forgot-password', forgotLimiter, validate(userForgotSchema), forgotPassword);
router.post('/verify-otp', verifyLimiter, validate(userVerifyOtpSchema), verifyForgotOtp);
router.post('/reset-password', resetLimiter, validate(userResetSchema), resetPassword);
// Registration email verification (TalkSpace pattern)
router.post('/verify-email', verifyLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', resendLimiter, validate(resendVerificationSchema), resendVerification);

export default router;
