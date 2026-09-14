import { h, mount, toast } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

function field({ label, type = 'text', name, placeholder, value = '', note, inputmode }) {
  const ac = name === 'password' ? 'current-password' : (name === 'identifier' ? 'username' : (name === 'email' ? 'email' : (name === 'mobile' ? 'tel' : 'on')));
  const im = inputmode || (name === 'mobile' || name === 'code' || name === 'otp' ? 'numeric' : undefined);
  const input = h('input', { class: 'input', type, name, placeholder, value, inputmode: im, autocomplete: ac, autocapitalize: 'off', spellcheck: 'false' });
  // Ensure mobile browsers don't zoom on focus (font-size 16px) and provide correct keyboard
  if (type === 'email') input.inputMode = 'email';
  const err = h('div', { class: 'field-error hide' });
  return { wrap: h('div', { class: 'field' }, h('label', {}, label), input, note && h('span', { class: 'muted text-xs' }, note), err), input, err };
}
function friendlyError(err) {
  const msg = err && err.message ? String(err.message) : 'Something went wrong';
  if (err && (err.code === 'NETWORK_ERROR' || msg.includes('Network error') || msg.includes('Failed to fetch'))) {
    return 'Network error — please check your internet and try again. Server may be waking up (wait 10s and retry).';
  }
  if (String(msg).includes('Load failed')) return 'Network error — please retry in a few seconds.';
  return msg;
}

