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
      const { token, user } = await api.post('/auth/register', payload);
      finalize({ token, user });
    } catch (err) {
      const map = { MOBILE_EXISTS: mobF, EMAIL_EXISTS: emailF, 'Validation failed': mobF };
      (map[err.code] || pwF).err.textContent = err.message; (map[err.code] || pwF).err.classList.remove('hide');
    } finally { submit.disabled = false; submit.textContent = 'Create account'; }
  }
  return root;
}

export function ForgotPassword() {
  const root = h('div', { class: 'container-narrow section' });
  const card = h('div', { class: 'card card-pad elevated', style: { maxWidth: '460px', margin: '0 auto' } });
  const emailF = field({ label: 'Email address', name: 'email', type: 'email', placeholder: 'you@email.com' });
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px', textAlign:'center'} });
  const btn = h('button', { class:'btn btn-primary btn-block btn-lg', type:'button' }, 'Send OTP');
  const preview = h('div', { style:{display:'none', marginTop:'12px', padding:'12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', fontSize:'12px', textAlign:'center'} });
  btn.onclick = async () => {
    emailF.err.classList.add('hide'); msg.textContent=''; preview.style.display='none';
    const email = emailF.input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailF.err.textContent='Enter a valid email'; emailF.err.classList.remove('hide'); return; }
    btn.disabled=true; btn.textContent='Sending…';
    try {
      const data = await api.post('/auth/forgot-password', { email }, { auth:false });
      msg.textContent = data?.message || 'If an account exists with this email, an OTP has been sent.';
      msg.style.color='#16a34a';
      toast('OTP sent — check email (and Spam)','success');
      if (data && data.devOtp) { preview.style.display='block'; preview.textContent='Dev OTP: '+data.devOtp+' (expires 10m)'; }
      setTimeout(()=> location.hash = '#/verify-otp?email='+encodeURIComponent(email), 800);
    } catch(e){ msg.textContent=e.message; msg.style.color='#dc2626'; toast(e.message,'error'); }
    btn.disabled=false; btn.textContent='Send OTP';
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
  btn.onclick = async ()=>{
    emailF.err.classList.add('hide'); otpF.err.classList.add('hide'); msg.textContent='';
    const em=emailF.input.value.trim(); const otp=otpF.input.value.trim();
    if(!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ emailF.err.textContent='Enter valid email'; emailF.err.classList.remove('hide'); return; }
    if(!/^\d{6}$/.test(otp)){ otpF.err.textContent='Enter 6-digit OTP'; otpF.err.classList.remove('hide'); return; }
    btn.disabled=true; btn.textContent='Verifying…';
    try{
      const data = await api.post('/auth/verify-otp', { email:em, otp }, {auth:false});
      toast('OTP verified','success');
      const token=data && data.token;
      if(token) location.hash='#/reset-password?token='+encodeURIComponent(token);
      else msg.textContent='Verified — redirecting…';
    }catch(e){ msg.textContent=e.message; msg.style.color='#dc2626'; toast(e.message,'error'); }
    btn.disabled=false; btn.textContent='Verify OTP';
  };
  resend.onclick = async ()=>{
    const em=emailF.input.value.trim();
    if(!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ toast('Enter valid email','error'); return; }
    resend.disabled=true; resend.textContent='Sending…';
    try{ await api.post('/auth/forgot-password', {email:em}, {auth:false}); toast('OTP resent — check email','success'); msg.textContent='A new OTP has been sent.'; msg.style.color='#16a34a'; }catch(e){ toast(e.message,'error'); }
    resend.disabled=false; resend.textContent='Resend OTP';
  };
  card.append(
    h('div', { class:'center', style:{marginBottom:'20px'} }, h('div', { class:'brand', style:{justifyContent:'center'} }, 'ZUNO')),
    h('h2', { class:'center' }, 'Verify OTP'),
    h('p', { class:'center muted text-sm', style:{marginBottom:'16px'} }, 'Enter the 6-digit code sent to your email. Expires in 10 minutes. Check Spam.'),
    emailF.wrap, otpF.wrap, msg, btn, resend,
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
      const m=e.message||'Reset failed'; msg.textContent=m; msg.style.color='#dc2626'; toast(m,'error');
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
