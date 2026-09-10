import { h, money, initials, productImage, toast } from './ui.js';
import { Store } from './store.js';
import { api } from './api.js';

const NAV = [
  { label: 'T-Shirts', href: '#/shop', key: 'shop' },
  { label: 'Oversized', href: '#/shop?category=oversized', key: 'oversized' },
  { label: 'Graphic', href: '#/shop?category=graphic', key: 'graphic' },
  { label: 'Polo', href: '#/shop?category=polo', key: 'polo' },
  { label: 'New Arrivals', href: '#/shop?sort=newest', key: 'new' },
  { label: 'Custom Studio', href: '#/customize', key: 'custom' },
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

  // Cart drawer — right-side slide-over (Denim spec: 0.2s ease-in CTA)
  const cartDrawer = h('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mini cart', style: { position: 'fixed', inset: 0, zIndex: '200', pointerEvents: 'none' } },
    h('div', { class: 'drawer__backdrop', style: { position: 'absolute', inset: 0, background: 'rgba(28,37,65,0.4)', opacity: '0', transition: 'opacity 0.2s ease-in' }, onclick: closeCart }),
    h('div', { class: 'drawer__panel', style: { position: 'absolute', top: 0, right: 0, height: '100%', width: 'min(420px, 92vw)', background: 'var(--pure-white)', display: 'flex', flexDirection: 'column', transform: 'translateX(100%)', transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1)', boxShadow: '-8px 0 32px rgba(28,37,65,0.12)' } },
      h('div', { style: { padding: '20px', borderBottom: '1px solid var(--light-indigo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('h3', { style: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '-0.02em' } }, 'Your Bag'),
        h('button', { class: 'icon-btn', onclick: closeCart, 'aria-label': 'Close cart' }, '✕')),
      h('div', { class: 'drawer__items', style: { flex: '1', overflowY: 'auto', padding: '20px' } }, 'Loading…'),
      h('div', { style: { padding: '20px', borderTop: '1px solid var(--light-indigo)', background: 'var(--pure-white)' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' } },
          h('div', { class: 'drawer__total', style: { display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: 'var(--fs-md)' } }, h('span', {}, 'Subtotal'), h('span', { id: 'drawer-subtotal' }, '—')),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--ink-500)' } }, h('span', {}, 'Shipping'), h('span', {}, 'Calculated at checkout')),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--ink-500)' } }, h('span', {}, 'Estimated total'), h('span', { id: 'drawer-total', style: { fontWeight: '700', color: 'var(--dark-charcoal)' } }, '—'))
        ),
        h('a', { href: '#/cart', class: 'btn-checkout', style: { display: 'block', width: '100%', background: 'var(--primary-denim)', color: 'var(--pure-white)', textAlign: 'center', padding: '14px', borderRadius: '999px', fontWeight: '800', letterSpacing: '0.04em', textDecoration: 'none', transition: 'background 0.2s ease-in' }, onmouseenter: (e) => e.target.style.background = 'var(--secondary-wash)', onmouseleave: (e) => e.target.style.background = 'var(--primary-denim)', onclick: closeCart, 'aria-label': 'Proceed to checkout' }, 'PROCEED TO CHECKOUT'),
        h('p', { style: { textAlign: 'center', fontSize: '11px', color: 'var(--ink-500)', marginTop: '10px', marginBottom: '0' } }, 'Free shipping over ₹999 • 7-day returns'))));
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
    const totalEl = cartDrawer.querySelector('#drawer-total');
    try {
      if (!Store.isAuthed()) {
        const guest = Store.getGuest();
        if (!guest.length) { itemsEl.innerHTML = '<p class="muted">Your bag is empty — add a tee to get started.</p>'; subEl.textContent = '₹0'; if (totalEl) totalEl.textContent = '₹0'; return; }
        itemsEl.innerHTML = guest.map(it => `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--light-indigo)"><img src="${it.image || ''}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;background:var(--light-indigo)"><div><div style="font-weight:700;color:var(--dark-charcoal)">${it.name}</div><div style="font-size:12px;color:var(--ink-500)">${it.variant ? it.variant.color + ' · ' + it.variant.size + ' · ' : ''}Qty ${it.quantity}</div><div style="font-weight:800;color:var(--secondary-wash)">₹${(it.price/100).toFixed(0)}</div></div></div>`).join('');
        const total = guest.reduce((s, i) => s + i.price * i.quantity, 0);
        const fmt = '₹' + (total/100).toFixed(0);
        subEl.textContent = fmt; if (totalEl) totalEl.textContent = fmt;
        return;
      }
      const s = await api.get('/cart/summary');
      const items = s.shop?.items || [];
      if (!items.length) { itemsEl.innerHTML = '<p class="muted">Your bag is empty</p>'; subEl.textContent = '₹0'; if (totalEl) totalEl.textContent = '₹0'; return; }
      itemsEl.innerHTML = items.map(it => `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--light-indigo)"><img src="${it.image || ''}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;background:var(--light-indigo)"><div><div style="font-weight:700;color:var(--dark-charcoal)">${it.name}</div><div style="font-size:12px;color:var(--ink-500)">${it.variant ? it.variant.color + ' · ' + it.variant.size + ' · ' : ''}Qty ${it.quantity}</div><div style="font-weight:800;color:var(--secondary-wash)">₹${(it.price/100).toFixed(0)}</div></div></div>`).join('');
      const fmt2 = '₹' + ((s.shop.subtotal || 0)/100).toFixed(0);
      subEl.textContent = fmt2; if (totalEl) totalEl.textContent = fmt2;
    } catch { itemsEl.innerHTML = '<p class="muted">Could not load bag</p>'; }
  }
  const actions = h('div', { class: 'nav-actions' },
    h('a', { class: 'icon-btn', href: '#/wishlist', title: 'Wishlist', 'aria-label': 'Wishlist' }, '♡', wishCount ? h('span', { class: 'cart-count', style: { background: 'var(--primary-denim)' } }, String(wishCount)) : null),
    h('button', { class: 'icon-btn', title: 'Bag', 'aria-label': 'Bag', onclick: openCart },
      '◧', cartCount ? h('span', { class: 'cart-count' }, String(cartCount)) : null),
    h('a', { class: 'icon-btn', href: '#/search', title: 'Search', 'aria-label': 'Search' }, '⌕'),
    user
      ? h('a', { class: 'avatar', href: '#/profile', title: user.name, style: { textDecoration: 'none', background: 'var(--primary-denim)', color: '#fff' } }, initials(user.name))
      : h('a', { class: 'btn btn-primary btn-sm', href: '#/login', style: { background: 'var(--primary-denim)', borderColor: 'var(--primary-denim)', letterSpacing: '0.04em' } }, 'Sign in'),
    cartDrawer);

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

