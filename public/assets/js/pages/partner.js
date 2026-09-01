import { h, money, toast, emptyState, errorState, modal } from '../ui.js';
import { statusBadge } from './orders.js';
import { api } from '../api.js';
import { Store } from '../store.js';

function guard(role) {
  const u = Store.getUser();
  if (!u || u.role !== role) {
    return h('div', { class: 'container section' }, emptyState({ icon: '🔒', title: 'Partner access only', desc: 'Sign in with a ' + role + ' account to view this dashboard.', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') }));
  }
  return null;
}
function stat(v, l) { return h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)); }
function card(title, ...body) { return h('div', { class: 'card card-pad', style: { marginBottom: '18px' } }, h('h3', {}, title), ...body); }

// ---------------- SELLER ----------------
export async function SellerDashboard() {
  const g = guard('SELLER'); if (g) return g;
  const root = h('div', { class: 'container section' });
  root.append(h('h1', {}, 'Seller dashboard'));
  const stats = h('div', { class: 'row gap-4 wrap' }, h('div', { class: 'skeleton', style: { width: '160px', height: '80px' } }));
  const productsCard = card('Your products', h('div', { class: 'skeleton', style: { height: '120px' } }), h('button', { class: 'btn btn-primary btn-sm', style: { marginTop: '10px' }, onclick: () => addProduct(root) }, '+ Add product'));
  const ordersCard = card('Recent orders');
  root.append(stats, productsCard, ordersCard);

  try {
    const [a, products, orders] = await Promise.all([api.get('/seller/analytics'), api.get('/seller/products'), api.get('/seller/orders')]);
    stats.innerHTML = '';
    stats.append(stat(money(a.revenue), 'Revenue'), stat(String(a.orders), 'Orders'), stat(String((a.topProducts || []).length), 'Top SKUs'));
    renderProducts(productsCard, products);
    renderSellerOrders(ordersCard, orders);
  } catch (e) { root.append(errorState(e.message)); }
  return root;
}
function renderProducts(cardEl, products) {
  cardEl.innerHTML = ''; cardEl.append(h('div', { class: 'row between' }, h('h3', {}, 'Your products'), h('button', { class: 'btn btn-primary btn-sm', onclick: () => addProduct(cardEl.closest('.container')) }, '+ Add product')));
  if (!products.length) { cardEl.append(emptyState({ icon: '📦', title: 'No products yet' })); return; }
  const rows = products.map((p) => h('tr', {}, h('td', {}, p.name), h('td', {}, money(p.price)), h('td', {}, String(p.stock)), h('td', {}, p.active ? '✓' : '—'),
    h('td', {}, h('button', { class: 'btn btn-danger btn-sm', onclick: async () => { if (confirm('Deactivate ' + p.name + '?')) { try { await api.del('/seller/products/' + p.id); toast('Deactivated', 'success'); location.reload(); } catch (e) { toast(e.message, 'error'); } } } }, 'Deactivate'))));
  cardEl.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Price'), h('th', {}, 'Stock'), h('th', {}, 'Live'), h('th', {}, ''))), ...rows));
}
function renderSellerOrders(cardEl, orders) {
  cardEl.innerHTML = ''; cardEl.append(h('h3', {}, 'Recent orders'));
  if (!orders.length) { cardEl.append(emptyState({ icon: '🧾', title: 'No orders yet' })); return; }
  const rows = orders.slice(0, 15).map((o) => h('tr', {}, h('td', {}, o.order_number), h('td', {}, o.module), h('td', {}, money(o.total)), h('td', {}, statusBadge(o.status))));
  cardEl.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Order'), h('th', {}, 'Module'), h('th', {}, 'Total'), h('th', {}, 'Status'))), ...rows));
}
async function addProduct(rootEl) {
  const cats = await api.get('/categories', { module: 'shop' }).catch(() => ({ categories: [] }));
  const flat = (cats.categories || []).filter((c) => !c.children || !c.children.length).map((c) => ({ id: c.id, name: c.name }));
  const name = h('input', { class: 'input', placeholder: 'Product name' });
  const price = h('input', { class: 'input', type: 'number', placeholder: 'Price (₹)' });
  const mrp = h('input', { class: 'input', type: 'number', placeholder: 'MRP (₹)' });
  const stock = h('input', { class: 'input', type: 'number', placeholder: 'Stock' });
  const cat = h('select', { class: 'select' }, ...flat.map((c) => h('option', { value: c.id }, c.name)));
  const form = h('div', {},
    h('div', { class: 'field' }, h('label', {}, 'Name'), name),
    h('div', { class: 'field' }, h('label', {}, 'Category'), cat),
    h('div', { class: 'field' }, h('label', {}, 'Price (₹)'), price),
    h('div', { class: 'field' }, h('label', {}, 'MRP (₹)'), mrp),
    h('div', { class: 'field' }, h('label', {}, 'Stock'), stock),
    h('button', { class: 'btn btn-primary btn-block', onclick: submit }, 'Create product'));
  modal(form);
  async function submit() {
    try {
      await api.post('/seller/products', { name: name.value.trim(), price: Math.round(Number(price.value) * 100), mrp: Math.round(Number(mrp.value || price.value) * 100), stock: Number(stock.value) || 0, categoryId: Number(cat.value) });
      toast('Product created', 'success'); location.reload();
    } catch (e) { toast(e.message, 'error'); }
  }
}

// ---------------- RESTAURANT ----------------
export async function RestaurantDashboard() {
  const g = guard('RESTAURANT'); if (g) return g;
  const root = h('div', { class: 'container section' });
  root.append(h('h1', {}, 'Restaurant dashboard'));
  const menuCard = card('Menu', h('button', { class: 'btn btn-primary btn-sm', onclick: () => addMenuItem(root) }, '+ Add item'));
  const ordersCard = card('Food orders');
  root.append(menuCard, ordersCard);
  try {
    const [menu, orders] = await Promise.all([api.get('/restaurant-admin/menu'), api.get('/restaurant-admin/orders')]);
    renderMenu(menuCard, menu);
    renderFoodOrders(ordersCard, orders);
  } catch (e) { root.append(errorState(e.message)); }
  return root;
}
function renderMenu(cardEl, items) {
  cardEl.innerHTML = ''; cardEl.append(h('div', { class: 'row between' }, h('h3', {}, 'Menu'), h('button', { class: 'btn btn-primary btn-sm', onclick: () => addMenuItem(cardEl.closest('.container')) }, '+ Add item')));
  if (!items.length) { cardEl.append(emptyState({ icon: '🍽️', title: 'No menu items' })); return; }
  const rows = items.map((m) => h('tr', {}, h('td', {}, m.name), h('td', {}, m.category), h('td', {}, money(m.price)), h('td', {}, m.available ? '✓' : '—'),
    h('td', {}, h('button', { class: 'btn btn-danger btn-sm', onclick: async () => { if (confirm('Delete ' + m.name + '?')) { try { await api.del('/restaurant-admin/menu/' + m.id); toast('Deleted', 'success'); location.reload(); } catch (e) { toast(e.message, 'error'); } } } }, 'Delete'))));
  cardEl.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Category'), h('th', {}, 'Price'), h('th', {}, 'Live'), h('th', {}, ''))), ...rows));
}
function renderFoodOrders(cardEl, orders) {
  cardEl.innerHTML = ''; cardEl.append(h('h3', {}, 'Food orders'));
  if (!orders.length) { cardEl.append(emptyState({ icon: '🧾', title: 'No orders yet' })); return; }
  const rows = orders.slice(0, 20).map((o) => h('tr', {}, h('td', {}, o.order_number), h('td', {}, money(o.total)), h('td', {}, statusBadge(o.status)), h('td', {}, o.created_at)));
  cardEl.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Order'), h('th', {}, 'Total'), h('th', {}, 'Status'), h('th', {}, 'Placed'))), ...rows));
}
async function addMenuItem(rootEl) {
  const name = h('input', { class: 'input', placeholder: 'Dish name' });
  const cat = h('input', { class: 'input', placeholder: 'Category (e.g. Starters)' });
  const price = h('input', { class: 'input', type: 'number', placeholder: 'Price (₹)' });
  const desc = h('input', { class: 'input', placeholder: 'Description' });
  const form = h('div', {}, h('div', { class: 'field' }, h('label', {}, 'Name'), name), h('div', { class: 'field' }, h('label', {}, 'Category'), cat), h('div', { class: 'field' }, h('label', {}, 'Price (₹)'), price), h('div', { class: 'field' }, h('label', {}, 'Description'), desc), h('button', { class: 'btn btn-primary btn-block', onclick: submit }, 'Add item'));
  modal(form);
  async function submit() {
    try { await api.post('/restaurant-admin/menu', { name: name.value.trim(), category: cat.value.trim() || 'Main', price: Math.round(Number(price.value) * 100), description: desc.value.trim() }); toast('Item added', 'success'); location.reload(); }
    catch (e) { toast(e.message, 'error'); }
  }
}

// ---------------- SERVICE PROVIDER ----------------
export async function ProviderDashboard() {
  const g = guard('SERVICE_PROVIDER'); if (g) return g;
  const root = h('div', { class: 'container section' });
  root.append(h('h1', {}, 'Service provider dashboard'));
  const svcCard = card('Your services', h('button', { class: 'btn btn-primary btn-sm', onclick: () => addService(root) }, '+ Add service'));
  const bookCard = card('Bookings');
  root.append(svcCard, bookCard);
  try {
    const [services, bookings] = await Promise.all([api.get('/provider-admin/services'), api.get('/provider-admin/bookings')]);
    renderServices(svcCard, services);
    renderBookings(bookCard, bookings);
  } catch (e) { root.append(errorState(e.message)); }
  return root;
}
function renderServices(cardEl, items) {
  cardEl.innerHTML = ''; cardEl.append(h('div', { class: 'row between' }, h('h3', {}, 'Your services'), h('button', { class: 'btn btn-primary btn-sm', onclick: () => addService(cardEl.closest('.container')) }, '+ Add service')));
  if (!items.length) { cardEl.append(emptyState({ icon: '🔧', title: 'No services' })); return; }
  const rows = items.map((s) => h('tr', {}, h('td', {}, s.name), h('td', {}, s.category), h('td', {}, money(s.price)), h('td', {}, s.duration_minutes + ' min'),
    h('td', {}, h('button', { class: 'btn btn-danger btn-sm', onclick: async () => { if (confirm('Delete ' + s.name + '?')) { try { await api.del('/provider-admin/services/' + s.id); toast('Deleted', 'success'); location.reload(); } catch (e) { toast(e.message, 'error'); } } } }, 'Delete'))));
  cardEl.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Category'), h('th', {}, 'Price'), h('th', {}, 'Duration'), h('th', {}, ''))), ...rows));
}
function renderBookings(cardEl, bookings) {
  cardEl.innerHTML = ''; cardEl.append(h('h3', {}, 'Bookings'));
  if (!bookings.length) { cardEl.append(emptyState({ icon: '📅', title: 'No bookings yet' })); return; }
  const rows = bookings.slice(0, 20).map((b) => h('tr', {}, h('td', {}, b.service_name), h('td', {}, b.customer), h('td', {}, (b.scheduled_date || '') + ' ' + (b.scheduled_time || '')), h('td', {}, statusBadge(b.status)),
    h('td', {}, h('select', { class: 'select', style: { padding: '4px 8px' }, onchange: async (e) => { try { await api.put('/provider-admin/bookings/' + b.id + '/status', { status: e.target.value }); toast('Updated', 'success'); } catch (err) { toast(err.message, 'error'); } } }, ...['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => h('option', { value: s, selected: s === b.status }, s))))));
  cardEl.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Service'), h('th', {}, 'Customer'), h('th', {}, 'When'), h('th', {}, 'Status'), h('th', {}, 'Update'))), ...rows));
}
async function addService(rootEl) {
  const name = h('input', { class: 'input', placeholder: 'Service name' });
  const cat = h('input', { class: 'input', placeholder: 'Category' });
  const price = h('input', { class: 'input', type: 'number', placeholder: 'Price (₹)' });
  const dur = h('input', { class: 'input', type: 'number', placeholder: 'Duration (minutes)', value: '60' });
  const form = h('div', {}, h('div', { class: 'field' }, h('label', {}, 'Name'), name), h('div', { class: 'field' }, h('label', {}, 'Category'), cat), h('div', { class: 'field' }, h('label', {}, 'Price (₹)'), price), h('div', { class: 'field' }, h('label', {}, 'Duration (min)'), dur), h('button', { class: 'btn btn-primary btn-block', onclick: submit }, 'Add service'));
  modal(form);
  async function submit() {
    try { await api.post('/provider-admin/services', { name: name.value.trim(), category: cat.value.trim(), price: Math.round(Number(price.value) * 100), duration_minutes: Number(dur.value) || 60 }); toast('Service added', 'success'); location.reload(); }
    catch (e) { toast(e.message, 'error'); }
  }
}