function redirectAfterLogin(user) {
  // Main website only — founder/admin stays on storefront
  location.hash = '#/';
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
  const cfg = (await api.get('/config').catch(() => ({ googleClientId: '', razorpayTestMode: true }))) || { googleClientId: '', razorpayTestMode: true };
  await loadGoogle(cfg?.googleClientId || '');

  const tabRow = h('div', { class: 'tabs', style: { marginBottom: '18px' } },
    h('button', { class: 'tab active', 'data-t': 'pwd' }, 'Password'),
    h('button', { class: 'tab', 'data-t': 'otp' }, 'OTP'));

  // Password form
  const idF = field({ label: 'Email or mobile', name: 'identifier', placeholder: 'you@email.com or 9xxxxxxxxx' });
  const pwF = field({ label: 'Password', name: 'password', type: 'password', placeholder: '••••••••' });
  const pwSubmit = h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Sign in');
  const pwForm = h('form', { onsubmit: onPwSubmit },
    idF.wrap, pwF.wrap,
    h('div', { style:{textAlign:'right', marginTop:'6px'} }, h('a', { href:'#/forgot-password', style:{fontSize:'13px', color:'var(--primary)', fontWeight:'600'} }, 'Forgot Password?')),
    pwSubmit,
    h('p', { class: 'center muted text-sm', style: { marginTop: '16px' } }, 'New to ZUNO? ', h('a', { href: '#/register' }, 'Create an account')));

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

  const demoBox = h('div', { class: 'card', style: { marginTop: '16px', background: 'var(--ink-50)', border: '1px dashed var(--ink-200)', padding: '12px' } },
    h('div', { class: 'fw-600 text-sm', style: { marginBottom: '6px' } }, 'Demo accounts (try without registering)'),
    h('div', { class: 'muted text-xs', style: { lineHeight: '1.6' } },
      h('div', {}, h('strong', {}, 'Customer:'), ' demo@zuno.app / Demo@1234  (or 9876543210)')),
    h('button', { class: 'btn btn-ghost btn-sm', style: { marginTop: '8px' }, type: 'button', onclick: () => { idF.input.value = 'demo@zuno.app'; pwF.input.value = 'Demo@1234'; toast('Demo credentials filled — click Sign in', 'info'); } }, 'Fill demo customer →'));

  card.append(
    h('div', { class: 'center', style: { marginBottom: '20px' } }, h('div', { class: 'brand', style: { justifyContent: 'center', fontFamily: 'var(--font-display)', letterSpacing: '0.12em' } }, 'ZUNO')),
    h('h2', { class: 'center', style: { fontFamily: 'var(--font-display)' } }, 'Welcome back'),
    tabRow, pwForm, otpForm,
    demoBox,
    h('div', { class: 'divider' }),
    googleWrap);
  root.append(card);

  async function onPwSubmit(e) {
    e.preventDefault();
    [idF, pwF].forEach((f) => f.err.classList.add('hide'));
    const ident = idF.input.value.trim();
    const pw = pwF.input.value;
    if (!ident) { idF.err.textContent = 'Enter email or mobile'; idF.err.classList.remove('hide'); return; }
    if (!pw) { pwF.err.textContent = 'Enter password'; pwF.err.classList.remove('hide'); return; }
    pwSubmit.disabled = true; pwSubmit.textContent = 'Signing in…';
    try {
      const { token, user } = await api.post('/auth/login', { identifier: ident, password: pw });
      finalize({ token, user });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || String(err.message).includes('verify your email')) {
        toast('Please verify your email — OTP sent', 'warning');
        const email = ident.includes('@') ? ident : '';
        if (email) {
          // Trigger resend to ensure OTP exists
          api.post('/auth/resend-verification', { email }, {auth:false}).catch(()=>{});
          location.hash = '#/verify-email?email=' + encodeURIComponent(email);
        } else {
          location.hash = '#/verify-email';
        }
        pwF.err.textContent = 'Email not verified — check email for OTP'; pwF.err.classList.remove('hide');
        return;
      }
      const msg = friendlyError(err);
      pwF.err.textContent = msg; pwF.err.classList.remove('hide');
      if (err.code === 'NETWORK_ERROR' || String(err.message).includes('Failed to fetch')) toast(msg, 'error');
      else toast(err.message, 'error');
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
      otpNote.textContent = data && data.devOtp ? `Dev OTP: ${data.devOtp}` : 'Enter the OTP sent to your mobile.';
      toast('OTP sent', 'success');
    } catch (e) { const msg = friendlyError(e); otpMobile.err.textContent = msg; otpMobile.err.classList.remove('hide'); toast(msg, 'error'); }
    finally { sendOtpBtn.disabled = false; sendOtpBtn.textContent = 'Resend OTP'; }
  }

  async function verifyOtp() {
    otpCode.err.classList.add('hide');
    const code = otpCode.input.value.trim();
    if (!/^\d{6}$/.test(code)) { otpCode.err.textContent = 'Enter 6-digit OTP'; otpCode.err.classList.remove('hide'); return; }
    otpSubmit.disabled = true; otpSubmit.textContent = 'Verifying…';
    try {
      const { token, user } = await api.post('/auth/otp/verify', { mobile: otpMobile.input.value.trim(), code });
      finalize({ token, user });
    } catch (e) { const msg = friendlyError(e); otpCode.err.textContent = msg; otpCode.err.classList.remove('hide'); toast(msg, 'error'); }
    finally { otpSubmit.disabled = false; otpSubmit.textContent = 'Verify & login'; }
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
    h('div', { class: 'center', style: { marginBottom: '20px' } }, h('div', { class: 'brand', style: { justifyContent: 'center' } }, h('span', { class: 'logo' }, 'Z'), 'ZUNO')),
    h('h2', { class: 'center' }, 'Create your account'),
    nameF.wrap, emailF.wrap, mobF.wrap, pwF.wrap,
    h('p', { class: 'muted text-xs', style: { margin: '4px 0 16px' } }, 'By continuing you agree to ZUNO’s Terms & Privacy. Passwords are hashed — we never store them in plain text.'),
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
      const data = await api.post('/auth/register', payload);
      // TalkSpace pattern: if email provided, registration requires verification
      if (data && data.needsVerification) {
        toast('Account created — verification OTP sent to email', 'success');
        const email = payload.email;
        // Show dev OTP if present
        if (data.devOtp) toast('Dev OTP: ' + data.devOtp + ' (10m)', 'info');
        location.hash = '#/verify-email?email=' + encodeURIComponent(email);
        return;
      }
      const { token, user } = data;
      if (token && user) finalize({ token, user });
      else {
        // Fallback — treat as needs verification
        toast('Account created', 'success');
        location.hash = '#/login';
      }
    } catch (err) {
      const msg = friendlyError(err);
      // Handle EMAIL_NOT_VERIFIED from login-like flow
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        toast('Please verify your email', 'warning');
        const email = emailF.input.value.trim();
        if (email) location.hash = '#/verify-email?email=' + encodeURIComponent(email);
        return;
      }
      const map = { MOBILE_EXISTS: mobF, EMAIL_EXISTS: emailF, 'Validation failed': mobF, NETWORK_ERROR: pwF };
      (map[err.code] || map[msg] || pwF).err.textContent = msg; (map[err.code] || map[msg] || pwF).err.classList.remove('hide');
      toast(msg, 'error');
    } finally { submit.disabled = false; submit.textContent = 'Create account'; }
  }
  return root;
}

