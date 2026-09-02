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
import sellerRoutes from './routes/seller.routes.js';
import restaurantAdminRoutes from './routes/restaurant.admin.routes.js';
import providerAdminRoutes from './routes/provider.admin.routes.js';
import customDesignRoutes from './routes/customDesign.routes.js';
import { webhook as razorpayWebhook } from './controllers/payment.controller.js';

import { errorHandler, notFoundHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.isProduction ? env.frontendUrl : true, credentials: true }));
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

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'healthy', time: new Date().toISOString(), testMode: !env.razorpay.keyId }, message: 'ZUNO API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
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
app.use('/api/admin', adminRoutes);
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
