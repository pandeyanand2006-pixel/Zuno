import { Store } from './store.js';

// Resolve API base: Vercel uses same-origin /api via vercel.json rewrites to avoid CORS on mobile.
// Priority: localStorage (explicit override) > window.ZUNO_API_BASE > auto-detect (Vercel = /api)
// - localStorage = '' (empty) or 'local' => forces same-origin /api
// - localStorage = 'https://zuno-ydl3.onrender.com' or '.../api' => uses that backend directly
// - window.ZUNO_API_BASE is optional override (empty by default means auto)
function resolveApiBase() {
  const ls = (typeof window !== 'undefined' && typeof localStorage !== 'undefined') ? localStorage.getItem('ZUNO_API_BASE') : null;
  if (ls !== null) {
    const v = String(ls).trim();
    if (v === '' || v.toLowerCase() === 'local' || v === '/api') return '/api';
    return v.replace(/\/$/, '') + (v.replace(/\/$/, '').endsWith('/api') ? '' : '/api');
  }
  const win = (typeof window !== 'undefined' && window.ZUNO_API_BASE) ? String(window.ZUNO_API_BASE).trim() : '';
  if (win) {
    if (win === '' || win.toLowerCase() === 'local' || win === '/api') return '/api';
    return win.replace(/\/$/, '') + (win.replace(/\/$/, '').endsWith('/api') ? '' : '/api');
  }
  // Auto: if hosted on Vercel (*.vercel.app) use same-origin /api via rewrites (no CORS, works on mobile)
  try {
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
    if (host && host.endsWith('.vercel.app')) return '/api';
  } catch {}
  // Default: same-origin (works for local dev and Render single-service)
  return '/api';
}
const API = resolveApiBase();
// Alternate direct origin for fallback when same-origin proxy fails (e.g., local dev without proxy)
const DIRECT_API_FALLBACK = (typeof window !== 'undefined' && window.ZUNO_API_BASE && String(window.ZUNO_API_BASE).trim())
  ? String(window.ZUNO_API_BASE).trim().replace(/\/$/, '') + (String(window.ZUNO_API_BASE).trim().replace(/\/$/, '').endsWith('/api') ? '' : '/api')
  : 'https://zuno-ydl3.onrender.com/api';

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally { clearTimeout(t); }
}

async function doFetch(url, method, headers, body) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetchWithTimeout(url, { method, headers, body: body ? (isFormData ? body : JSON.stringify(body)) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok || (data && data.success === false)) {
    const err = new Error((data && data.message) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data ? data.data : null;
}

async function request(method, path, { body, auth = true, query, timeout } = {}) {
  let url = API + path;
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
    const s = qs.toString();
    if (s) url += '?' + s;
  }
  const headers = {};
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const token = Store.getToken();
  if (auth && token) headers['Authorization'] = 'Bearer ' + token;

  try {
    return await doFetch(url, method, headers, body);
  } catch (err) {
    // Network failure on Vercel proxy: fallback to direct Render origin (once) for resilience
    const isNetworkError = !err.status || err.message === 'Failed to fetch' || err.name === 'AbortError' || String(err.message).includes('NetworkError') || String(err.message).includes('Load failed');
    const shouldFallback = isNetworkError && API === '/api' && DIRECT_API_FALLBACK !== '/api' && !path.startsWith('/config');
    if (shouldFallback) {
      try {
        const altUrl = DIRECT_API_FALLBACK + path + (query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '')).toString() : '');
        return await doFetch(altUrl, method, headers, body);
      } catch (fallbackErr) {
        // Prefer original error but enhance message for mobile users
        if (fallbackErr.name === 'AbortError' || String(fallbackErr.message).includes('Failed to fetch')) {
          const nice = new Error('Network error — please check your connection and try again. The server may be waking up (wait 10s and retry).');
          nice.status = fallbackErr.status || 0;
          nice.code = 'NETWORK_ERROR';
          throw nice;
        }
        throw fallbackErr;
      }
    }
    // Enhance generic Failed to fetch into user-friendly message across all cases
    if (!err.status && (err.message === 'Failed to fetch' || err.name === 'AbortError' || String(err.message).includes('NetworkError'))) {
      const nice = new Error('Network error — please check your connection and try again. If on mobile, ensure you have internet and retry in a few seconds.');
      nice.status = 0;
      nice.code = 'NETWORK_ERROR';
      throw nice;
    }
    throw err;
  }
}

// Tiny in-memory GET cache for safe, idempotent catalog endpoints only.
// Never caches auth/cart/wishlist/orders — those must stay real-time.
// NOTE: /products (list) is NOT cached so admin uploads are live instantly.
// Only /config, /categories and product suggestions/details are cached briefly.
const GET_CACHE = new Map();
const CACHE_TTL = 15 * 1000;
function cacheable(path) {
  return path === '/config'
    || path === '/categories'
    || path === '/products/suggestions'
    || path.startsWith('/products/');
}
function cacheKey(path, query) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '')).toString() : '';
  return 'GET ' + path + (qs ? '?' + qs : '');
}

async function cachedGet(path, query) {
  if (!cacheable(path)) return request('GET', path, { query });
  const key = cacheKey(path, query);
  const hit = GET_CACHE.get(key);
  if (hit && (Date.now() - hit.t < CACHE_TTL)) return hit.data;
  const data = await request('GET', path, { query });
  GET_CACHE.set(key, { t: Date.now(), data });
  // Bound memory: drop oldest entries past 80 keys
  if (GET_CACHE.size > 80) {
    const first = GET_CACHE.keys().next().value;
    GET_CACHE.delete(first);
  }
  return data;
}

export const api = {
  get: (p, q) => cachedGet(p, q),
  post: (p, b, o) => request('POST', p, { body: b, ...(o || {}) }),
  put: (p, b) => request('PUT', p, { body: b }),
  del: (p) => request('DELETE', p, {}),
  raw: request,
  // Call after admin mutations so the storefront shows new/edited
  // products (and their images) immediately instead of serving the
  // 30s catalog cache.
  clearCache: () => GET_CACHE.clear(),
};
