import { h, money, toast, emptyState, modal } from '../ui.js';
import { statusBadge } from './orders.js';
import { api } from '../api.js';
import { Store } from '../store.js';

export async function Admin() {
  const root = h('div', { class: 'container section' });
  const user = Store.getUser();
  if (!user || user.role !== 'ADMIN') { root.append(emptyState({ icon: '◐', title: 'Admin access only', desc: 'Sign in with an admin account.', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }

  const tabs = h('div', { class: 'tabs', style: { marginBottom: '20px', overflowX: 'auto' } },
    h('button', { class: 'tab active', 'data-t': 'overview' }, 'Overview'),
    h('button', { class: 'tab', 'data-t': 'orders' }, 'Orders'),
    h('button', { class: 'tab', 'data-t': 'production' }, 'Production'),
    h('button', { class: 'tab', 'data-t': 'custom' }, 'Custom'),
    h('button', { class: 'tab', 'data-t': 'products' }, 'Products'),
    h('button', { class: 'tab', 'data-t': 'users' }, 'Customers'));
  const panel = h('div', {}, skeletonPanel());
  root.append(h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' } }, 'ZUNO Admin'), tabs, panel);

  tabs.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('active')); t.classList.add('active'); load(t.dataset.t); }));

  async function load(t) {
    panel.innerHTML = ''; panel.append(skeletonPanel());
    try {
      if (t === 'overview') panel.append(await overview());
      if (t === 'orders') panel.append(await orders());
      if (t === 'production') panel.append(await productionQueue());
      if (t === 'custom') panel.append(await customOrders());
      if (t === 'products') panel.append(await products());
      if (t === 'users') panel.append(await users());
    } catch (e) { panel.innerHTML = ''; panel.append(emptyState({ icon: '◐', title: 'Failed', desc: e.message })); }
  }
  load('overview');
  return root;
}

function skeletonPanel() { return h('div', { class: 'row gap-4 wrap' }, ...Array.from({ length: 4 }, () => h('div', { class: 'stat skeleton', style: { width: '180px', height: '88px' } }))); }

async function overview() {
  const a = await api.get('/admin/analytics');
  const customCount = await api.get('/admin/custom-orders').then(r => r.orders.length).catch(() => 0);
  const stats = h('div', { class: 'row gap-4 wrap' },
    stat(a.revenue ? money(a.revenue) : '₹0', 'Revenue'),
    stat(String(a.totalOrders), 'Orders'),
    stat(String(customCount), 'Custom orders'),
    stat(String(a.users), 'Customers'),
    stat(String(a.ordersToday), 'Today'),
    stat(money(a.averageOrderValue), 'AOV'));
  const byMod = h('div', { class: 'card card-pad', style: { marginTop: '16px' } }, h('h3', {}, 'Revenue'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Module'), h('th', {}, 'Orders'), h('th', {}, 'Revenue'))),
      ...a.byModule.map((m) => h('tr', {}, h('td', {}, m.module), h('td', {}, String(m.count)), h('td', {}, money(m.revenue)))))));
  return h('div', {}, stats, byMod);
}

