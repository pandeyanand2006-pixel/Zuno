import { h, mount, toast } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

function field({ label, type = 'text', name, placeholder, value = '', note, inputmode }) {
  const input = h('input', { class: 'input', type, name, placeholder, value, inputmode, autocomplete: name === 'password' ? 'current-password' : 'on' });
  const err = h('div', { class: 'field-error hide' });
  return { wrap: h('div', { class: 'field' }, h('label', {}, label), input, note && h('span', { class: 'muted text-xs' }, note), err), input, err };
}

function redirectAfterLogin(user) {
  if (user.role === 'ADMIN') location.hash = '#/admin';
  else if (user.role === 'SELLER') location.hash = '#/seller';
  else if (user.role === 'RESTAURANT') location.hash = '#/restaurant-admin';
  else if (user.role === 'SERVICE_PROVIDER') location.hash = '#/provider-admin';
  else location.hash = '#/';
}

function finalize({ token, user }) {
  Store.setToken(token); Store.setUser(user);
  refreshCart().then(() => Store.mergeGuestToServer()).then(() => Store.loadWishlist()).catch(() => {});
  toast('Welcome, ' + (user.name || 'there').split(' ')[0], 'success');
  redirectAfterLogin(user);
}

let googleClientId = '';
let googleReady = false;
async function loadGoogle(clientId) {
  googleClientId = clientId;
  if (!clientId) return;
  if (window.google && window.google.accounts) { googleReady = true; return; }
  await new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => { googleReady = true; res(); };
    s.onerror = () => res();
    document.head.append(s);
  });
}
function renderGoogleButton(container) {
  if (!googleClientId) {
    container.append(h('button', { class: 'btn btn-outline btn-block', type: 'button', onclick: () => toast('Set GOOGLE_CLIENT_ID in .env to enable Google sign-in', 'info') }, 'Continue with Google'));
    return;
  }
  container.append(h('div', { id: 'g_id_signin' }));
  window.google?.accounts.id.initialize({
    client_id: googleClientId,
    callback: async (resp) => {
      try {
        const { token, user } = await api.post('/auth/google', { idToken: resp.credential });
        finalize({ token, user });
      } catch (e) { toast(e.message, 'error'); }
    },
  });
  window.google?.accounts.id.renderButton(document.getElementById('g_id_signin'), { theme: 'outline', size: 'large', width: '100%' });
}

export async function Login() {
  const root = h('div', { class: 'container-narrow section' });
  const card = h('div', { class: 'card card-pad elevated', style: { maxWidth: '460px', margin: '0 auto' } });
  const cfg = await api.get('/config').catch(() => ({ googleClientId: '', razorpayTestMode: true }));
  await loadGoogle(cfg.googleClientId);

  const tabRow = h('div', { class: 'tabs', style: { marginBottom: '18px' } },
    h('button', { class: 'tab active', 'data-t': 'pwd' }, 'Password'),
    h('button', { class: 'tab', 'data-t': 'otp' }, 'OTP'));

  // Password form
  const idF = field({ label: 'Email or mobile', name: 'identifier', placeholder: 'you@email.com or 9xxxxxxxxx' });
  const pwF = field({ label: 'Password', name: 'password', type: 'password', placeholder: '••••••••' });
  const pwSubmit = h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Sign in');
  const pwForm = h('form', { onsubmit: onPwSubmit },
    idF.wrap, pwF.wrap, pwSubmit,
    h('p', { class: 'center muted text-sm', style: { marginTop: '16px' } }, 'New to Zuno? ', h('a', { href: '#/register' }, 'Create an account')));

  // OTP form
  const otpMobile = field({ label: 'Mobile', name: 'mobile', placeholder: '10-digit Indian mobile', inputmode: 'numeric' });
  const sendOtpBtn = h('button', { class: 'btn btn-outline btn-block', type: 'button', onclick: sendOtp }, 'Send OTP');
  const otpCode = field({ label: 'OTP', name: 'code', placeholder: '6-digit code', inputmode: 'numeric' });
  const otpSubmit = h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button', onclick: verifyOtp, style: { display: 'none' } }, 'Verify & login');
  const otpNote = h('p', { class: 'muted text-xs', style: { margin: '4px 0 12px' } }, 'We’ll send a one-time password to your mobile.');
  const otpForm = h('form', { onsubmit: (e) => e.preventDefault() }, otpMobile.wrap, sendOtpBtn, otpNote, otpCode.wrap, otpSubmit);
  otpForm.style.display = 'none';

  const googleWrap = h('div', { style: { marginTop: '18px' } });
  renderGoogleButton(googleWrap);

  tabRow.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    tabRow.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const isOtp = t.dataset.t === 'otp';
    pwForm.style.display = isOtp ? 'none' : '';
    otpForm.style.display = isOtp ? '' : 'none';
  }));

  card.append(
    h('div', { class: 'center', style: { marginBottom: '20px' } }, h('div', { class: 'brand', style: { justifyContent: 'center' } }, h('span', { class: 'logo' }, 'Z'), 'Zuno')),
    h('h2', { class: 'center' }, 'Welcome back'),
    tabRow, pwForm, otpForm,
    h('div', { class: 'divider' }),
    googleWrap);
  root.append(card);

  async function onPwSubmit(e) {
    e.preventDefault();
    [idF, pwF].forEach((f) => f.err.classList.add('hide'));
    pwSubmit.disabled = true; pwSubmit.textContent = 'Signing in…';
    try {
      const { token, user } = await api.post('/auth/login', { identifier: idF.input.value.trim(), password: pwF.input.value });
      finalize({ token, user });
    } catch (err) {
      pwF.err.textContent = err.message; pwF.err.classList.remove('hide');
    } finally { pwSubmit.disabled = false; pwSubmit.textContent = 'Sign in'; }
  }

  async function sendOtp() {
    otpMobile.err.classList.add('hide');
    const mobile = otpMobile.input.value.trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) { otpMobile.err.textContent = 'Enter a valid 10-digit mobile'; otpMobile.err.classList.remove('hide'); return; }
    sendOtpBtn.disabled = true; sendOtpBtn.textContent = 'Sending…';
    try {
      const data = await api.post('/auth/otp/request', { mobile });
      otpSubmit.style.display = '';
      otpNote.textContent = data.devOtp ? `Dev OTP: ${data.devOtp} (would be SMS in production)` : 'Enter the OTP sent to your mobile.';
      toast('OTP sent', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { sendOtpBtn.disabled = false; sendOtpBtn.textContent = 'Resend OTP'; }
  }

  async function verifyOtp() {
    otpCode.err.classList.add('hide');
    try {
      const { token, user } = await api.post('/auth/otp/verify', { mobile: otpMobile.input.value.trim(), code: otpCode.input.value.trim() });
      finalize({ token, user });
    } catch (e) { otpCode.err.textContent = e.message; otpCode.err.classList.remove('hide'); }
  }

  return root;
}

