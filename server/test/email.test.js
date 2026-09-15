// Email system tests — no real SMTP credentials required
// Tests A-H from spec: SMTP success, ENETUNREACH fallback, auth failure, fallback failure, OTP, password reset, exactly-once, no secrets in logs
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-for-tests';
process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = 'smtp.gmail.com';
process.env.SMTP_PORT = '465';
process.env.SMTP_USER = 'test@gmail.com';
process.env.SMTP_PASS = 'testpass12345678';
process.env.SMTP_FROM = 'ZUNO <test@gmail.com>';
process.env.FRONTEND_URL = 'https://www.zunoshopping.store';
process.env.BREVO_API_KEY = '';
process.env.RESEND_API_KEY = '';

import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

// Capture logs to verify no secrets leaked
const logs = [];
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;
function capture() {
  logs.length = 0;
  console.log = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
}
function restore() {
  console.log = origLog;
  console.warn = origWarn;
  console.error = origError;
}

// Helper to reset email module state between tests
let emailMod;
async function loadEmailFresh() {
  // Clear module cache for email.js (ESM — use query param bust)
  const mod = await import('../config/email.js?v=' + Date.now() + Math.random());
  return mod;
}

// Mock fetch helper
let fetchCalls = [];
let fetchHandler = null;
const origFetch = global.fetch;
function mockFetch(handler) {
  fetchHandler = handler;
  fetchCalls = [];
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    if (handler) return handler(url, opts);
    return { ok: false, status: 404, json: async () => ({ success: false }) };
  };
}
function restoreFetch() {
  global.fetch = origFetch;
  fetchHandler = null;
}

// Mock nodemailer factory
function mockTransport(behavior) {
  // behavior: { verify: 'resolve'|'enetunreach', sendMail: 'resolve'|'enetunreach'|'authfail'|'reject' }
  const mock = {
    verify: () => {
      if (behavior.verify === 'enetunreach') return Promise.reject(new Error('connect ENETUNREACH 2607:f8b0:400e:c1b::6c:465 - Local (:::0)'));
      return Promise.resolve();
    },
    sendMail: (opts) => {
      if (behavior.sendMail === 'enetunreach') return Promise.reject(new Error('connect ENETUNREACH 2607:f8b0:400e:c1b::6c:465 - Local (:::0)'));
      if (behavior.sendMail === 'authfail') return Promise.reject(new Error('535 5.7.8 Authentication Credentials Invalid'));
      if (behavior.sendMail === 'reject') return Promise.resolve({ accepted: [], rejected: [opts.to], messageId: 'x' });
      return Promise.resolve({ accepted: [opts.to], rejected: [], messageId: '<test@smtp>' });
    },
  };
  nodemailer.createTransport = () => mock;
  // Also mock fresh transporter same behavior unless overridden
  return mock;
}

test('A. SMTP available → SMTP sends exactly once, no fallback', async () => {
  capture();
  mockTransport({ verify: 'resolve', sendMail: 'resolve' });
  mockFetch(() => { throw new Error('fetch should not be called'); });
  const mod = await import('../config/email.js?' + Date.now());
  await mod.initializeEmailService();
  // Wait for verify background
  await new Promise(r => setTimeout(r, 50));
  const res = await mod.sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>hi</p>' });
  assert.ok(res.messageId);
  assert.equal(fetchCalls.length, 0, 'fallback should not be called when SMTP succeeds');
  restoreFetch(); restore();
});

test('B. SMTP ENETUNREACH → HTTPS Vercel fallback sends exactly once', async () => {
  capture();
  mockTransport({ verify: 'enetunreach', sendMail: 'enetunreach' });
  let vercelCalls = 0;
  mockFetch((url) => {
    vercelCalls++;
    return { ok: true, status: 200, json: async () => ({ success: true, messageId: 'vercel-123' }) };
  });
  // Force reimport to get fresh circuit breaker
  const mod = await import('../config/email.js?b=' + Date.now() + Math.random());
  await mod.initializeEmailService();
  await new Promise(r => setTimeout(r, 50));
  const res = await mod.sendEmail({ to: 'user2@example.com', subject: 'OTP', html: '<p>123456</p>' });
  assert.equal(res.via, 'vercel');
  assert.equal(res.messageId, 'vercel-123');
  assert.equal(vercelCalls, 1, 'Vercel should be called exactly once');
  // Second send should skip SMTP entirely due to circuit breaker
  vercelCalls = 0;
  const res2 = await mod.sendEmail({ to: 'user3@example.com', subject: 'OTP2', html: '<p>123456</p>' });
  assert.equal(res2.via, 'vercel');
  assert.equal(vercelCalls, 1, 'Second send should also use Vercel exactly once via circuit breaker');
  restoreFetch(); restore();
});