export function VerifyEmail() {
  const hashQ = location.hash.split('?')[1]||'';
  let email = new URLSearchParams(hashQ).get('email')||'';
  try { if(!email) email=new URLSearchParams(location.search).get('email')||''; } catch {}
  email=decodeURIComponent(email||'').trim();
  const root = h('div', { class: 'container-narrow section' });
  const card = h('div', { class: 'card card-pad elevated', style: { maxWidth: '460px', margin: '0 auto' } });
  const emailF = field({ label:'Email address', name:'email', type:'email', placeholder:'you@email.com', value:email });
  const otpF = field({ label:'Verification Code', name:'otp', placeholder:'6-digit OTP', inputmode:'numeric' });
  otpF.input.maxLength=6; otpF.input.style.letterSpacing='0.3em'; otpF.input.style.textAlign='center'; otpF.input.style.fontWeight='700'; otpF.input.style.fontSize='18px';
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px', textAlign:'center'} });
  const btn = h('button', { class:'btn btn-primary btn-block btn-lg', type:'button' }, 'Verify Email');
  const resend = h('button', { class:'btn btn-outline btn-block', type:'button', style:{marginTop:'8px'} }, 'Resend Code');
  let resendTimer = null; let countdown = 0;
  function startCountdown(sec=60) {
    countdown = sec;
    resend.disabled = true;
    const tick = () => {
      if (countdown <= 0) { resend.disabled=false; resend.textContent='Resend Code'; return; }
      resend.textContent = `Resend in ${countdown}s`;
      countdown--;
      resendTimer = setTimeout(tick, 1000);
    };
    tick();
  }
  btn.onclick = async ()=>{
    emailF.err.classList.add('hide'); otpF.err.classList.add('hide'); msg.textContent='';
    const em=emailF.input.value.trim(); const otp=otpF.input.value.trim();
    if(!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ emailF.err.textContent='Enter valid email'; emailF.err.classList.remove('hide'); return; }
    if(!/^\d{6}$/.test(otp)){ otpF.err.textContent='Enter 6-digit OTP'; otpF.err.classList.remove('hide'); return; }
    btn.disabled=true; btn.textContent='Verifying…';
    try{
      const data = await api.post('/auth/verify-email', { email:em, otp }, {auth:false});
      toast('Email verified — welcome to ZUNO!', 'success');
      if (data && data.token && data.user) finalize({ token: data.token, user: data.user });
      else { toast('Verified — please log in', 'success'); location.hash='#/login'; }
    }catch(e){ const m=friendlyError(e); msg.textContent=m; msg.style.color='#dc2626'; toast(m,'error'); if (m.includes('expired')) msg.textContent='OTP expired — tap Resend Code'; }
    btn.disabled=false; btn.textContent='Verify Email';
  };
  resend.onclick = async ()=>{
    const em=emailF.input.value.trim();
    if(!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast('Enter valid email','error'); return; }
    if (countdown > 0) return;
    resend.disabled=true; resend.textContent='Sending…';
    try{
      const data = await api.post('/auth/resend-verification', {email:em}, {auth:false});
      toast('Verification code resent — check inbox and Spam','success');
      msg.textContent='New code sent — check email (and Spam).'; msg.style.color='#16a34a';
      if (data && data.devOtp) { msg.textContent += ' Dev OTP: ' + data.devOtp; }
      startCountdown(60);
    }catch(e){
      const m=friendlyError(e);
      if (e.code==='ALREADY_VERIFIED') { toast('Email already verified — please log in','success'); location.hash='#/login'; return; }
      if (e.code==='COOLDOWN' || e.code==='RATE_LIMITED' || m.includes('wait 60') || m.includes('Too many requests')) {
        msg.textContent='Please wait 60 seconds before requesting another code'; msg.style.color='#f59e0b';
        toast('Please wait before resending','warning');
        startCountdown(60);
        return;
      }
      toast(m,'error'); msg.textContent=m; msg.style.color='#dc2626'; resend.disabled=false; resend.textContent='Resend Code';
    }
  };
  // Auto-start countdown if navigated from register (avoid spam)
  setTimeout(()=> startCountdown(30), 500);
  card.append(
    h('div', { class:'center', style:{marginBottom:'20px'} }, h('div', { class:'brand', style:{justifyContent:'center'} }, 'ZUNO')),
    h('h2', { class:'center' }, 'Verify Your Email'),
    h('p', { class:'center muted text-sm', style:{marginBottom:'16px'} }, 'Enter the 6-digit code sent to your email. Expires in 10 minutes. Check Spam / Promotions.'),
    emailF.wrap, otpF.wrap, msg, btn, resend,
    h('p', { class:'center muted text-sm', style:{marginTop:'16px'} }, h('a', {href:'#/login'}, '← Back to Login'))
  );
  root.append(card);
  return root;
}