export function Register() {
  const root = h('div', { class: 'container-narrow section' });
  const card = h('div', { class: 'card card-pad elevated', style: { maxWidth: '480px', margin: '0 auto' } });
  const nameF = field({ label: 'Full name', name: 'name', placeholder: 'Your name' });
  const emailF = field({ label: 'Email (optional)', name: 'email', type: 'email', placeholder: 'you@email.com' });
  const mobF = field({ label: 'Mobile', name: 'mobile', placeholder: '10-digit Indian mobile', inputmode: 'numeric', note: 'Indian mobile number, e.g. 9xxxxxxxxx' });
  const pwF = field({ label: 'Password', name: 'password', type: 'password', placeholder: 'At least 8 characters' });
  const submit = h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Create account');

  const form = h('form', { onsubmit: onSubmit },
    h('div', { class: 'center', style: { marginBottom: '20px' } }, h('div', { class: 'brand', style: { justifyContent: 'center' } }, h('span', { class: 'logo' }, 'Z'), 'Zuno')),
    h('h2', { class: 'center' }, 'Create your account'),
    nameF.wrap, emailF.wrap, mobF.wrap, pwF.wrap,
    h('p', { class: 'muted text-xs', style: { margin: '4px 0 16px' } }, 'By continuing you agree to Zuno’s Terms & Privacy. Passwords are hashed — we never store them in plain text.'),
    submit,
    h('p', { class: 'center muted text-sm', style: { marginTop: '16px' } }, 'Already have an account? ', h('a', { href: '#/login' }, 'Sign in')));
  card.append(form);
  root.append(card);

  async function onSubmit(e) {
    e.preventDefault();
    [nameF, emailF, mobF, pwF].forEach((f) => f.err.classList.add('hide'));
    const payload = { name: nameF.input.value.trim(), email: emailF.input.value.trim(), mobile: mobF.input.value.trim(), password: pwF.input.value };
    if (!payload.email) delete payload.email;
    submit.disabled = true; submit.textContent = 'Creating account…';
    try {
      const { token, user } = await api.post('/auth/register', payload);
      finalize({ token, user });
    } catch (err) {
      const map = { MOBILE_EXISTS: mobF, EMAIL_EXISTS: emailF, 'Validation failed': mobF };
      (map[err.code] || pwF).err.textContent = err.message; (map[err.code] || pwF).err.classList.remove('hide');
    } finally { submit.disabled = false; submit.textContent = 'Create account'; }
  }
  return root;
}
