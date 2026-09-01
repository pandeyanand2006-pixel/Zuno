import { Store } from './store.js';

const API = (location.origin.includes('localhost') ? 'http://localhost:4000' : '') + '/api';

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