export function ForgotPassword() {
  const root = h('div', { class: 'container-narrow section' });
  const card = h('div', { class: 'card card-pad elevated', style: { maxWidth: '460px', margin: '0 auto' } });
  const emailF = field({ label: 'Email address', name: 'email', type: 'email', placeholder: 'you@email.com' });
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px', textAlign:'center'} });
  const btn = h('button', { class:'btn btn-primary btn-block btn-lg', type:'button' }, 'Send OTP');
  const preview = h('div', { style:{display:'none', marginTop:'12px', padding:'12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', fontSize:'12px', textAlign:'center'} });
  let cooldown = 0; let timer = null;
  function startCooldown(sec=60){
    cooldown = sec;
    btn.disabled = true;
    const tick = () => {
      if (cooldown <= 0) { btn.disabled=false; btn.textContent='Send OTP'; return; }
      btn.textContent = `Wait ${cooldown}s`;
      cooldown--; timer = setTimeout(tick, 1000);
    };
    tick();
  }
  btn.onclick = async () => {
    if (cooldown > 0) return;
    emailF.err.classList.add('hide'); msg.textContent=''; preview.style.display='none';
    const email = emailF.input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailF.err.textContent='Enter a valid email'; emailF.err.classList.remove('hide'); return; }
    btn.disabled=true; btn.textContent='Sending…';
    try {
      const data = await api.post('/auth/forgot-password', { email }, { auth:false });
      msg.textContent = data?.message || 'If an account exists with this email, an OTP has been sent.';
      msg.style.color='#16a34a';
      toast('OTP sent — check email (and Spam / Promotions folder)','success');
      if (data && data.devOtp) { preview.style.display='block'; preview.textContent='Dev OTP: '+data.devOtp+' (expires 10m)'; }
      startCooldown(60);
      setTimeout(()=> location.hash = '#/verify-otp?email='+encodeURIComponent(email), 900);
    } catch(e){
      const m=friendlyError(e);
      if (e.code === 'COOLDOWN' || m.includes('wait 60')) {
        msg.textContent='Please wait 60 seconds before requesting another OTP'; msg.style.color='#f59e0b';
        toast('Please wait before resending','warning');
        startCooldown(60);
      } else if (e.code === 'NETWORK_ERROR' || m.includes('Network error')) {
        msg.textContent='Network error — please wait 10s and retry. If on Render free tier, server may be waking.'; msg.style.color='#dc2626';
        toast('Network error — retry in 10s','error');
      } else {
        msg.textContent=m; msg.style.color='#dc2626'; toast(m,'error');
      }
      if (cooldown <= 0) { btn.disabled=false; btn.textContent='Send OTP'; }
    }
  };
  card.append(
    h('div', { class:'center', style:{marginBottom:'20px'} }, h('div', { class:'brand', style:{justifyContent:'center', fontFamily:'var(--font-display)', letterSpacing:'0.12em'} }, 'ZUNO')),
    h('h2', { class:'center', style:{fontFamily:'var(--font-display)'} }, 'Forgot your password?'),
    h('p', { class:'center muted text-sm', style:{marginBottom:'16px'} }, "Enter your email and we'll send you a 6-digit OTP to reset your password."),
    emailF.wrap, msg, btn, preview,
    h('p', { class:'center muted text-sm', style:{marginTop:'16px'} }, h('a', { href:'#/login' }, '← Back to Login'))
  );
  root.append(card);
  emailF.input.addEventListener('keydown', e=>{ if(e.key==='Enter') btn.click(); });
  return root;
}

