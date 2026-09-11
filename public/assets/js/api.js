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

export const api = {
  get: (p, q) => request('GET', p, { query: q }),
  post: (p, b, o) => request('POST', p, { body: b, ...(o || {}) }),
  put: (p, b) => request('PUT', p, { body: b }),
  del: (p) => request('DELETE', p, {}),
  raw: request,
};
