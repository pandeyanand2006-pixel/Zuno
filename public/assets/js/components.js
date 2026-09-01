import { h, money, initials, productImage, toast } from './ui.js';
import { Store } from './store.js';
import { api } from './api.js';

const NAV = [
  { label: 'Home', href: '#/', key: 'home' },
  { label: 'Shop', href: '#/shop', key: 'shop' },
  { label: 'Grocery', href: '#/grocery', key: 'grocery' },
  { label: 'Food', href: '#/food', key: 'food' },
  { label: 'Services', href: '#/services', key: 'services' },
];

const MOBILE_NAV = [
  { label: 'Home', href: '#/', key: 'home', em: '🏠' },
  { label: 'Explore', href: '#/shop', key: 'explore', em: '🧭' },
  { label: 'Orders', href: '#/orders', key: 'orders', em: '📦' },
  { label: 'Cart', href: '#/cart', key: 'cart', em: '🛒' },
  { label: 'You', href: '#/profile', key: 'profile', em: '👤' },
];

export function topBar(active) {
  const user = Store.getUser();
  const search = SearchBar();
  const cartCount = Store.cartCount();

  const nav = h('nav', { class: 'nav-links', 'aria-label': 'Primary' },
    ...NAV.map((n) => h('a', { href: n.href, class: active === n.key ? 'active' : '' }, n.label)));

  const actions = h('div', { class: 'nav-actions' },
    h('button', { class: 'icon-btn', title: 'Toggle theme', onclick: () => Store.toggleTheme(), 'aria-label': 'Toggle theme' }, themeIcon()),
    h('a', { class: 'icon-btn', href: '#/notifications', title: 'Notifications', 'aria-label': 'Notifications' }, '🔔'),
    h('a', { class: 'icon-btn', href: '#/cart', title: 'Cart', 'aria-label': 'Cart' },
      '🛒', cartCount ? h('span', { class: 'cart-count' }, String(cartCount)) : null),
    user
      ? h('a', { class: 'avatar', href: '#/profile', title: user.name, style: { textDecoration: 'none' } }, initials(user.name))
      : h('a', { class: 'btn btn-primary btn-sm', href: '#/login' }, 'Sign in'));

  return h('header', { class: 'topbar' },
    h('div', { class: 'topbar-inner' },
      h('a', { class: 'brand', href: '#/', 'aria-label': 'Zuno home' },
        h('span', { class: 'logo' }, 'Z'), h('span', {}, 'Zuno')),
      nav,
      search,
      actions));
}

export function bottomNav(active) {
  const cartCount = Store.cartCount();
  return h('nav', { class: 'bottom-nav', 'aria-label': 'Mobile' },
    ...MOBILE_NAV.map((n) => h('a', { href: n.href, class: active === n.key ? 'active' : '' },
      h('span', { class: 'em' }, n.em),
      n.key === 'cart' && cartCount ? h('span', { class: 'cart-count' }, String(cartCount)) : null,
      h('span', {}, n.label))));
}

export function footer() {
  return h('footer', { class: 'footer' },
    h('div', { class: 'container' },
      h('div', { class: 'footer-grid' },
        h('div', {},
          h('div', { class: 'brand', style: { color: '#fff' } }, h('span', { class: 'logo' }, 'Z'), 'Zuno'),
          h('p', { class: 'muted', style: { maxWidth: '32ch', marginTop: '12px' } }, 'One app for everyday life. Shop, groceries, food, services and payments — brought together in a single trusted experience.')),
        footerCol('Company', [['About', '#/'], ['Careers', '#/'], ['Newsroom', '#/'], ['Policies', '#/']]),
        footerCol('Modules', [['Shop', '#/shop'], ['Grocery', '#/grocery'], ['Food', '#/food'], ['Services', '#/services']]),
        footerCol('Support', [['Help center', '#/'], ['Contact', '#/'], ['Safety', '#/'], ['Refunds', '#/']]),
        footerCol('Legal', [['Terms', '#/'], ['Privacy', '#/'], ['Cookies', '#/'], ['GST', '#/']])),
      h('div', { class: 'divider', style: { background: '#1e293b' } }),
      h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, '© ' + new Date().getFullYear() + ' Zuno. A demonstration super-app. Not affiliated with any existing brand. Payments powered by Razorpay.')));
}