export function VerifyOtp() {
  const hashQ = location.hash.split('?')[1]||'';
  let email = new URLSearchParams(hashQ).get('email')||'';
  try { if(!email) email=new URLSearchParams(location.search).get('email')||''; } catch {}
  email=decodeURIComponent(email||'').trim();
  const root = h('div', { class:'container-narrow section' });
  const card = h('div', { class:'card card-pad elevated', style:{maxWidth:'460px', margin:'0 auto'} });
  const emailF = field({ label:'Email address', name:'email', type:'email', placeholder:'you@email.com', value:email });
  const otpF = field({ label:'OTP Code', name:'otp', placeholder:'6-digit OTP', inputmode:'numeric' });
  otpF.input.maxLength=6; otpF.input.style.letterSpacing='0.3em'; otpF.input.style.textAlign='center'; otpF.input.style.fontWeight='700'; otpF.input.style.fontSize='18px';
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px', textAlign:'center'} });
  const btn = h('button', { class:'btn btn-primary btn-block btn-lg', type:'button' }, 'Verify OTP');
  const resend = h('button', { class:'btn btn-outline btn-block', type:'button', style:{marginTop:'8px'} }, 'Resend OTP');
  // --- Inline Reset Password Step (single page OTP → new password) ---
  let verifiedToken = null;
  const pwF = field({ label:'New Password', name:'password', type:'password', placeholder:'At least 8 chars, 1 upper, 1 lower, 1 number' });
  const cfF = field({ label:'Confirm New Password', name:'confirm', type:'password', placeholder:'Confirm new password' });
  const showPw = h('label', {style:{display:'flex', gap:'6px', alignItems:'center', fontSize:'12px', color:'#64748b', cursor:'pointer', marginTop:'8px'}}, h('input',{type:'checkbox', onchange:(e)=>{ pwF.input.type=e.target.checked?'text':'password'; cfF.input.type=e.target.checked?'text':'password'; }}), ' Show passwords');
  const hint = h('div', {style:{fontSize:'11px', color:'#64748b', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'10px', marginTop:'8px'}}, h('div',{style:{fontWeight:'700', color:'#334155'}},'Password requirements:'), h('div',{},'• Minimum 8 characters • At least one uppercase • One lowercase • One number'));
  const resetMsg = h('div', {style:{fontSize:'13px', minHeight:'18px', marginTop:'8px', textAlign:'center'}});
  const resetBtn = h('button', {class:'btn btn-primary btn-block btn-lg', type:'button'}, 'Set New Password');
  const resetSuccess = h('div', {style:{display:'none', textAlign:'center', marginTop:'12px'}}, h('div',{style:{fontSize:'40px'}},'✅'), h('h3',{style:{color:'#16a34a'}},'Password reset successful.'), h('p',{class:'muted text-sm'},'You can now log in with your new password.'), h('a',{class:'btn btn-primary', href:'#/login'},'Back to Login'));
  const otpStep = h('div', {}, emailF.wrap, otpF.wrap, msg, btn, resend);
  const resetStep = h('div', {style:{display:'none', flexDirection:'column', gap:'8px'}}, h('div', {style:{textAlign:'center', marginBottom:'8px'}}, h('div',{style:{fontSize:'24px'}},'🔒'), h('h3',{},'Create New Password'), h('p',{class:'muted text-sm'},'OTP verified — now set your new password.')), pwF.wrap, cfF.wrap, showPw, hint, resetMsg, resetBtn, resetSuccess);
  resetBtn.onclick = async ()=>{
    resetMsg.textContent=''; pwF.err.classList.add('hide'); cfF.err.classList.add('hide');
    const pw=pwF.input.value, cf=cfF.input.value;
    if(!pw){ pwF.err.textContent='Password is required'; pwF.err.classList.remove('hide'); return; }
    if(pw.length<8){ pwF.err.textContent='At least 8 characters'; pwF.err.classList.remove('hide'); return; }
    if(!/[A-Z]/.test(pw)){ pwF.err.textContent='Need uppercase'; pwF.err.classList.remove('hide'); return; }
    if(!/[a-z]/.test(pw)){ pwF.err.textContent='Need lowercase'; pwF.err.classList.remove('hide'); return; }
    if(!/[0-9]/.test(pw)){ pwF.err.textContent='Need number'; pwF.err.classList.remove('hide'); return; }
    if(!cf){ cfF.err.textContent='Confirm required'; cfF.err.classList.remove('hide'); return; }
    if(pw!==cf){ cfF.err.textContent='Passwords must match'; cfF.err.classList.remove('hide'); return; }
    if(!verifiedToken){ resetMsg.textContent='Missing token — please verify OTP again'; resetMsg.style.color='#dc2626'; return; }
    resetBtn.disabled=true; resetBtn.textContent='Resetting…';
    try{
      const data=await api.post('/auth/reset-password', {token: verifiedToken, password:pw}, {auth:false});
      resetStep.querySelectorAll('div').forEach(()=>{}); // keep
      pwF.wrap.style.display='none'; cfF.wrap.style.display='none'; showPw.style.display='none'; hint.style.display='none'; resetBtn.style.display='none';
      resetSuccess.style.display='block';
      toast(data?.message||'Reset successful — please log in','success');
    }catch(e){
      const m=friendlyError(e); resetMsg.textContent=m; resetMsg.style.color='#dc2626'; toast(m,'error');
    }
    resetBtn.disabled=false; resetBtn.textContent='Set New Password';
  };
  btn.onclick = async ()=>{
    emailF.err.classList.add('hide'); otpF.err.classList.add('hide'); msg.textContent='';
    const em=emailF.input.value.trim(); const otp=otpF.input.value.trim();
    if(!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ emailF.err.textContent='Enter valid email'; emailF.err.classList.remove('hide'); return; }
    if(!/^\d{6}$/.test(otp)){ otpF.err.textContent='Enter 6-digit OTP'; otpF.err.classList.remove('hide'); return; }
    btn.disabled=true; btn.textContent='Verifying…';
    try{
      const data = await api.post('/auth/verify-otp', { email:em, otp }, {auth:false});
      toast('OTP verified — now set new password','success');
      verifiedToken=data && data.token;
      if(verifiedToken){
        msg.textContent='✓ OTP verified — enter new password below'; msg.style.color='#16a34a';
        otpStep.style.display='none';
        resetStep.style.display='flex';
        // Focus password
        setTimeout(()=> pwF.input.focus(), 100);
      } else {
        msg.textContent='Verified — redirecting…';
        location.hash='#/reset-password?token='+encodeURIComponent(verifiedToken || '');
      }
    }catch(e){ const m=friendlyError(e); msg.textContent=m; msg.style.color='#dc2626'; toast(m,'error'); }
    btn.disabled=false; btn.textContent='Verify OTP';
  };
  let verifyOtpCountdown = 0; let verifyOtpTimer = null;
  function startVerifyCountdown(sec=60){
    verifyOtpCountdown = sec;
    resend.disabled = true;
    const tick = () => {
      if (verifyOtpCountdown <= 0) { resend.disabled=false; resend.textContent='Resend OTP'; return; }
      resend.textContent = `Resend in ${verifyOtpCountdown}s`;
      verifyOtpCountdown--;
      verifyOtpTimer = setTimeout(tick, 1000);
    };
    tick();
  }
  resend.onclick = async ()=>{
    const em=emailF.input.value.trim();
    if(!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast('Enter valid email','error'); return; }
    if (verifyOtpCountdown > 0) return;
    resend.disabled=true; resend.textContent='Sending…';
    try{ await api.post('/auth/forgot-password', {email:em}, {auth:false}); toast('OTP resent — check email (and Spam)','success'); msg.textContent='A new OTP has been sent — check email (and Spam).'; msg.style.color='#16a34a'; startVerifyCountdown(60); }catch(e){
      const m=friendlyError(e);
      if (e.code==='COOLDOWN' || e.code==='RATE_LIMITED' || m.includes('wait 60') || m.includes('Too many requests')) {
        msg.textContent='Please wait 60 seconds before requesting another OTP'; msg.style.color='#f59e0b';
        toast('Please wait before resending','warning');
        startVerifyCountdown(60);
        return;
      }
      toast(m,'error'); msg.textContent=m; msg.style.color='#dc2626'; resend.disabled=false; resend.textContent='Resend OTP';
    }
  };
  card.append(
    h('div', { class:'center', style:{marginBottom:'20px'} }, h('div', { class:'brand', style:{justifyContent:'center'} }, 'ZUNO')),
    h('h2', { class:'center' }, 'Verify OTP'),
    h('p', { class:'center muted text-sm', style:{marginBottom:'16px'} }, 'Enter the 6-digit code sent to your email. Expires in 10 minutes. Check Spam.'),
    otpStep, resetStep,
    h('p', { class:'center muted text-sm', style:{marginTop:'16px'} }, h('a', {href:'#/forgot-password'}, '← Back'), ' • ', h('a', {href:'#/login'}, 'Login'))
  );
  root.append(card);
  return root;
}

