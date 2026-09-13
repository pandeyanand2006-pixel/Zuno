import { Store } from './store.js';

// For split deploys (Vercel → Render) set window.ZUNO_API_BASE or localStorage ZUNO_API_BASE.
// Priority: localStorage (if explicitly set) > window.ZUNO_API_BASE > same-origin /api
// - localStorage = '' (empty) or 'local' => forces same-origin /api (useful for local dev)
// - localStorage = 'https://zuno-ydl3.onrender.com' or '.../api' => uses that backend
// - window.ZUNO_API_BASE is the Vercel production default (Render backend)
// Normalizes: avoids double /api and trailing slash issues.
function resolveApiBase() {
  const ls = (typeof window !== 'undefined' && typeof localStorage !== 'undefined') ? localStorage.getItem('ZUNO_API_BASE') : null;
  // localStorage takes precedence if user explicitly set it (including empty string to force local)
  if (ls !== null) {
    const v = String(ls).trim();
    if (v === '' || v.toLowerCase() === 'local' || v === '/api') return '/api';
    return v.replace(/\/$/, '') + (v.replace(/\/$/, '').endsWith('/api') ? '' : '/api');
  }
  const win = (typeof window !== 'undefined' && window.ZUNO_API_BASE) ? String(window.ZUNO_API_BASE).trim() : '';
  if (!win) return '/api';
  return win.replace(/\/$/, '') + (win.replace(/\/$/, '').endsWith('/api') ? '' : '/api');
}
const API = resolveApiBase();

async function request(method, path, { body, auth = true, query } = {}) {
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

  const res = await fetch(url, { method, headers, body: body ? (isFormData ? body : JSON.stringify(body)) : undefined });
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

// Tiny in-memory GET cache for safe, idempotent catalog endpoints only.
// Never caches auth/cart/wishlist/orders — those must stay real-time.
const GET_CACHE = new Map();
const CACHE_TTL = 30 * 1000;
function cacheable(path) {
  return path === '/config'
    || path === '/categories'
    || path === '/products'
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
};
