import { Store } from './store.js';

// For split deploys (Vercel frontend → Render backend) set window.ZUNO_API_BASE
// e.g. <script>window.ZUNO_API_BASE="https://zuno.onrender.com/api"</script> or localStorage
// Falls back to same-origin /api (single-service deploy — recommended)
// Normalizes: if base is "https://xxx.onrender.com" without /api, auto-appends /api
const rawBase = (typeof window !== 'undefined' && (window.ZUNO_API_BASE || localStorage.getItem('ZUNO_API_BASE'))) || '';
const API = rawBase ? rawBase.replace(/\/$/, '') + (rawBase.replace(/\/$/, '').endsWith('/api') ? '' : '/api') : '/api';

async function request(method, path, { body, auth = true, query } = {}) {
  let url = API + path;
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
    const s = qs.toString();
    if (s) url += '?' + s;
  }
  const headers = { 'Content-Type': 'application/json' };
  const token = Store.getToken();
  if (auth && token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
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
