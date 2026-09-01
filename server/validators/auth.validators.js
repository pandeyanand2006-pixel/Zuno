import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  email: z.string().email().optional().or(z.literal('')),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Enter email or mobile'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3),
});

export const otpRequestSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

export const otpVerifySchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  code: z.string().min(4).max(8),
  name: z.string().min(2).max(80).optional(),
});

export const googleSchema = z.object({
  idToken: z.string().min(20),
});

export const addressSchema = z.object({
  label: z.string().max(40).optional(),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  is_default: z.boolean().optional(),
});
