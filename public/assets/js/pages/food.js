import { h, money, toast, emptyState, skeletonGrid } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { runPayment } from '../pay.js';

const FOOD_CART_KEY = 'ZUNO_food_cart';

function getFoodCart() { try { return JSON.parse(localStorage.getItem(FOOD_CART_KEY)) || []; } catch { return []; } }
function setFoodCart(c) { localStorage.setItem(FOOD_CART_KEY, JSON.stringify(c)); }

export async function Restaurants() {
  const root = h('div', { class: 'container section' });
  root.append(h('h1', {}, 'Food delivery'));
  const city = h('input', { class: 'input', placeholder: 'City (e.g. Mumbai)', value: 'Mumbai', style: { maxWidth: '280px', marginBottom: '16px' } });
  const grid = h('div', { class: 'grid grid-cards' });
  root.append(city, grid);
  grid.append(skeletonGrid(6));
  const load = async () => {
    try { const { items } = await api.get('/restaurants', { city: city.value || undefined, limit: 30 }); grid.innerHTML = '';
      if (!items.length) grid.append(emptyState({ icon: '🍴', title: 'No restaurants', desc: 'Try another city.' }));
      else grid.append(...items.map(RestaurantCard)); }
    catch (e) { grid.innerHTML = ''; grid.append(emptyState({ icon: '⚠️', title: 'Could not load', desc: e.message })); }
  };
  city.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
  load();
  return root;
}

export function RestaurantCard(r) {
  return h('a', { class: 'card', href: '#/food/' + r.slug, style: { textDecoration: 'none', color: 'inherit', display: 'block' } },
    h('div', { class: 'product-thumb', style: { aspectRatio: '16/9' } }, h('span', { style: { fontSize: '34px' } }, '🍴')),
    h('div', { class: 'product-body' },
      h('div', { class: 'product-name' }, r.name),
      h('div', { class: 'product-meta' }, (r.cuisine || '') + ' · ★ ' + (r.rating || '—')),
      h('div', { class: 'product-meta' }, money(r.delivery_fee) + ' delivery · ' + (r.eta_minutes || 30) + ' min')));
}

export async function Restaurant({ params }) {
  const root = h('div', { class: 'container section' });
  root.append(h('div', { class: 'sk-card skeleton', style: { height: '240px' } }));
  try {
    const { restaurant } = await api.get('/restaurants/' + params.slug);
    root.innerHTML = '';
    root.append(
      h('div', { class: 'card', style: { padding: '20px', marginBottom: '16px', display: 'flex', gap: '20px', alignItems: 'center' } },
        h('div', { class: 'product-thumb', style: { width: '96px', aspectRatio: '1/1' } }, '🍴'),
        h('div', {}, h('h1', { style: { margin: 0 } }, restaurant.name), h('div', { class: 'muted' }, (restaurant.cuisine || '') + ' · ★ ' + (restaurant.rating || '—')), h('div', { class: 'muted text-sm' }, money(restaurant.delivery_fee) + ' delivery · ' + (restaurant.eta_minutes || 30) + ' min'))));
    const menu = h('div', { class: 'col gap-3' });
    const cats = {};
    (restaurant.menu || []).forEach((m) => { (cats[m.category] = cats[m.category] || []).push(m); });
    Object.entries(cats).forEach(([cat, items]) => {
      menu.append(h('h3', { style: { marginTop: '12px' } }, cat));
      items.forEach((m) => menu.append(menuRow(restaurant.id, m)));
    });
    root.append(h('div', { class: 'split', style: { gridTemplateColumns: '1fr 320px', alignItems: 'start' } }, menu, FoodCartBox()));
  } catch (e) { root.innerHTML = ''; root.append(emptyState({ icon: '⚠️', title: 'Restaurant not found' })); }
  return root;
}

function menuRow(restaurantId, m) {
  return h('div', { class: 'card', style: { padding: '14px', display: 'flex', gap: '14px', alignItems: 'center' } },
    h('div', { class: 'grow' }, h('div', { class: 'fw-600' }, m.name), m.description && h('div', { class: 'muted text-sm' }, m.description), h('div', { style: { marginTop: '4px' } }, h('span', { class: 'price' }, money(m.price)))),
    h('button', { class: 'btn btn-primary btn-sm', onclick: () => addToFoodCart(restaurantId, m) }, 'Add'));
}

function addToFoodCart(restaurantId, m) {
  const cart = getFoodCart();
  const ex = cart.find((c) => c.itemId === m.id);
  if (ex) ex.quantity++; else cart.push({ restaurantId, itemId: m.id, name: m.name, price: m.price, quantity: 1 });
  setFoodCart(cart); toast('Added to food cart', 'success');
}

