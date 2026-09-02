import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['JWT_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    // Allow boot in dev without secrets; warn instead of crash for DX.
    console.warn(`[env] WARNING: ${key} is not set. Some features will be disabled.`);
  }
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/Zuno.db'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5500',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@Zuno.app',
  },
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};
