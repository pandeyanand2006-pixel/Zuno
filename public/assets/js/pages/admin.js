import { h, money, toast, emptyState } from '../ui.js';
import { statusBadge } from './orders.js';
import { api } from '../api.js';
import { Store } from '../store.js';

export async function Admin() {
  const root = h('div', { class: 'container section' });
  const user = Store.getUser();
  if (!user || user.role !== 'ADMIN') { root.append(emptyState({ icon: '🔒', title: 'Admin access only', desc: 'Sign in with an admin account to view the dashboard.', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }

  const tabs = h('div', { class: 'tabs', style: { marginBottom: '20px' } },
    h('button', { class: 'tab active', 'data-t': 'overview' }, 'Overview'),
    h('button', { class: 'tab', 'data-t': 'orders' }, 'Orders'),
    h('button', { class: 'tab', 'data-t': 'products' }, 'Products'),
    h('button', { class: 'tab', 'data-t': 'users' }, 'Users'),
    h('button', { class: 'tab', 'data-t': 'payments' }, 'Payments'));
  const panel = h('div', {}, skeletonPanel());
  root.append(h('h1', {}, 'Admin dashboard'), tabs, panel);

  tabs.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('active')); t.classList.add('active'); load(t.dataset.t); }));

  async function load(t) {
    panel.innerHTML = ''; panel.append(skeletonPanel());
    try {
      if (t === 'overview') panel.append(await overview());
      if (t === 'orders') panel.append(await orders());
      if (t === 'products') panel.append(await products());
      if (t === 'users') panel.append(await users());
      if (t === 'payments') panel.append(await payments());
    } catch (e) { panel.innerHTML = ''; panel.append(emptyState({ icon: '⚠️', title: 'Failed', desc: e.message })); }
  }
  load('overview');
  return root;
}

function skeletonPanel() { return h('div', { class: 'row gap-4 wrap' }, ...Array.from({ length: 4 }, () => h('div', { class: 'stat skeleton', style: { width: '180px', height: '88px' } }))); }

async function overview() {
  const a = await api.get('/admin/analytics');
  const stats = h('div', { class: 'row gap-4 wrap' },
    stat(a.revenue ? money(a.revenue) : '₹0', 'Revenue'), stat(String(a.totalOrders), 'Orders'), stat(String(a.users), 'Users'), stat(String(a.ordersToday), 'Orders today'), stat(money(a.averageOrderValue), 'Avg order'));
  const byMod = h('div', { class: 'card card-pad', style: { marginTop: '16px' } }, h('h3', {}, 'Revenue by module'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Module'), h('th', {}, 'Orders'), h('th', {}, 'Revenue'))),
      ...a.byModule.map((m) => h('tr', {}, h('td', {}, m.module), h('td', {}, String(m.count)), h('td', {}, money(m.revenue)))))));
  return h('div', {}, stats, byMod);
}

async function orders() {
  const { orders } = await api.get('/admin/orders');
  const rows = orders.map((o) => h('tr', {}, h('td', {}, o.order_number), h('td', {}, o.module), h('td', {}, money(o.total)), h('td', {}, statusBadge(o.status)),
    h('td', {}, h('select', { class: 'select', style: { padding: '4px 8px' }, onchange: async (e) => { try { await api.post('/admin/orders/' + o.id + '/status', { status: e.target.value }); toast('Updated', 'success'); } catch (err) { toast(err.message, 'error'); } } },
      ...['PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((s) => h('option', { value: s, selected: s === o.status }, s))))));
  return card('Orders', h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Order'), h('th', {}, 'Module'), h('th', {}, 'Total'), h('th', {}, 'Status'), h('th', {}, 'Update'))), ...rows));
}

async function products() {
  const { items } = await api.get('/products', { limit: 100 });
  const rows = items.map((p) => h('tr', {}, h('td', {}, p.name), h('td', {}, p.module), h('td', {}, money(p.price)), h('td', {}, p.stock),
    h('td', {}, h('button', { class: 'btn btn-danger btn-sm', onclick: async () => { if (confirm('Deactivate ' + p.name + '?')) { try { await api.del('/admin/products/' + p.id); toast('Deactivated', 'success'); location.reload(); } catch (e) { toast(e.message, 'error'); } } } }, 'Deactivate'))));
  return card('Products', h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Module'), h('th', {}, 'Price'), h('th', {}, 'Stock'), h('th', {}, ''))), ...rows));
}

async function users() {
  const { users } = await api.get('/admin/users');
  const rows = users.map((u) => h('tr', {}, h('td', {}, u.name), h('td', {}, u.email || u.mobile), h('td', {}, u.role_id === 2 ? 'ADMIN' : 'USER'), h('td', {}, statusBadge(u.status))));
  return card('Users', h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Contact'), h('th', {}, 'Role'), h('th', {}, 'Status'))), ...rows));
}

async function payments() {
  const { payments } = await api.get('/admin/payments');
  const rows = payments.map((p) => h('tr', {}, h('td', {}, p.razorpay_order_id || '—'), h('td', {}, money(p.amount)), h('td', {}, p.status), h('td', {}, p.verified ? '✓' : '—')));
  return card('Payments', h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Razorpay order'), h('th', {}, 'Amount'), h('th', {}, 'Status'), h('th', {}, 'Verified'))), ...rows));
}

function stat(v, l) { return h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)); }
function card(title, ...body) { return h('div', { class: 'card card-pad' }, h('h3', {}, title), ...body); }
