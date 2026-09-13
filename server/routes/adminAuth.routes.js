import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { adminForgotSchema, adminResetSchema } from '../validators/auth.validators.js';
import { forgotPassword, resetPassword } from '../controllers/adminAuth.controller.js';

const router = Router();

// Strict rate limiting for password reset to prevent abuse
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED', data: null },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED', data: null },
});

router.post('/forgot-password', forgotLimiter, validate(adminForgotSchema), forgotPassword);
router.post('/reset-password', resetLimiter, validate(adminResetSchema), resetPassword);

export default router;
