import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import cartRoutes from './routes/cart.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import { orderRouter, paymentRouter } from './routes/order.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';
import serviceRoutes from './routes/service.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import adminAuthRoutes from './routes/adminAuth.routes.js';
import printroveRoutes from './routes/printrove.routes.js';
import sellerRoutes from './routes/seller.routes.js';
import restaurantAdminRoutes from './routes/restaurant.admin.routes.js';
import providerAdminRoutes from './routes/provider.admin.routes.js';
import customDesignRoutes from './routes/customDesign.routes.js';
import reviewRoutes from './routes/review.routes.js';
import { webhook as razorpayWebhook } from './controllers/payment.controller.js';

import { errorHandler, notFoundHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));
const allowedOrigins = env.frontendUrl ? env.frontendUrl.split(',').map(s => s.trim()).filter(Boolean) : [];
const corsOptions = {
  origin: env.isProduction
    ? (origin, cb) => {
        if (!origin) return cb(null, true); // same-origin / health checks / curl / mobile WebView
        try {
          const u = new URL(origin);
          // Always allow Vercel deployments regardless of FRONTEND_URL exact value — fixes mobile "Failed to fetch"
          if (u.hostname.endsWith('.vercel.app')) return cb(null, true);
        } catch {}
        if (allowedOrigins.includes(origin)) return cb(null, true);
        if (allowedOrigins.some(o => o.includes('*.vercel.app')) && origin.endsWith('.vercel.app')) return cb(null, true);
        if (allowedOrigins.some(o => o.includes('vercel.app')) && origin.endsWith('.vercel.app')) return cb(null, true);
        if (allowedOrigins.length === 0) return cb(null, true);
        // Allow localhost for dev tunnels
        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return cb(null, true);
        return cb(new Error('Not allowed by CORS'), false);
      }
    : true,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
};
app.use(cors(corsOptions));
// Explicit preflight handler for all routes (ensures OPTIONS succeeds on mobile)
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// minimal cookie parser (no extra dependency)
app.use((req, _res, next) => {
  const raw = req.headers.cookie;
  req.cookies = {};
  if (raw) raw.split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > -1) req.cookies[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  next();
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);
// Live data must not be cached by browsers/CDN — products, reviews, media must stay stable and instant
app.use('/api/products', (req, res, next) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); res.setHeader('Pragma', 'no-cache'); next(); });
app.use('/api/reviews', (req, res, next) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); res.setHeader('Pragma', 'no-cache'); next(); });

app.get('/api/health', (_req, res) => {
  const smtpConfigured = !!(env.smtp.user && env.smtp.pass);
  res.status(200).json({ success: true, data: { status: 'healthy', time: new Date().toISOString(), testMode: !env.razorpay.keyId, smtpConfigured, smtpHost: env.smtp.host, smtpUser: smtpConfigured ? env.smtp.user.slice(0,3)+'***' : 'NOT_SET' }, message: 'ZUNO API is running' });
});
// Debug: check SMTP config (no secrets) — helps diagnose mock vs real sending
app.get('/api/debug/smtp', (_req, res) => {
  const cfg = !!(env.smtp.user && env.smtp.pass);
  res.status(200).json({ success: true, data: { configured: cfg, host: env.smtp.host, port: env.smtp.port, user: cfg ? env.smtp.user.slice(0,3)+'***' : null, from: env.smtp.from, note: cfg ? 'SMTP ready — OTP will arrive in inbox' : 'SMTP NOT SET — Render is in mock mode, OTP only in logs. Set SMTP_USER/SMTP_PASS in Render Dashboard → Environment and redeploy.' } });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// Reviews must be mounted BEFORE productRoutes — otherwise /products/:id/reviews is captured as slug=:id
app.use('/api/reviews', reviewRoutes);
app.use('/api', reviewRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/notifications', notificationRoutes);
// Public admin password-reset routes (no auth) — must be before protected adminRoutes
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/printrove', printroveRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/restaurant-admin', restaurantAdminRoutes);
app.use('/api/provider-admin', providerAdminRoutes);
app.use('/api/custom-designs', customDesignRoutes);

// Public client config (used to render real Google sign-in when configured).
app.get('/api/config', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      googleClientId: env.google.clientId || '',
      razorpayTestMode: !env.razorpay.keyId,
    },
  });
});

// Razorpay webhook (signature verified inside handler).
app.use('/api/webhooks/razorpay', razorpayWebhook);

// Serve admin-uploaded product images/video. Stored as "/uploads/products/..."
// by the admin routes below (multer disk storage under public/uploads).
// Must allow cross-origin loads: Vercel frontend (different origin) -> Render backend.
const uploadsDir = path.resolve(__dirname, '../public/uploads');
app.use('/uploads',
  cors({ origin: true, credentials: false }),
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    // Allow any origin to load images (public assets)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    next();
  },
  express.static(uploadsDir, {
    maxAge: '7d',
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      if (/\.(mp4|webm|mov)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  })
);

// Serve frontend
const publicDir = path.resolve(__dirname, '../public');
// Always send fresh assets (ES modules shouldn't be cached during development).
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

logger.info('ZUNO app initialized');

export default app;
