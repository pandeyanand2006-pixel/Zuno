import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let cached = { token: null, expiresAt: 0, email: null };

function isExpired() {
  return !cached.token || Date.now() >= cached.expiresAt - 60 * 1000; // 1m buffer
}

export async function getAccessToken({ force = false } = {}) {
  if (!force && !isExpired() && cached.email === env.printrove.email) return cached.token;

  if (!env.printrove.email || !env.printrove.password) {
    throw new Error('PRINTROVE_CREDENTIALS_MISSING');
  }

  const url = `${env.printrove.apiUrl}/api/external/token`;
  logger.info(`[PRINTROVE] Authenticating ${env.printrove.email}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: env.printrove.email, password: env.printrove.password }),
  });

  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw }; }

  if (!res.ok) {
    logger.error(`[PRINTROVE] Auth failed ${res.status}: ${raw?.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) throw new Error('PRINTROVE_AUTH_FAILED');
    throw new Error('PRINTROVE_AUTH_ERROR');
  }

  // Doc variations: { access_token, token, accessToken, expiry, expires_in }
  const token = data?.access_token || data?.token || data?.accessToken || data?.data?.access_token || data?.data?.token;
  if (!token) {
    logger.error(`[PRINTROVE] No token in response: ${raw?.slice(0, 800)}`);
    throw new Error('PRINTROVE_AUTH_NO_TOKEN');
  }

  const expiresIn = Number(data?.expires_in || data?.expiry || data?.expiresIn || 3600);
  const ttl = Number.isFinite(expiresIn) ? expiresIn * 1000 : 60 * 60 * 1000;

  cached = { token, expiresAt: Date.now() + ttl, email: env.printrove.email };
  logger.info(`[PRINTROVE] Token acquired (expires in ${Math.round(ttl / 1000)}s)`);
  return token;
}

export function clearToken() {
  cached = { token: null, expiresAt: 0, email: null };
}

export function getCachedInfo() {
  return { hasToken: !!cached.token, expiresAt: cached.expiresAt, email: cached.email };
}
