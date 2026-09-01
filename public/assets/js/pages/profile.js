import { h, toast, emptyState } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';

const SIDEBAR = [
  { key: '', label: '👤 Account', href: '#/profile' },
  { key: 'addresses', label: '📍 Addresses', href: '#/profile/addresses' },
  { key: 'orders', label: '📦 Orders', href: '#/orders' },
  { key: 'wishlist', label: '♥ Wishlist', href: '#/wishlist' },
  { key: 'notifications', label: '🔔 Notifications', href: '#/notifications' },
  { key: 'security', label: '🔒 Security', href: '#/profile/security' },
];

export async function Profile({ params }) {
  const root = h('div', { class: 'container section' });
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in to view profile', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }
  const user = Store.getUser();
  const tab = params.tab || '';

  const side = h('div', { class: 'sidebar' }, ...SIDEBAR.map((s) => h('a', { href: s.href, class: (s.key === tab ? 'active' : '') }, s.label)));
  const content = h('div', { class: 'card card-pad elevated', style: { minHeight: '300px' } });
  const partnerHref = { SELLER: '#/seller', RESTAURANT: '#/restaurant-admin', SERVICE_PROVIDER: '#/provider-admin' }[user.role];
  if (partnerHref) side.append(h('a', { href: partnerHref, class: 'active', style: { background: 'var(--zuno-primary-50)', color: 'var(--zuno-primary)' } }, '🛠️ Partner dashboard'));
  root.append(h('h1', {}, 'Account'), h('div', { class: 'split', style: { gridTemplateColumns: '240px 1fr' } }, side, content));

  if (tab === 'addresses') return renderAddresses(root, content);
  if (tab === 'security') return renderSecurity(root, content, user);
  // default account
  content.append(
    h('div', { class: 'row gap-4', style: { alignItems: 'center', marginBottom: '16px' } },
      h('div', { class: 'avatar', style: { width: '56px', height: '56px', fontSize: '22px' } }, (user.name || 'Z')[0].toUpperCase()),
      h('div', {}, h('h2', { style: { margin: 0 } }, user.name), h('div', { class: 'muted text-sm' }, user.email || user.mobile))),
    h('div', { class: 'divider' }),
    h('div', { class: 'field' }, h('label', {}, 'Name'), (() => { const i = h('input', { class: 'input', value: user.name }); i.dataset.k = 'name'; return i; })()),
    h('div', { class: 'field' }, h('label', {}, 'Email'), (() => { const i = h('input', { class: 'input', value: user.email || '' }); i.dataset.k = 'email'; return i; })()),
    h('div', { class: 'field' }, h('label', {}, 'Mobile'), (() => { const i = h('input', { class: 'input', value: user.mobile }); i.dataset.k = 'mobile'; return i; })()),
    h('button', { class: 'btn btn-primary', onclick: async (e) => {
      const btn = e.target; btn.disabled = true;
      try { const u = await api.put('/users/profile', { name: content.querySelector('[data-k=name]').value, email: content.querySelector('[data-k=email]').value || undefined, mobile: content.querySelector('[data-k=mobile]').value }); Store.setUser(u.user); toast('Profile updated', 'success'); }
      catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    } }, 'Save changes'),
    h('div', { class: 'divider' }),
    h('button', { class: 'btn btn-danger', onclick: () => { Store.setToken(null); Store.setUser(null); toast('Signed out', 'info'); location.hash = '#/'; } }, 'Log out'));
  return root;
}

async function renderAddresses(root, content) {
  content.innerHTML = ''; content.append(h('h2', {}, 'Addresses'));
  let addresses = await api.get('/users/addresses');
  const list = h('div', { class: 'col gap-3' });
  content.append(list);
  const draw = () => {
    list.innerHTML = '';
    if (!addresses.length) list.append(emptyState({ icon: '📍', title: 'No saved addresses', desc: 'Add your home or work address for faster checkout.' }));
    addresses.forEach((a) => list.append(h('div', { class: 'card', style: { padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', {}, h('div', { class: 'fw-600' }, (a.label ? a.label + ' · ' : '') + a.line1), h('div', { class: 'muted text-sm' }, a.city + ' ' + a.pincode)),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await api.del('/users/addresses/' + a.id); addresses = await api.get('/users/addresses'); draw(); } }, 'Remove'))));
  };
  draw();
  const line1 = h('input', { class: 'input', placeholder: 'Address' });
  const city = h('input', { class: 'input', placeholder: 'City' });
  const pincode = h('input', { class: 'input', placeholder: 'PIN' });
  content.append(h('div', { class: 'divider' }),
    h('div', { class: 'row gap-2 wrap', style: { marginTop: '12px' } }, line1, city, pincode,
      h('button', { class: 'btn btn-primary', onclick: async () => { try { await api.post('/users/addresses', { line1: line1.value, city: city.value, pincode: pincode.value }); addresses = await api.get('/users/addresses'); draw(); line1.value = city.value = pincode.value = ''; toast('Address added', 'success'); } catch (e) { toast(e.message, 'error'); } } }, '+ Add')));
  return root;
}

async function renderSecurity(root, content, user) {
  content.innerHTML = '';
  content.append(h('h2', {}, 'Security'),
    h('div', { class: 'notice', style: { marginBottom: '16px' } }, 'Passwords are hashed with bcrypt and never stored in plain text. Authentication uses signed JWTs. OTP and Google login are architected and ready to enable.'),
    h('div', { class: 'row between' }, h('div', {}, h('div', { class: 'fw-600' }, 'Role'), h('div', { class: 'muted text-sm' }, user.role)), h('span', { class: 'badge badge-info' }, user.role)),
    h('div', { class: 'divider' }),
    h('div', { class: 'row between' }, h('div', { class: 'fw-600' }, 'Email verification'), user.email_verified ? h('span', { class: 'badge badge-success' }, 'Verified') : h('span', { class: 'badge badge-warning' }, 'Pending')),
    h('p', { class: 'muted text-sm', style: { marginTop: '12px' } }, 'Account ID: #' + user.id));
  return root;
}
