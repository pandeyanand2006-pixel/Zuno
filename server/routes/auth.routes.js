import { Router } from 'express';
import { register, login, me, logout, requestOtp, verifyOtp, googleLogin } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema, googleSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/otp/request', validate(otpRequestSchema), requestOtp);
router.post('/otp/verify', validate(otpVerifySchema), verifyOtp);
router.post('/google', validate(googleSchema), googleLogin);
router.get('/me', authMiddleware, me);
router.post('/logout', authMiddleware, logout);

export default router;
