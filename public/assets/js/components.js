import { h, money, initials, productImage, toast } from './ui.js';
import { Store } from './store.js';
import { api } from './api.js';

const NAV = [
  { label: 'T-Shirts', href: '#/shop?category=t-shirts', key: 'tshirts' },
  { label: 'Shirts', href: '#/shop?category=shirts', key: 'shirts' },
  { label: 'New Arrivals', href: '#/shop?sort=newest', key: 'new' },
  { label: 'Custom Studio', href: '#/customize', key: 'custom', accent: true },
];

const MOBILE_NAV = [
  { label: 'Home', href: '#/', key: 'home', em: '◐' },
  { label: 'Shop', href: '#/shop', key: 'shop', em: '▭' },
  { label: 'Custom', href: '#/customize', key: 'custom', em: '✦' },
  { label: 'Wishlist', href: '#/wishlist', key: 'wishlist', em: '♡' },
  { label: 'Bag', href: '#/cart', key: 'cart', em: '◧' },
];

export function topBar(active) {
  const user = Store.getUser();
  const search = SearchBar();
  const cartCount = Store.cartCount();
  const wishCount = Store.wishlistCount ? Store.wishlistCount() : (Store._wishlist ? Store._wishlist.size : 0);

  const nav = h('nav', { class: 'nav-links', 'aria-label': 'Primary' },
    ...NAV.map((n) => h('a', { href: n.href, class: (active === n.key ? 'active' : '') + (n.accent ? ' accent-link' : '') }, n.label)));

  const actions = h('div', { class: 'nav-actions' },
    h('a', { class: 'icon-btn', href: '#/wishlist', title: 'Wishlist', 'aria-label': 'Wishlist' }, '♡', wishCount ? h('span', { class: 'cart-count', style: { background: '#0a0a0a' } }, String(wishCount)) : null),
    h('a', { class: 'icon-btn', href: '#/cart', title: 'Bag', 'aria-label': 'Bag' },
      '◧', cartCount ? h('span', { class: 'cart-count' }, String(cartCount)) : null),
    h('a', { class: 'icon-btn', href: '#/search', title: 'Search', 'aria-label': 'Search' }, '⌕'),
    user
      ? h('a', { class: 'avatar', href: '#/profile', title: user.name, style: { textDecoration: 'none', background: '#0a0a0a', color: '#fff' } }, initials(user.name))
      : h('a', { class: 'btn btn-primary btn-sm', href: '#/login', style: { background: '#0a0a0a', borderColor: '#0a0a0a', letterSpacing: '0.04em' } }, 'Sign in'));

  return h('header', { class: 'topbar' },
    h('div', { class: 'topbar-inner' },
      h('a', { class: 'brand', href: '#/', 'aria-label': 'Zuno home', style: { fontFamily: 'var(--font-display)', letterSpacing: '0.12em', fontWeight: '700' } },
        'ZUNO'),
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
          h('div', { class: 'brand', style: { color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' } }, 'ZUNO'),
          h('p', { class: 'muted', style: { maxWidth: '30ch', marginTop: '12px', lineHeight: '1.6' } }, 'Modern everyday clothing. Designed for people who don\'t follow the ordinary. Made in India, worn everywhere.'),
          h('div', { class: 'row gap-3', style: { marginTop: '16px' } },
            h('a', { href: 'https://instagram.com', target: '_blank', class: 'icon-btn', style: { color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }, title: 'Instagram' }, '◯'),
            h('a', { href: 'https://facebook.com', target: '_blank', class: 'icon-btn', style: { color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }, title: 'Facebook' }, '⬡'),
            h('a', { href: 'https://youtube.com', target: '_blank', class: 'icon-btn', style: { color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }, title: 'YouTube' }, '▷'))),
        footerCol('SHOP', [['T-Shirts', '#/shop?category=t-shirts'], ['Shirts', '#/shop?category=shirts'], ['New Arrivals', '#/shop?sort=newest'], ['Best Sellers', '#/shop?sort=popular'], ['Custom Studio', '#/customize']]),
        footerCol('HELP', [['Contact Us', '#/'], ['Shipping', '#/'], ['Returns', '#/'], ['Size Guide', '#/'], ['FAQs', '#/']]),
        footerCol('COMPANY', [['About Zuno', '#/'], ['Our Story', '#/'], ['Careers', '#/']]),
        footerCol('LEGAL', [['Privacy', '#/'], ['Terms', '#/'], ['Refund Policy', '#/']])),
      h('div', { class: 'divider', style: { background: '#262626', margin: '32px 0 20px' } }),
      h('div', { class: 'row between', style: { flexWrap: 'wrap', gap: '12px' } },
        h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' } }, '© ' + new Date().getFullYear() + ' ZUNO. All rights reserved.'),
        h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, 'Payments secured by Razorpay • Made with care in India'))));
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
  const input = h('input', { type: 'search', placeholder: 'Search for T-shirts, shirts, oversized…', 'aria-label': 'Search', autocomplete: 'off' });
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
