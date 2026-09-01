import { h, money, toast, emptyState, productImage } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

const MODULES = [
  { key: 'shop', label: 'Shopping', href: 'shop' },
  { key: 'grocery', label: 'Grocery', href: 'grocery' },
];

export async function Cart() {
  const root = h('div', { class: 'container section' });
  root.append(h('h1', {}, 'Your cart'));
  if (!Store.isAuthed()) return renderGuest(root);
  return renderAuthed(root);
}

function renderAuthed(root) {
  let activeModule = 'shop';
  const q = location.hash.split('?')[1];
  if (q && q.includes('module=')) activeModule = new URLSearchParams(q).get('module') || 'shop';
  if (!MODULES.find((m) => m.key === activeModule)) activeModule = 'shop';

  const tabs = h('div', { class: 'tabs', style: { marginBottom: '20px' } });
  const list = h('div', { class: 'col gap-3' });
  const summaryBox = h('div', { class: 'card card-pad elevated', style: { position: 'sticky', top: 'calc(var(--nav-h) + 16px)' } });
  const main = h('div', { class: 'split' }, h('div', {}, tabs, list), h('div', {}, summaryBox));
  root.append(main);

  MODULES.forEach((m) => tabs.append(h('button', { class: 'tab' + (m.key === activeModule ? ' active' : ''), onclick: () => { activeModule = m.key; render(); } }, m.label)));

  const summary = api.get('/cart/summary').then((s) => { Store.setCart(s); return s; });

  async function render() {
    const s = await summary;
    MODULES.forEach((m, i) => tabs.children[i].classList.toggle('active', m.key === activeModule));
    const cart = s[activeModule];
    list.innerHTML = '';
    if (!cart || !cart.items.length) {
      list.append(emptyState({ icon: '🛒', title: 'Your ' + activeModule + ' cart is empty', desc: 'Browse and add items you love.', action: h('a', { class: 'btn btn-primary', href: '#/' + activeModule }, 'Browse ' + activeModule) }));
    } else {
      cart.items.forEach((it) => list.append(cartRow(it, cart.module)));
    }
    summaryBox.innerHTML = '';
    summaryBox.append(h('h3', {}, 'Summary'), h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', { class: 'fw-600' }, money(cart.subtotal))));
    const count = cart.items.reduce((a, b) => a + b.quantity, 0);
    summaryBox.append(h('p', { class: 'muted text-sm' }, count + ' item(s)'));
    summaryBox.append(h('div', { class: 'divider' }));
    summaryBox.append(h('button', { class: 'btn btn-primary btn-block btn-lg', disabled: !cart.items.length, onclick: () => { location.hash = '#/checkout?module=' + activeModule; } }, 'Proceed to checkout'));
    summaryBox.append(h('p', { class: 'muted text-xs center', style: { marginTop: '10px' } }, 'Secure payment via Razorpay. You won’t be charged until verification.'));
  }

  function cartRow(it, module) {
    const qty = h('input', { class: 'input', type: 'number', min: '1', value: String(it.quantity), style: { width: '70px' } });
    qty.addEventListener('change', async () => { await api.put('/cart/items/' + it.productId + '?module=' + module, { quantity: Math.max(1, Number(qty.value) || 1) }); await refreshCart(); render(); });
    return h('div', { class: 'card', style: { display: 'flex', gap: '16px', padding: '14px', alignItems: 'center' } },
      h('div', { class: 'product-thumb', style: { width: '72px', aspectRatio: '1/1', flexShrink: '0' } }, h('img', { class: 'product-img', src: it.image || productImage(it), alt: it.name })),
      h('div', { class: 'grow' }, h('a', { href: '#/product/' + it.slug, style: { fontWeight: '600', color: 'var(--ink-900)' } }, it.name), h('div', { class: 'muted text-sm' }, it.available ? 'In stock' : 'Unavailable'), h('div', {}, h('span', { class: 'price' }, money(it.price)), h('span', { class: 'strike text-sm', style: { marginLeft: '6px' } }, money(it.mrp)))),
      qty,
      h('div', { class: 'fw-600' }, money(it.lineTotal)),
      h('button', { class: 'icon-btn', title: 'Remove', onclick: async () => { await api.del('/cart/items/' + it.productId + '?module=' + module); await refreshCart(); render(); }, 'aria-label': 'Remove' }, '🗑'));
  }

  render();
  return root;
}

function renderGuest(root) {
  let activeModule = 'shop';
  const q = location.hash.split('?')[1];
  if (q && q.includes('module=')) activeModule = new URLSearchParams(q).get('module') || 'shop';
  if (!MODULES.find((m) => m.key === activeModule)) activeModule = 'shop';

  const guest = Store.getGuest().filter((i) => i.module === activeModule);
  const tabs = h('div', { class: 'tabs', style: { marginBottom: '20px' } });
  const list = h('div', { class: 'col gap-3' });
  const summaryBox = h('div', { class: 'card card-pad elevated' });
  const main = h('div', { class: 'split' }, h('div', {}, tabs, list), h('div', {}, summaryBox));
  root.append(
    h('div', { class: 'notice', style: { marginBottom: '16px' } }, 'You’re browsing as a guest. Items are saved on this device — sign in at checkout to pay.'),
    main);

  MODULES.forEach((m) => tabs.append(h('button', { class: 'tab' + (m.key === activeModule ? ' active' : ''), onclick: () => { activeModule = m.key; render(); } }, m.label)));

  function render() {
    MODULES.forEach((m, i) => tabs.children[i].classList.toggle('active', m.key === activeModule));
    const items = Store.getGuest().filter((i) => i.module === activeModule);
    list.innerHTML = '';
    if (!items.length) {
      list.append(emptyState({ icon: '🛒', title: 'Your ' + activeModule + ' cart is empty', desc: 'Browse and add items you love.', action: h('a', { class: 'btn btn-primary', href: '#/' + activeModule }, 'Browse ' + activeModule) }));
    } else {
      items.forEach((it) => list.append(guestRow(it)));
    }
    const subtotal = items.reduce((a, b) => a + b.price * b.quantity, 0);
    summaryBox.innerHTML = '';
    summaryBox.append(h('h3', {}, 'Summary'), h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', { class: 'fw-600' }, money(subtotal))));
    summaryBox.append(h('p', { class: 'muted text-sm' }, items.reduce((a, b) => a + b.quantity, 0) + ' item(s)'));
    summaryBox.append(h('div', { class: 'divider' }));
    summaryBox.append(h('a', { class: 'btn btn-primary btn-block btn-lg', href: '#/login' }, 'Sign in to checkout'));
  }

  function guestRow(it) {
    const qty = h('input', { class: 'input', type: 'number', min: '1', value: String(it.quantity), style: { width: '70px' } });
    qty.addEventListener('change', () => { Store.setGuestQty(it.productId, Math.max(1, Number(qty.value) || 1)); render(); });
    return h('div', { class: 'card', style: { display: 'flex', gap: '16px', padding: '14px', alignItems: 'center' } },
      h('div', { class: 'product-thumb', style: { width: '72px', aspectRatio: '1/1', flexShrink: '0' } }, h('img', { class: 'product-img', src: it.image || productImage(it), alt: it.name })),
      h('div', { class: 'grow' }, h('a', { href: '#/product/' + it.slug, style: { fontWeight: '600', color: 'var(--ink-900)' } }, it.name), h('div', {}, h('span', { class: 'price' }, money(it.price)), h('span', { class: 'strike text-sm', style: { marginLeft: '6px' } }, money(it.mrp)))),
      qty,
      h('div', { class: 'fw-600' }, money(it.price * it.quantity)),
      h('button', { class: 'icon-btn', title: 'Remove', onclick: () => { Store.removeGuestItem(it.productId); render(); }, 'aria-label': 'Remove' }, '🗑'));
  }

  render();
  return root;
}
