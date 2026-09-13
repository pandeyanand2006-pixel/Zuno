import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { ok, fail } from '../utils/response.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All printrove admin routes require ADMIN
router.use(authMiddleware, requireRole('ADMIN'));

// Test connection — does not leak token/password
router.get('/test', async (req, res) => {
  try {
    if (!env.printrove.email || !env.printrove.password) {
      return fail(res, 'Printrove credentials not configured. Set PRINTROVE_EMAIL and PRINTROVE_PASSWORD in .env', 500, 'PRINTROVE_NOT_CONFIGURED');
    }
    const { getAccessToken } = await import('../services/printrove/auth.js');
    const { printroveClient } = await import('../services/printrove/client.js');
    let tokenOk = false;
    let productsOk = false;
    let productsCount = 0;
    let error = null;

    try {
      await getAccessToken({ force: true });
      tokenOk = true;
    } catch (e) {
      error = e.message;
      return fail(res, `Printrove auth failed: ${e.message}`, 502, 'PRINTROVE_AUTH_FAILED');
    }

    try {
      const products = await printroveClient.getProducts();
      const list = Array.isArray(products) ? products : products?.data || products?.products || [];
      productsCount = Array.isArray(list) ? list.length : 0;
      productsOk = true;
    } catch (e) {
      logger.warn('[PRINTROVE] test products fetch failed, but auth succeeded: ' + e.message);
      // Auth succeeded but products endpoint may differ — still success for connection
      return ok(res, { tokenOk: true, productsOk: false, productsCount: 0, apiUrl: env.printrove.apiUrl, note: 'Auth ok, products endpoint may need doc adjustment: ' + e.message }, 'Printrove connection successful (auth ok, products check warning)');
    }

    return ok(res, { tokenOk, productsOk, productsCount, apiUrl: env.printrove.apiUrl }, 'Printrove connection successful');
  } catch (e) {
    logger.error('[PRINTROVE] test error', e);
    return fail(res, e.message || 'Printrove test failed', 500);
  }
});

// List Printrove products/variants for admin mapping
router.get('/products', async (req, res) => {
  try {
    const { printroveClient } = await import('../services/printrove/client.js');
    const products = await printroveClient.getProducts(req.query);
    return ok(res, { products });
  } catch (e) {
    return fail(res, e.message, e.status || 500);
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const { printroveClient } = await import('../services/printrove/client.js');
    const product = await printroveClient.getProduct(req.params.id);
    return ok(res, { product });
  } catch (e) {
    return fail(res, e.message, e.status || 500);
  }
});

// Serviceability check
router.get('/serviceability', async (req, res) => {
  try {
    const { pincode, weight, cod, country } = req.query;
    if (!pincode) return fail(res, 'pincode required', 400);
    const { printroveClient } = await import('../services/printrove/client.js');
    const result = await printroveClient.checkServiceability({ pincode, weight: Number(weight) || 300, cod: cod === 'true' || cod === '1', country: country || 'India' });
    return ok(res, result);
  } catch (e) {
    return fail(res, e.message, e.status || 500);
  }
});

// Sync fulfillment status for a Zuno order
router.post('/sync/:orderId', async (req, res) => {
  try {
    const { syncOrder } = await import('../services/printrove/sync.js');
    const result = await syncOrder(req.params.orderId);
    return ok(res, result, result.message || 'Synced');
  } catch (e) {
    if (e.message === 'NOT_FOUND') return fail(res, 'Order not found', 404);
    if (e.message === 'NO_PRINTROVE_ORDER') return fail(res, 'This order has no Printrove fulfillment', 404);
    return fail(res, e.message, 500);
  }
});

// Manual retry for failed Printrove order
router.post('/retry/:orderId', async (req, res) => {
  try {
    const { retryPrintroveOrder } = await import('../services/printrove/order.js');
    const result = await retryPrintroveOrder(req.params.orderId);
    return ok(res, result);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return fail(res, 'Order not found', 404);
    return fail(res, e.message, 500);
  }
});

export default router;