function FoodCartBox() {
  const cart = getFoodCart();
  const count = cart.reduce((a, b) => a + b.quantity, 0);
  const box = h('div', { class: 'card card-pad', style: { position: 'sticky', top: 'calc(var(--nav-h) + 16px)' } }, h('h3', {}, 'Food cart'), h('div', { class: 'muted text-sm' }, count + ' item(s)'));
  if (count) {
    cart.forEach((c) => box.append(h('div', { class: 'row between', style: { padding: '4px 0' } }, h('span', {}, c.quantity + '× ' + c.name), h('span', {}, money(c.price * c.quantity)))));
    box.append(h('button', { class: 'btn btn-primary btn-block', style: { marginTop: '10px' }, onclick: () => location.hash = '#/food/checkout' }, 'Checkout'));
  } else box.append(h('p', { class: 'muted text-sm' }, 'Your food cart is empty.'));
  return box;
}

export async function FoodCheckout() {
  const root = h('div', { class: 'container-narrow section' });
  const cart = getFoodCart();
  if (!cart.length) { root.append(emptyState({ icon: '🛒', title: 'Food cart empty', action: h('a', { class: 'btn btn-primary', href: '#/food' }, 'Browse food') })); return root; }
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in to order food', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }

  let addresses = await api.get('/users/addresses');
  let selected = addresses[0]?.id || null;
  const subtotal = cart.reduce((a, b) => a + b.price * b.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  const addrBox = h('div', { class: 'card card-pad', style: { marginBottom: '16px' } }, h('h3', {}, 'Address'),
    ...(addresses.length ? addresses.map((a) => h('label', { class: 'row gap-3', style: { padding: '10px', border: '1px solid ' + (a.id === selected ? 'var(--ZUNO-primary)' : 'var(--ink-200)'), borderRadius: 'var(--r-md)', marginBottom: '8px', cursor: 'pointer', background: a.id === selected ? 'var(--ZUNO-primary-50)' : 'transparent' } },
      h('input', { type: 'radio', name: 'fa', checked: a.id === selected, onchange: () => { selected = a.id; } }), h('div', {}, h('div', { class: 'fw-600' }, (a.label ? a.label + ' · ' : '') + a.line1), h('div', { class: 'muted text-sm' }, a.city + ' ' + a.pincode)))) : h('p', { class: 'muted' }, 'Add an address in your profile first.')));
  const sumBox = h('div', { class: 'card card-pad' }, h('h3', {}, 'Summary'),
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', {}, money(subtotal))),
    h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Tax'), h('span', {}, money(tax))),
    h('div', { class: 'divider' }), h('div', { class: 'row between' }, h('strong', {}, 'Total'), h('strong', {}, money(total))),
    h('button', { class: 'btn btn-primary btn-block btn-lg', style: { marginTop: '12px' }, onclick: pay }, 'Pay ' + money(total)));
  root.append(h('h1', {}, 'Food checkout'), h('div', { class: 'split' }, h('div', {}, addrBox, h('div', { class: 'card card-pad' }, h('h3', {}, 'Items'), ...cart.map((c) => h('div', { class: 'row between' }, h('span', {}, c.quantity + '× ' + c.name), h('span', {}, money(c.price * c.quantity)))))), h('div', {}, sumBox)));
  return root;

  async function pay() {
    if (!selected) { toast('Select an address', 'warning'); return; }
    const amount = Math.round((subtotal + tax) * 100);
    const onPay = async (oid, pid, sig) => {
      try {
        const order = await api.post('/orders/custom', { module: 'food', addressId: selected, items: cart.map((c) => ({ type: 'menu', id: c.itemId, quantity: c.quantity })) });
        const { razorpay } = await api.post('/payments/create', { orderId: order.orderId });
        oid = razorpay.orderId; pid = razorpay.paymentId; sig = razorpay.signature;
        await api.post('/payments/verify', { orderId: order.orderId, razorpayOrderId: oid, razorpayPaymentId: pid, razorpaySignature: sig });
        setFoodCart([]); toast('Order placed & paid', 'success'); location.hash = '#/orders/' + order.orderId;
      } catch (e) { toast(e.message, 'error'); }
    };
    try {
      if (Store.isRazorpayTestMode()) {
        await runPayment({ razorpay: { testMode: true, amount, currency: 'INR', orderId: null, paymentId: null, signature: null }, onSuccess: onPay, onDismiss: () => {} });
      } else {
        const order = await api.post('/orders/custom', { module: 'food', addressId: selected, items: cart.map((c) => ({ type: 'menu', id: c.itemId, quantity: c.quantity })) });
        const { razorpay } = await api.post('/payments/create', { orderId: order.orderId });
        await runPayment({ razorpay, onSuccess: (o, p, s) => onPay(o, p, s), onDismiss: () => {} });
      }
    } catch (e) { toast(e.message, 'error'); }
  }
}