export function ResetPassword() {
  const hashQ=location.hash.split('?')[1]||'';
  let token=new URLSearchParams(hashQ).get('token')||'';
  try{ if(!token) token=new URLSearchParams(location.search).get('token')||''; }catch{}
  const root=h('div', {class:'container-narrow section'});
  const card=h('div', {class:'card card-pad elevated', style:{maxWidth:'460px', margin:'0 auto'}});
  if(!token){
    card.append(
      h('div', {class:'center'}, h('h2',{},'Invalid Reset Link')),
      h('p', {class:'center muted text-sm'}, 'This reset link is invalid. Please verify OTP again.'),
      h('div', {class:'center', style:{marginTop:'16px'}}, h('a', {class:'btn btn-primary', href:'#/forgot-password'}, 'Request OTP'))
    );
    root.append(card); return root;
  }
  const pwF=field({label:'New Password', name:'password', type:'password', placeholder:'At least 8 chars, 1 upper, 1 lower, 1 number'});
  const cfF=field({label:'Confirm New Password', name:'confirm', type:'password', placeholder:'Confirm new password'});
  const show=h('label', {style:{display:'flex', gap:'6px', alignItems:'center', fontSize:'12px', color:'#64748b', cursor:'pointer', marginTop:'8px'}}, h('input',{type:'checkbox', onchange:(e)=>{ pwF.input.type=e.target.checked?'text':'password'; cfF.input.type=e.target.checked?'text':'password'; }}), ' Show passwords');
  const hint=h('div', {style:{fontSize:'11px', color:'#64748b', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'10px', marginTop:'8px'}}, h('div',{style:{fontWeight:'700', color:'#334155'}},'Password requirements:'), h('div',{},'• Minimum 8 characters • At least one uppercase • One lowercase • One number'));
  const msg=h('div', {style:{fontSize:'13px', minHeight:'18px', marginTop:'8px', textAlign:'center'}});
  const btn=h('button', {class:'btn btn-primary btn-block btn-lg', type:'button'}, 'Reset Password');
  const success=h('div', {style:{display:'none', textAlign:'center'}}, h('div',{style:{fontSize:'40px'}},'✅'), h('h3',{style:{color:'#16a34a'}},'Password reset successful.'), h('p',{class:'muted text-sm'},'You can now log in with your new password.'), h('a',{class:'btn btn-primary', href:'#/login'},'Back to Login'));
  const formWrap=h('div', {style:{display:'flex', flexDirection:'column', gap:'8px'}}, pwF.wrap, cfF.wrap, show, hint, msg, btn);
  btn.onclick= async ()=>{
    msg.textContent=''; pwF.err.classList.add('hide'); cfF.err.classList.add('hide');
    const pw=pwF.input.value, cf=cfF.input.value;
    if(!pw){ pwF.err.textContent='Password is required'; pwF.err.classList.remove('hide'); return; }
    if(pw.length<8){ pwF.err.textContent='At least 8 characters'; pwF.err.classList.remove('hide'); return; }
    if(!/[A-Z]/.test(pw)){ pwF.err.textContent='Need uppercase'; pwF.err.classList.remove('hide'); return; }
    if(!/[a-z]/.test(pw)){ pwF.err.textContent='Need lowercase'; pwF.err.classList.remove('hide'); return; }
    if(!/[0-9]/.test(pw)){ pwF.err.textContent='Need number'; pwF.err.classList.remove('hide'); return; }
    if(!cf){ cfF.err.textContent='Confirm required'; cfF.err.classList.remove('hide'); return; }
    if(pw!==cf){ cfF.err.textContent='Passwords must match'; cfF.err.classList.remove('hide'); return; }
    btn.disabled=true; btn.textContent='Resetting…';
    try{ const data=await api.post('/auth/reset-password', {token, password:pw}, {auth:false}); formWrap.style.display='none'; success.style.display='block'; toast(data?.message||'Reset successful','success'); }catch(e){
      const m=friendlyError(e); msg.textContent=m; msg.style.color='#dc2626'; toast(m,'error');
    }
    btn.disabled=false; btn.textContent='Reset Password';
  };
  card.append(
    h('div', {class:'center', style:{marginBottom:'20px'}}, h('div',{class:'brand', style:{justifyContent:'center'}}, 'ZUNO')),
    h('h2', {class:'center'},'Set New Password'),
    h('p', {class:'center muted text-sm', style:{marginBottom:'16px'}},'Create a strong password for your account.'),
    formWrap, success
  );
  root.append(card); return root;
}