async function orders() {
  const search = h('input', { class: 'input', placeholder: 'Search order #, customer, mobile…', style: { maxWidth: '320px' } });
  const container = h('div', {});
  const tableWrap = h('div', { style: { overflowX: 'auto', marginTop: '12px' } });
  container.append(h('div', { class: 'row gap-3', style: { marginBottom: '12px' } }, search, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { search.value = ''; load(''); } }, 'Clear')));
  container.append(tableWrap);
  async function load(q = '') {
    tableWrap.innerHTML = 'Loading…';
    const { orders } = await api.get('/admin/orders' + (q ? '?q=' + encodeURIComponent(q) : ''));
    if (!orders.length) { tableWrap.innerHTML = ''; tableWrap.append(emptyState({ title: 'No orders' })); return; }
    const rows = orders.slice(0, 100).map((o) => h('tr', {},
      h('td', {}, h('a', { href: '#/admin/orders/' + o.id, style: { fontWeight: '700', color: 'var(--ink-900)' } }, o.order_number), h('div', { class: 'muted text-xs' }, (o.customer_name || '') + (o.customer_mobile ? ' · ' + o.customer_mobile : ''))),
      h('td', {}, money(o.total)),
      h('td', {}, statusBadge(o.status)),
      h('td', {}, new Date(o.created_at).toLocaleDateString('en-IN')),
      h('td', {}, h('select', { class: 'input', style: { padding: '6px 8px', fontSize: 'var(--fs-sm)' }, onchange: async (e) => { try { await api.post('/admin/orders/' + o.id + '/status', { status: e.target.value }); toast('Updated', 'success'); } catch (err) { toast(err.message, 'error'); } } },
        ...['PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'PROCESSING', 'PRINTING', 'QUALITY_CHECK', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((s) => h('option', { value: s, selected: s === o.status }, s))))));
    tableWrap.innerHTML = '';
    tableWrap.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Order / Customer'), h('th', {}, 'Total'), h('th', {}, 'Status'), h('th', {}, 'Date'), h('th', {}, 'Update'))), ...rows));
  }
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(search.value.trim()); });
  await load('');
  return card('Orders', container);
}

async function productionQueue() {
  const { orders } = await api.get('/admin/orders');
  const statuses = ['PAID', 'CONFIRMED', 'PRINTING', 'QUALITY_CHECK', 'PACKED', 'SHIPPED'];
  let filter = 'PAID';
  const wrap = h('div', {});
  const tabs = h('div', { class: 'row gap-2 wrap', style: { marginBottom: '16px' } },
    ...statuses.map(s => h('button', {
      class: 'btn btn-sm ' + (s === filter ? 'btn-primary' : 'btn-ghost'),
      onclick: () => { filter = s; render(); }
    }, s.replace(/_/g, ' '))));
  const list = h('div', { class: 'col gap-3' });
  wrap.append(h('h3', {}, 'Production Queue'), h('p', { class: 'muted text-sm' }, 'Quickly move orders through production. Custom orders are highlighted.'), tabs, list);
  async function render() {
    tabs.querySelectorAll('button').forEach(b => {
      const isActive = b.textContent.trim() === filter.replace(/_/g, ' ');
      b.className = 'btn btn-sm ' + (isActive ? 'btn-primary' : 'btn-ghost');
    });
    list.innerHTML = '';
    const filtered = orders.filter(o => o.status === filter);
    if (!filtered.length) { list.append(emptyState({ title: 'No orders in ' + filter.replace(/_/g, ' ') })); return; }
    for (const o of filtered.slice(0, 20)) {
      const row = h('div', { class: 'card card-pad', style: { display: 'flex', gap: '16px', alignItems: 'center' } },
        h('div', {}, h('div', { class: 'fw-600' }, o.order_number), h('div', { class: 'muted text-sm' }, new Date(o.created_at).toLocaleDateString('en-IN') + ' · ' + money(o.total))),
        h('div', { class: 'grow muted text-sm' }, o.customer_name || o.customer_email || ''),
        h('div', {}, statusBadge(o.status)),
        h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
          const nextMap = { PAID: 'CONFIRMED', CONFIRMED: 'PRINTING', PRINTING: 'QUALITY_CHECK', QUALITY_CHECK: 'PACKED', PACKED: 'SHIPPED', SHIPPED: 'OUT_FOR_DELIVERY' };
          const next = nextMap[o.status];
          if (!next) return;
          try { await api.post('/admin/orders/' + o.id + '/status', { status: next }); toast('Moved to ' + next, 'success'); o.status = next; render(); } catch (e) { toast(e.message, 'error'); }
        } }, '→ ' + ({ PAID: 'Confirm', CONFIRMED: 'Start Printing', PRINTING: 'Quality Check', QUALITY_CHECK: 'Pack', PACKED: 'Ship', SHIPPED: 'Deliver' }[filter] || 'Next')));
      list.append(row);
    }
  }
  render();
  return wrap;
}