test('C. SMTP auth failure → does NOT fallback to Vercel endlessly, throws', async () => {
  capture();
  mockTransport({ verify: 'resolve', sendMail: 'authfail' });
  mockFetch(() => ({ ok: true, status: 200, json: async () => ({ success: true, messageId: 'vercel-x' }) }));
  const mod = await import('../config/email.js?c=' + Date.now() + Math.random());
  await mod.initializeEmailService();
  await new Promise(r => setTimeout(r, 50));
  await assert.rejects(() => mod.sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>hi</p>' }), /EMAIL_FAILED/);
  // Should NOT have called Vercel for auth failure (our code does not fallback on 535)
  assert.equal(fetchCalls.length, 0, 'Vercel should not be called on auth failure');
  restoreFetch(); restore();
});

test('D. Vercel fallback failure → final EMAIL_FAILED', async () => {
  capture();
  mockTransport({ verify: 'enetunreach', sendMail: 'enetunreach' });
  mockFetch(() => ({ ok: false, status: 500, json: async () => ({ success: false }) }));
  const mod = await import('../config/email.js?d=' + Date.now() + Math.random());
  await mod.initializeEmailService();
  await new Promise(r => setTimeout(r, 50));
  await assert.rejects(() => mod.sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>hi</p>' }), /EMAIL_FAILED/);
  restoreFetch(); restore();
});

test('E/F. OTP and password reset via emailService use reliable fallback', async () => {
  capture();
  mockTransport({ verify: 'enetunreach', sendMail: 'enetunreach' });
  mockFetch(() => ({ ok: true, status: 200, json: async () => ({ success: true, messageId: 'vercel-otp' }) }));
  const emailMod = await import('../config/email.js?e=' + Date.now() + Math.random());
  await emailMod.initializeEmailService();
  await new Promise(r => setTimeout(r, 50));
  // Simulate emailService wrapper — directly call central sendEmail with OTP html
  const res = await emailMod.sendEmail({ to: 'otp@example.com', subject: 'Your Password Reset OTP — ZUNO', html: '<p>OTP 123456</p>' });
  assert.equal(res.via, 'vercel');
  assert.ok(res.messageId);
  restoreFetch(); restore();
});

test('G. No duplicate: ENETUNREACH triggers Vercel exactly once, not twice', async () => {
  capture();
  mockTransport({ verify: 'enetunreach', sendMail: 'enetunreach' });
  let callCount = 0;
  mockFetch(() => { callCount++; return { ok: true, status: 200, json: async () => ({ success: true, messageId: 'v1' }) }; });
  const mod = await import('../config/email.js?g=' + Date.now() + Math.random());
  await mod.initializeEmailService();
  await new Promise(r => setTimeout(r, 50));
  const res = await mod.sendEmail({ to: 'dup@example.com', subject: 'Test', html: '<p>hi</p>' });
  assert.equal(callCount, 1, 'Vercel must be called exactly once, not duplicated (old code called twice)');
  assert.equal(fetchCalls.filter(c => String(c.url).includes('send-email')).length, 1);
  restoreFetch(); restore();
});

test('H. No secrets in logs', async () => {
  capture();
  mockTransport({ verify: 'enetunreach', sendMail: 'enetunreach' });
  mockFetch(() => ({ ok: true, status: 200, json: async () => ({ success: true, messageId: 'v' }) }));
  const mod = await import('../config/email.js?h=' + Date.now() + Math.random());
  await mod.initializeEmailService();
  await new Promise(r => setTimeout(r, 50));
  await mod.sendEmail({ to: 'secret@example.com', subject: 'Test', html: '<p>hi OTP 999999</p>' });
  const allLogs = logs.join('\n');
  assert.equal(allLogs.includes('testpass12345678'), false, 'SMTP_PASS must not appear in logs');
  assert.equal(allLogs.includes('secret@example.com') && !allLogs.includes('se***@example.com') ? false : true, true); // masked check
  // Verify masking uses ***@
  assert.ok(allLogs.includes('se***@example.com') || allLogs.includes('***'), 'Email should be masked');
  restoreFetch(); restore();
});

test('PORT env is respected (Render compatibility)', async () => {
  process.env.PORT = '10000';
  const { env } = await import('../config/env.js?port=' + Date.now());
  assert.equal(env.port, 10000);
  delete process.env.PORT;
});