function SearchBar() {
  const input = h('input', { type: 'search', placeholder: 'Search for T-shirts, oversized, graphic…', 'aria-label': 'Search', autocomplete: 'off' });
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
  const heart = h('button', { class: 'wish-btn' + (wished ? ' active' : ''), type: 'button', title: wished ? 'Remove from wishlist' : 'Add to wishlist', 'aria-label': wished ? 'Remove from wishlist' : 'Add to wishlist', 'aria-pressed': wished ? 'true' : 'false', onclick: async (e) => {
    e.preventDefault(); e.stopPropagation();
    await Store.toggleWish(p.id);
    const now = Store.isWished(p.id);
    heart.classList.toggle('active', now);
    heart.textContent = now ? '♥' : '♡';
    heart.setAttribute('aria-label', now ? 'Remove from wishlist' : 'Add to wishlist');
    heart.setAttribute('aria-pressed', now ? 'true' : 'false');
    heart.style.transform = 'scale(1.2)'; setTimeout(() => heart.style.transform = '', 180);
  } }, wished ? '♥' : '♡');

  const badge = discounted ? h('span', { class: 'product-badge' }, p.discountPercent + '% OFF') : isNew ? h('span', { class: 'product-badge', style: { background: 'var(--dark-charcoal)' } }, 'NEW') : isBestseller ? h('span', { class: 'product-badge', style: { background: 'var(--secondary-wash)' } }, 'BESTSELLER') : null;

  // ── Quick Add Size panel — slides up on hover (Denim spec) ──
  const SIZES = ['S', 'M', 'L', 'XL'];
  let selectedSize = null;
  const pills = SIZES.map(sz => h('button', {
    class: 'size-pill',
    type: 'button',
    'aria-label': 'Select size ' + sz,
    onclick: async (e) => {
      e.preventDefault(); e.stopPropagation();
      // toggle selected visual
      selectedSize = sz;
      panel.querySelectorAll('.size-pill').forEach(el => el.classList.toggle('selected', el.textContent === sz));
      // add to cart with selected size
      const variant = { color: (p.colors && p.colors[0]) || 'black', size: sz };
      if (Store.isAuthed()) {
        try { await api.post('/cart/items?module=shop', { productId: p.id, quantity: 1, variant }); await refreshCart(); toast('Added size ' + sz + ' to bag', 'success'); }
        catch (err) { toast(err.message, 'error'); }
      } else {
        Store.addGuestItem({ productId: p.id, name: p.name, price: p.price, mrp: p.mrp, slug: p.slug, image: img, module: 'shop', quantity: 1, variant });
        toast('Added size ' + sz + ' to bag', 'success');
      }
    }
  }, sz));

  const panel = h('div', { class: 'quick-add-panel', 'aria-hidden': 'false' },
    h('span', { class: 'quick-add-panel__label' }, 'Quick Add'),
    h('div', { class: 'quick-add-panel__pills' }, ...pills)
  );

  const thumb = h('div', { class: 'product-thumb' },
    badge, heart,
    h('img', { class: 'product-img', src: img, alt: p.name, loading: 'lazy' }),
    img2 ? h('img', { class: 'product-img-hover', src: img2, alt: p.name, loading: 'lazy' }) : null,
    panel);

  // Body — bold title, subtle category subtext, price (mrp crossed + discounted in secondary-wash)
  const categoryLabel = p.category || p.collection || 'ZUNO';
  const priceRow = h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px', flexWrap: 'wrap' } },
    // Discounted price in secondary-wash per spec
    h('span', { class: 'discount-price', style: { fontSize: 'var(--fs-md)' } }, money(p.price)),
    discounted ? h('span', { class: 'strike text-xs' }, money(p.mrp)) : null,
    discounted ? h('span', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--secondary-wash)' } }, p.discountPercent + '% OFF') : null
  );

  const body = h('div', { class: 'product-body', style: { padding: '12px' } },
    h('div', { class: 'product-name', style: { fontSize: 'var(--fs-sm)', fontWeight: '700', lineHeight: '1.3' } }, p.name),
    h('div', { class: 'product-meta' }, String(categoryLabel).toUpperCase()),
    h('div', { class: 'product-meta', style: { fontSize: '11px', marginTop: '2px' } }, '★ ' + (p.rating || '—') + ' · ' + (p.ratingCount || 0)),
    priceRow
  );

  return h('a', { class: 'product-card', href: '#/product/' + p.slug, 'aria-label': p.name, style: { textDecoration: 'none', color: 'inherit', background: 'var(--pure-white)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--light-indigo)', display: 'flex', flexDirection: 'column' } }, thumb, body);
}

export async function refreshCart() {
  if (!Store.isAuthed()) return;
  try { Store.setCart(await api.get('/cart/summary')); } catch { /* ignore */ }
}

export function moneyPaisetoINR(p) { return money(p); }