async function customOrders() {
  const { orders } = await api.get('/admin/custom-orders');
  if (!orders.length) return emptyState({ icon: '✦', title: 'No custom orders', desc: 'Custom T-shirt orders will appear here.' });
  const wrap = h('div', { class: 'col gap-4' });
  orders.forEach((o) => {
    const items = o.items || [];
    wrap.append(h('div', { class: 'card card-pad' },
      h('div', { class: 'row between', style: { marginBottom: '12px' } },
        h('div', {}, h('div', { class: 'fw-600' }, o.order_number), h('div', { class: 'muted text-sm' }, new Date(o.created_at).toLocaleString('en-IN') + ' · ' + money(o.total))),
        statusBadge(o.status)),
      ...items.map((it) => {
        const variant = it.variant ? `${it.variant.color || ''} · ${it.variant.size || ''} ${it.variant.fit || ''}` : '';
        const cust = it.customization;
        return h('div', { class: 'row gap-3', style: { padding: '12px 0', borderTop: '1px solid var(--ink-100)', alignItems: 'flex-start' } },
          h('div', { style: { width: '80px', height: '80px', background: '#f5f5f3', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: '0' } }, '✦'),
          h('div', { class: 'grow' },
            h('div', { class: 'fw-600' }, it.name + (it.isCustom ? ' · Custom' : '')),
            variant ? h('div', { class: 'muted text-sm' }, variant) : null,
            cust ? h('div', { class: 'muted text-xs', style: { marginTop: '6px', background: 'var(--ink-50)', padding: '8px', borderRadius: '6px' } },
              h('div', {}, `Front: ${cust.front?.elements?.length || 0} elements`),
              h('div', {}, `Back: ${cust.back?.elements?.length || 0} elements`),
              cust.front?.elements?.filter(e => e.type === 'text').map(e => h('div', { style: { fontStyle: e.italic ? 'italic' : 'normal', fontWeight: e.bold ? '700' : '400', color: e.color || '#0a0a0a' } }, `"${e.value}"`))
            ) : null,
            h('div', { class: 'muted text-sm', style: { marginTop: '4px' } }, `${it.quantity} × ${money(it.price)}`)));
      }),
      h('div', { style: { marginTop: '12px' } },
        h('select', { class: 'input', style: { maxWidth: '200px' }, onchange: async (e) => { try { await api.post('/admin/orders/' + o.id + '/status', { status: e.target.value }); toast('Updated', 'success'); } catch (err) { toast(err.message, 'error'); } } },
          ...['PAID', 'CONFIRMED', 'PRINTING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(s => h('option', { value: s, selected: s === o.status }, s))))));
  });
  return card('Custom Orders', wrap);
}

async function products() {
  const { items } = await api.get('/products', { limit: 100 });
  const head = h('div', { class: 'row between', style: { marginBottom: '16px', alignItems: 'center' } },
    h('h3', { style: { margin: 0 } }, 'Products'),
    h('button', { class: 'btn btn-primary btn-sm', onclick: () => showAddProduct() }, '+ Add product'));
  const rows = items.map((p) => h('tr', {},
    h('td', {}, h('div', { class: 'fw-600' }, p.name), h('div', { class: 'muted text-xs' }, (p.collection || '') + (p.customizable ? ' · Customizable' : ''))),
    h('td', {}, (p.colors || []).join(', ') || '—'),
    h('td', {}, (p.sizes || []).join(', ') || '—'),
    h('td', {}, money(p.price)),
    h('td', {}, String(p.stock)),
    h('td', {}, h('button', { class: 'btn btn-ghost btn-sm', style: { color: 'var(--zuno-danger)' }, onclick: async () => { if (confirm('Deactivate ' + p.name + '?')) { await api.del('/admin/products/' + p.id); toast('Deactivated', 'success'); location.reload(); } } }, 'Deactivate'))));
  const table = h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Product'), h('th', {}, 'Colors'), h('th', {}, 'Sizes'), h('th', {}, 'Price'), h('th', {}, 'Stock'), h('th', {}, ''))), ...rows));
  return card('', head, table);
}

function showAddProduct() {
  const name = h('input', { class: 'input', placeholder: 'Product name — e.g. Zuno Essential Tee' });
  const price = h('input', { class: 'input', type: 'number', placeholder: 'Price in paise — e.g. 129900 for ₹1299' });
  const mrp = h('input', { class: 'input', type: 'number', placeholder: 'MRP in paise' });
  const stock = h('input', { class: 'input', type: 'number', placeholder: 'Stock' });
  const colors = h('input', { class: 'input', placeholder: 'Colors comma-separated — e.g. black,white,beige' });
  const sizes = h('input', { class: 'input', placeholder: 'Sizes — e.g. S,M,L,XL' });
  const catSel = h('select', { class: 'input' });
  // Load categories
  api.get('/categories', { module: 'shop' }).then(({ categories }) => {
    categories.forEach(c => {
      if (!c.parent_id) {
        catSel.append(h('option', { value: c.id }, c.name));
        (c.children || []).forEach(ch => catSel.append(h('option', { value: ch.id }, '— ' + ch.name)));
      }
    });
  });
  const content = h('div', {},
    h('h3', {}, 'Add product'),
    h('div', { class: 'col gap-3', style: { marginTop: '12px' } },
      h('div', { class: 'field' }, h('label', {}, 'Name'), name),
      h('div', { class: 'row gap-3' }, h('div', { class: 'field grow' }, h('label', {}, 'Price (paise)'), price), h('div', { class: 'field grow' }, h('label', {}, 'MRP'), mrp)),
      h('div', { class: 'field' }, h('label', {}, 'Stock'), stock),
      h('div', { class: 'field' }, h('label', {}, 'Category'), catSel),
      h('div', { class: 'field' }, h('label', {}, 'Colors'), colors),
      h('div', { class: 'field' }, h('label', {}, 'Sizes'), sizes),
      h('button', { class: 'btn btn-primary btn-block', onclick: async () => {
        try {
          await api.post('/admin/products', {
            name: name.value, categoryId: Number(catSel.value), price: Number(price.value), mrp: Number(mrp.value), stock: Number(stock.value),
            colors: colors.value.split(',').map(s => s.trim()).filter(Boolean),
            sizes: sizes.value.split(',').map(s => s.trim()).filter(Boolean),
          });
          toast('Product created', 'success'); location.reload();
        } catch (e) { toast(e.message, 'error'); }
      } }, 'Create product')));
  modal(content);
}

async function users() {
  const { users } = await api.get('/admin/users');
  const rows = users.map((u) => h('tr', {}, h('td', {}, u.name), h('td', {}, u.email || u.mobile), h('td', {}, u.role_id === 2 ? 'ADMIN' : 'USER'), h('td', {}, statusBadge(u.status))));
  return card('Customers', h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Contact'), h('th', {}, 'Role'), h('th', {}, 'Status'))), ...rows));
}

function stat(v, l) { return h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)); }
function card(title, ...body) { return h('div', { class: 'card card-pad' }, title ? h('h3', {}, title) : null, ...body); }
