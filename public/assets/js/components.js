import { h, money, initials, productImage, toast } from './ui.js';
import { Store } from './store.js';
import { api } from './api.js';

const NAV = [
  { label: 'Men', href: '#/shop?category=oversized', key: 'men' },
  { label: 'Women', href: '#/shop?category=graphic', key: 'women' },
  { label: 'Sneakers', href: '#/shop?collection=Street%20Form', key: 'sneakers' },
  { label: 'Accessories', href: '#/shop?collection=Essentials', key: 'accessories' },
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

  // Build navigation links - add Founder Dashboard if user is ADMIN
  const navLinks = [...NAV];
  if (user && user.role === 'ADMIN') {
    navLinks.push({ 
      label: '⚡ Founder Dashboard', 
      href: '#/admin', 
      key: 'admin',
      accent: false,
      isAdmin: true 
    });
  }

  const nav = h('nav', { class: 'nav-links', 'aria-label': 'Primary' },
    ...navLinks.map((n) => h('a', { 
      href: n.href, 
      class: (active === n.key ? 'active' : '') + (n.accent ? ' accent-link' : '') + (n.isAdmin ? ' admin-link' : ''),
      style: n.isAdmin ? { 
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
        color: '#fbbf24', 
        padding: '8px 16px', 
        borderRadius: '6px',
        fontWeight: '700',
        border: '2px solid #fbbf24'
      } : {}
    }, n.label)));

  // Cart drawer
  const cartDrawer = h('div', { class: 'drawer', style: { position: 'fixed', inset: 0, zIndex: '200', pointerEvents: 'none' } },
    h('div', { class: 'drawer__backdrop', style: { position: 'absolute', inset: 0, background: 'rgba(28,37,65,0.4)', opacity: '0', transition: 'opacity 0.2s ease-in' }, onclick: closeCart }),
    h('div', { class: 'drawer__panel', style: { position: 'absolute', top: 0, right: 0, height: '100%', width: 'min(420px, 92vw)', background: 'var(--pure-white)', display: 'flex', flexDirection: 'column', transform: 'translateX(100%)', transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 8px 32px rgba(28,37,65,0.12)' } },
      h('div', { style: { padding: '20px', borderBottom: '1px solid var(--light-indigo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('h3', { style: { margin: 0, fontFamily: 'var(--font-display)' } }, 'Your Bag'),
        h('button', { class: 'icon-btn', onclick: closeCart, 'aria-label': 'Close cart' }, '✕')),
      h('div', { class: 'drawer__items', style: { flex: '1', overflowY: 'auto', padding: '20px' } }, 'Loading…'),
      h('div', { style: { padding: '20px', borderTop: '1px solid var(--light-indigo)' } },
        h('div', { class: 'drawer__total', style: { display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontWeight: '700' } }, h('span', {}, 'Subtotal'), h('span', { id: 'drawer-subtotal' }, '—')),
        h('a', { href: '#/cart', class: 'btn', style: { display: 'block', width: '100%', background: 'var(--primary-denim)', color: 'var(--pure-white)', textAlign: 'center', padding: '14px', borderRadius: '999px', fontWeight: '700', letterSpacing: '0.04em', textDecoration: 'none', transition: 'background 0.2s ease-in' }, onmouseenter: (e) => e.target.style.background = 'var(--secondary-wash)', onmouseleave: (e) => e.target.style.background = 'var(--primary-denim)', onclick: closeCart }, 'PROCEED TO CHECKOUT'))));
  function openCart() {
    cartDrawer.style.pointerEvents = 'auto';
    cartDrawer.querySelector('.drawer__backdrop').style.opacity = '1';
    cartDrawer.querySelector('.drawer__panel').style.transform = 'translateX(0)';
    loadCartDrawer();
  }
  function closeCart() {
    cartDrawer.querySelector('.drawer__backdrop').style.opacity = '0';
    cartDrawer.querySelector('.drawer__panel').style.transform = 'translateX(100%)';
    setTimeout(() => cartDrawer.style.pointerEvents = 'none', 320);
  }
  async function loadCartDrawer() {
    const itemsEl = cartDrawer.querySelector('.drawer__items');
    const subEl = cartDrawer.querySelector('#drawer-subtotal');
    try {
      if (!Store.isAuthed()) {
        const guest = Store.getGuest();
        if (!guest.length) { itemsEl.innerHTML = '<p class="muted">Your bag is empty</p>'; subEl.textContent = '₹0'; return; }
        itemsEl.innerHTML = guest.map(it => `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--light-indigo)"><img src="${it.image || ''}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;background:var(--light-indigo)"><div><div style="font-weight:600">${it.name}</div><div style="font-size:12px;color:var(--text-muted)">Qty ${it.quantity}</div><div style="font-weight:700">₹${(it.price/100).toFixed(0)}</div></div></div>`).join('');
        const total = guest.reduce((s, i) => s + i.price * i.quantity, 0);
        subEl.textContent = '₹' + (total/100).toFixed(0);
        return;
      }
      const s = await api.get('/cart/summary');
      const items = s.shop?.items || [];
      if (!items.length) { itemsEl.innerHTML = '<p class="muted">Your bag is empty</p>'; subEl.textContent = '₹0'; return; }
      itemsEl.innerHTML = items.map(it => `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--light-indigo)"><img src="${it.image || ''}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;background:var(--light-indigo)"><div><div style="font-weight:600">${it.name}</div><div style="font-size:12px;color:var(--text-muted)">${it.variant ? it.variant.color + ' · ' + it.variant.size : ''} · Qty ${it.quantity}</div><div style="font-weight:700">₹${(it.price/100).toFixed(0)}</div></div></div>`).join('');
      subEl.textContent = '₹' + ((s.shop.subtotal || 0)/100).toFixed(0);
    } catch { itemsEl.innerHTML = '<p class="muted">Could not load bag</p>'; }
  }
  // Hamburger menu
  const hamburgerMenu = h('div', { class: 'hamburger-menu', style: { position: 'fixed', inset: 0, zIndex: '150', pointerEvents: 'none', display: 'flex' } },
    h('div', { style: { flex: 1, background: 'rgba(28,37,65,0.4)', opacity: '0', transition: 'opacity 0.2s ease-in' }, onclick: closeHamburger }),
    h('div', { style: { width: '280px', background: 'var(--pure-white)', height: '100%', transform: 'translateX(-100%)', transition: 'transform 0.32s ease', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('span', { style: { fontWeight: '800', letterSpacing: '0.12em', color: 'var(--dark-charcoal)' } }, 'ZUNO'), h('button', { class: 'icon-btn', onclick: closeHamburger, 'aria-label': 'Close menu' }, '✕')),
      h('nav', { style: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' } },
        ...NAV.map(n => h('a', { href: n.href, style: { padding: '12px', fontWeight: '600', borderBottom: '1px solid var(--light-indigo)', textDecoration: 'none', color: 'var(--dark-charcoal)' }, onclick: closeHamburger }, n.label)))));
  function openHamburger() {
    hamburgerMenu.style.pointerEvents = 'auto';
    hamburgerMenu.children[0].style.opacity = '1';
    hamburgerMenu.children[1].style.transform = 'translateX(0)';
  }
  function closeHamburger() {
    hamburgerMenu.children[0].style.opacity = '0';
    hamburgerMenu.children[1].style.transform = 'translateX(-100%)';
    setTimeout(() => hamburgerMenu.style.pointerEvents = 'none', 320);
  }

  const actions = h('div', { class: 'nav-actions' },
    h('a', { class: 'icon-btn', href: '#/wishlist', title: 'Wishlist', 'aria-label': 'Wishlist' }, '♡', wishCount ? h('span', { class: 'cart-count', style: { background: 'var(--primary-denim)' } }, String(wishCount)) : null),
    h('button', { class: 'icon-btn', title: 'Bag', 'aria-label': 'Bag', onclick: openCart },
      '◧', cartCount ? h('span', { class: 'cart-count' }, String(cartCount)) : null),
    h('a', { class: 'icon-btn', href: '#/search', title: 'Search', 'aria-label': 'Search' }, '⌕'),
    user
      ? h('a', { class: 'avatar', href: '#/profile', title: user.name, style: { textDecoration: 'none', background: 'var(--primary-denim)', color: '#fff' } }, initials(user.name))
      : h('a', { class: 'btn btn-primary btn-sm', href: '#/login', style: { background: 'var(--primary-denim)', borderColor: 'var(--primary-denim)', letterSpacing: '0.04em' } }, 'Sign in'),
    h('button', { class: 'icon-btn hamburger', 'aria-label': 'Open menu', onclick: openHamburger, style: { display: 'none' } }, '☰'),
    cartDrawer, hamburgerMenu);

  const announcement = h('div', { style: { background: '#0a0a0a', color: '#fff', textAlign: 'center', padding: '8px 16px', fontSize: 'var(--fs-xs)', letterSpacing: '0.08em', fontWeight: '600' } },
    'FREE SHIPPING ON ORDERS OVER ₹999  •  EASY 7-DAY RETURNS  •  MADE IN INDIA');

  const categoryBar = h('div', { class: 'category-bar', style: { background: '#fff', borderTop: '1px solid var(--ink-100)', borderBottom: '1px solid var(--ink-100)', overflowX: 'auto', scrollbarWidth: 'none' } },
    h('div', { class: 'container', style: { display: 'flex', gap: '24px', padding: '12px 20px', whiteSpace: 'nowrap', alignItems: 'center' } },
      h('a', { href: '#/shop', style: { fontWeight: '700', color: 'var(--ink-900)', fontSize: 'var(--fs-sm)', textDecoration: 'none', borderBottom: active === 'shop' ? '2px solid #0a0a0a' : 'none', paddingBottom: '2px' } }, 'All T-shirts'),
      h('a', { href: '#/shop?category=oversized', style: { color: 'var(--ink-700)', fontSize: 'var(--fs-sm)', textDecoration: 'none' } }, 'Oversized'),
      h('a', { href: '#/shop?category=graphic', style: { color: 'var(--ink-700)', fontSize: 'var(--fs-sm)', textDecoration: 'none' } }, 'Graphic'),
      h('a', { href: '#/shop?category=plain', style: { color: 'var(--ink-700)', fontSize: 'var(--fs-sm)', textDecoration: 'none' } }, 'Plain'),
      h('a', { href: '#/shop?category=polo', style: { color: 'var(--ink-700)', fontSize: 'var(--fs-sm)', textDecoration: 'none' } }, 'Polo'),
      h('a', { href: '#/shop?collection=Essentials', style: { color: 'var(--ink-700)', fontSize: 'var(--fs-sm)', textDecoration: 'none' } }, 'Essentials'),
      h('a', { href: '#/shop?collection=Street%20Form', style: { color: 'var(--ink-700)', fontSize: 'var(--fs-sm)', textDecoration: 'none' } }, 'Street Form'),
      h('a', { href: '#/customize', style: { color: '#0a0a0a', fontWeight: '700', fontSize: 'var(--fs-sm)', textDecoration: 'none', background: 'var(--ink-50)', padding: '6px 12px', borderRadius: '20px' } }, '✦ Custom')));

  return h('header', { class: 'topbar' },
    announcement,
    h('div', { class: 'topbar-inner' },
      h('a', { class: 'brand', href: '#/', 'aria-label': 'ZUNO home', style: { fontFamily: 'var(--font-display)', letterSpacing: '0.12em', fontWeight: '700', fontSize: '22px' } },
        'ZUNO'),
      nav,
      search,
      actions),
    categoryBar);
}

export function bottomNav(active) {
  const cartCount = Store.cartCount();
  const user = Store.getUser();
  
  // Add admin link to mobile nav if user is ADMIN
  const mobileLinks = [...MOBILE_NAV];
  if (user && user.role === 'ADMIN') {
    mobileLinks.push({ 
      label: 'Founder', 
      href: '#/admin', 
      key: 'admin', 
      em: '⚡' 
    });
  }
  
  return h('nav', { class: 'bottom-nav', 'aria-label': 'Mobile' },
    ...mobileLinks.map((n) => h('a', { 
      href: n.href, 
      class: active === n.key ? 'active' : '',
      style: n.key === 'admin' ? { color: '#fbbf24', fontWeight: '700' } : {}
    },
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
        footerCol('SHOP', [['All T-shirts', '#/shop'], ['New Drops', '#/shop?sort=newest'], ['Best Sellers', '#/shop?sort=popular'], ['Custom T-shirts', '#/customize']]),
        footerCol('HELP', [['Contact Us', '#/'], ['Shipping', '#/'], ['Returns', '#/'], ['Size Guide', '#/'], ['FAQs', '#/']]),
        footerCol('COMPANY', [['About ZUNO', '#/'], ['Our Story', '#/'], ['Careers', '#/']]),
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
  const isNew = p.newArrival;
  const isBestseller = p.ratingCount > 200;
  const img = p.images && p.images[0] ? p.images[0] : productImage(p);
  const img2 = p.images && p.images[1] ? p.images[1] : null;
  const wished = Store.isWished(p.id);
  const heart = h('button', { class: 'wish-btn' + (wished ? ' active' : ''), type: 'button', title: 'Save to wishlist', 'aria-label': 'Save to wishlist', onclick: async (e) => {
    e.preventDefault(); e.stopPropagation();
    await Store.toggleWish(p.id);
    heart.classList.toggle('active', Store.isWished(p.id));
    heart.style.transform = 'scale(1.2)'; setTimeout(() => heart.style.transform = '', 180);
  } }, '♡');
  // Update heart text based on wished
  if (wished) heart.textContent = '♥';

  const badge = discounted ? h('span', { class: 'product-badge' }, p.discountPercent + '% OFF') : isNew ? h('span', { class: 'product-badge', style: { background: '#0a0a0a' } }, 'NEW') : isBestseller ? h('span', { class: 'product-badge', style: { background: '#c9a96e', color: '#fff' } }, 'BESTSELLER') : null;

  const quickAdd = h('button', { class: 'quick-add', type: 'button', onclick: async (e) => {
    e.preventDefault(); e.stopPropagation();
    const variant = p.colors && p.sizes ? { color: p.colors[0], size: p.sizes[1] || p.sizes[0] } : null;
    const payload = variant ? { productId: p.id, quantity: 1, variant } : { productId: p.id, quantity: 1 };
    if (Store.isAuthed()) {
      try { await api.post('/cart/items?module=shop', payload); await refreshCart(); toast('Added to bag', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    } else {
      Store.addGuestItem({ productId: p.id, name: p.name, price: p.price, mrp: p.mrp, slug: p.slug, image: img, module: 'shop', quantity: 1, variant });
      toast('Added to bag', 'success');
    }
  } }, 'Add to bag');

  const thumb = h('div', { class: 'product-thumb' },
    badge, heart,
    h('img', { class: 'product-img', src: img, alt: p.name, loading: 'lazy' }),
    img2 ? h('img', { class: 'product-img-hover', src: img2, alt: p.name, loading: 'lazy' }) : null,
    quickAdd);

  const colors = (p.colors || []).slice(0, 4);
  const colorDots = colors.length > 1 ? h('div', { class: 'row gap-1', style: { marginTop: '6px' } },
    ...colors.map(c => h('span', { class: 'color-dot', style: { background: c === 'white' ? '#fff' : c, borderColor: c === 'white' ? '#e5e5e5' : c, width: '12px', height: '12px', borderRadius: '50%', border: '1px solid var(--ink-200)', display: 'inline-block' }, title: c }))) : null;

  const priceRow = h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' } },
    h('span', { class: 'price', style: { fontSize: 'var(--fs-md)', fontWeight: '800' } }, money(p.price)),
    discounted ? h('span', { class: 'strike text-xs' }, money(p.mrp)) : null);

  const body = h('div', { class: 'product-body', style: { padding: '12px' } },
    h('div', { class: 'muted text-xs', style: { letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '700', color: 'var(--ink-500)' } }, 'ZUNO'),
    h('div', { class: 'product-name', style: { fontSize: 'var(--fs-sm)', fontWeight: '600', lineHeight: '1.3', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, p.name),
    h('div', { class: 'product-meta', style: { fontSize: 'var(--fs-xs)', marginTop: '4px' } }, '★ ' + (p.rating || '—') + ' · ' + (p.ratingCount || 0)),
    priceRow,
    colorDots);

  return h('a', { class: 'product-card', href: '#/product/' + p.slug, style: { textDecoration: 'none', color: 'inherit', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--ink-100)', display: 'flex', flexDirection: 'column' } }, thumb, body);
}

export async function refreshCart() {
  if (!Store.isAuthed()) return;
  try { Store.setCart(await api.get('/cart/summary')); } catch { /* ignore */ }
}

export function moneyPaisetoINR(p) { return money(p); }