function footerCol(title, links) {
  return h('div', {},
    h('h4', {}, title),
    ...links.map(([label, href]) => h('div', { style: { marginBottom: '8px' } }, h('a', { href }, label))));
}

function themeIcon() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
}

function SearchBar() {
  const input = h('input', { type: 'search', placeholder: 'Search for products, food, services…', 'aria-label': 'Search', autocomplete: 'off' });
  const box = h('div', { class: 'search-suggest hide' });
  const wrap = h('div', { class: 'searchbar' },
    h('span', { class: 's-ic' }, '🔍'), input, box);

  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim();
    if (q.length < 2) { box.classList.add('hide'); return; }
    t = setTimeout(async () => {
      try {
        const { suggestions } = await api.get('/products/suggestions', { q, limit: 8 });
        box.innerHTML = '';
        if (!suggestions.length) { box.classList.add('hide'); return; }
        suggestions.forEach((s) => {
          box.append(h('button', { type: 'button', onclick: () => { location.hash = '#/product/' + s.slug; box.classList.add('hide'); input.value = ''; } },
            h('span', {}, s.label), h('span', { class: 'muted text-xs' }, ' · ' + s.module)));
        });
        box.classList.remove('hide');
      } catch { box.classList.add('hide'); }
    }, 220);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const q = input.value.trim(); if (q) location.hash = '#/search?q=' + encodeURIComponent(q); box.classList.add('hide'); }
  });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) box.classList.remove('hide'); });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) box.classList.add('hide'); });
  return wrap;
}

export function ProductCard(p) {
  const discounted = p.discountPercent > 0;
  const img = p.images && p.images[0] ? p.images[0] : productImage(p);
  const wished = Store.isWished(p.id);
  const heart = h('button', { class: 'wish-btn' + (wished ? ' active' : ''), type: 'button', title: 'Save to wishlist', 'aria-label': 'Save to wishlist', onclick: async (e) => {
    e.preventDefault(); e.stopPropagation();
    await Store.toggleWish(p.id);
    heart.classList.toggle('active', Store.isWished(p.id));
  } }, '♥');
  const thumb = h('div', { class: 'product-thumb' },
    discounted && h('span', { class: 'product-badge' }, p.discountPercent + '% OFF'),
    heart,
    h('img', { class: 'product-img', src: img, alt: p.name, loading: 'lazy' }));
  const priceRow = h('div', {},
    h('span', { class: 'price' }, money(p.price)),
    discounted && h('span', { class: 'strike text-sm', style: { marginLeft: '6px' } }, money(p.mrp)));
  const addBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (Store.isAuthed()) {
      try { await api.post('/cart/items?module=' + (p.module || 'shop'), { productId: p.id, quantity: 1 }); await refreshCart(); toast('Added to cart', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    } else {
      Store.addGuestItem({ productId: p.id, name: p.name, price: p.price, mrp: p.mrp, slug: p.slug, image: img, module: p.module || 'shop', quantity: 1 });
      toast('Added to cart', 'success');
    }
  } }, 'Add');
  const foot = h('div', { class: 'product-foot' }, priceRow, addBtn);
  const body = h('div', { class: 'product-body' },
    h('div', { class: 'product-name' }, p.name),
    h('div', { class: 'product-meta' }, '★ ' + (p.rating || '—') + ' · ' + (p.ratingCount || 0) + ' ratings'),
    foot);
  return h('a', { class: 'product-card', href: '#/product/' + p.slug, style: { textDecoration: 'none', color: 'inherit' } }, thumb, body);
}

export async function refreshCart() {
  if (!Store.isAuthed()) return;
  try { Store.setCart(await api.get('/cart/summary')); } catch { /* ignore */ }
}

export function moneyPaisetoINR(p) { return money(p); }
