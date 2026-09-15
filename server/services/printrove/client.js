import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { getAccessToken, clearToken } from './auth.js';

const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally { clearTimeout(t); }
}

async function request(method, path, { body, query, headers = {}, retryAuth = true } = {}) {
  const token = await getAccessToken();
  const base = env.printrove.apiUrl.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString()}` : '';
  const url = `${base}${p}${qs}`;

  const opts = {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  logger.info(`[PRINTROVE] ${method} ${p}${qs ? '?' + qs : ''}`);

  let res;
  try {
    res = await fetchWithTimeout(url, opts);
  } catch (e) {
    logger.error(`[PRINTROVE] Network/timeout ${method} ${p}: ${e.message}`);
    throw new Error('PRINTROVE_NETWORK_ERROR');
  }

  if (res.status === 401 && retryAuth) {
    logger.warn('[PRINTROVE] 401 — refreshing token and retrying');
    clearToken();
    return request(method, path, { body, query, headers, retryAuth: false });
  }

  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {
    data = raw;
  }

  if (!res.ok) {
    logger.error(`[PRINTROVE] ${method} ${p} failed ${res.status}: ${String(raw).slice(0, 800)}`);
    const msg = (data && (data.message || data.error || data.msg)) || `Printrove API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.raw = raw;
    err.data = data;
    throw err;
  }

  return data;
}

export const printroveClient = {
  getAccessToken,
  clearToken,

  // Categories
  async getCategories() {
    const data = await request('GET', '/api/external/categories');
    return data?.data || data?.categories || data;
  },

  // Products
  async getProducts(query = {}) {
    const data = await request('GET', '/api/external/products', { query });
    return data?.data || data?.products || data;
  },

  async getProduct(id) {
    const data = await request('GET', `/api/external/products/${id}`);
    return data?.data || data;
  },

  async findProductBySku(sku) {
    // Fallback: list and filter if no direct SKU search
    const products = await this.getProducts();
    const list = Array.isArray(products) ? products : products?.data || products?.products || [];
    return list.find((p) => String(p.sku || p.code || p.SKU).toLowerCase() === String(sku).toLowerCase()) || null;
  },

  // Serviceability — Printrove expects cod as string "true"/"false" (not 0/1).
  async checkServiceability({ country = 'India', pincode, weight = 300, cod = false } = {}) {
    if (!pincode) throw new Error('PINCODE_REQUIRED');
    const codStr = cod ? 'true' : 'false';
    try {
      const data = await request('GET', '/api/external/serviceability', { query: { pincode: String(pincode), country, weight, cod: codStr } });
      return data;
    } catch (e) {
      if (e.status === 404 || e.status === 405) {
        const data = await request('POST', '/api/external/serviceability', {
          body: { country, pincode: String(pincode), weight, cod: codStr },
        });
        return data;
      }
      throw e;
    }
  },

  // Orders
  async createOrder(payload) {
    const data = await request('POST', '/api/external/orders', { body: payload });
    return data?.data || data;
  },

  async getOrder(id) {
    const data = await request('GET', `/api/external/orders/${id}`);
    return data?.data || data;
  },

  async getOrders(query = {}) {
    const data = await request('GET', '/api/external/orders', { query });
    return data?.data || data?.orders || data;
  },

  async getOrderByReference(reference) {
    // Try query param variations
    const attempts = [
      { reference },
      { reference_number: reference },
      { order_number: reference },
    ];
    for (const q of attempts) {
      try {
        const data = await request('GET', '/api/external/orders', { query: q });
        const list = data?.data || data?.orders || data;
        if (Array.isArray(list) && list.length) return list[0];
        if (list && typeof list === 'object' && !Array.isArray(list) && (list.id || list.order_id)) return list;
      } catch (_) { /* try next */ }
    }
    // Last attempt: direct GET by reference as ID
    try {
      return await this.getOrder(reference);
    } catch {
      return null;
    }
  },

  // Designs (if needed)
  async getDesigns(query = {}) {
    const data = await request('GET', '/api/external/designs', { query });
    return data?.data || data;
  },
};
