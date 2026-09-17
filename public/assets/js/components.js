import { h, money, initials, productImage, resolveImageUrl, imgFallback, toast } from './ui.js';
import { Store } from './store.js';
import { api } from './api.js';

const NAV = [
  { label: 'T-Shirts', href: '#/shop', key: 'shop' },
  { label: 'Oversized', href: '#/shop?category=oversized', key: 'oversized' },
  { label: 'Graphic', href: '#/shop?category=graphic', key: 'graphic' },
  { label: 'Polo', href: '#/shop?category=polo', key: 'polo' },
  { label: 'New Arrivals', href: '#/shop?sort=newest', key: 'new' },
  { label: 'Custom', href: '#/custom', key: 'custom' },
];

const MOBILE_NAV = [
  { label: 'Home', href: '#/', key: 'home', icon: 'home' },
  { label: 'Shop', href: '#/shop', key: 'shop', icon: 'shop' },
  { label: 'Custom', href: '#/custom', key: 'custom', icon: 'custom' },
  { label: 'Orders', href: '#/orders', key: 'orders', icon: 'orders' },
  { label: 'Bag', href: '#/cart', key: 'cart', icon: 'bag' },
];

function navIcon(type, size=20){
  const base = { width: String(size), height: String(size), viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':'1.9', 'stroke-linecap':'round', 'stroke-linejoin':'round', style:'display:block', 'aria-hidden':'true' };
  if(type==='home') return h('svg', base, h('path', { d:'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z' }));
  if(type==='shop') return h('svg', base, h('rect', { x:'3', y:'3', width:'7', height:'7', rx:'1' }), h('rect', { x:'14', y:'3', width:'7', height:'7', rx:'1' }), h('rect', { x:'3', y:'14', width:'7', height:'7', rx:'1' }), h('rect', { x:'14', y:'14', width:'7', height:'7', rx:'1' }));
  if(type==='custom') return h('svg', base, h('path', { d:'M12 2l1.7 5.3H19l-4.3 3.1 1.6 5.3L12 12.6 7.7 15.7l1.6-5.3L5 7.3h5.3L12 2z' }));
  if(type==='orders') return h('svg', base, h('path', { d:'M21 8.5l-9-5-9 5 9 5 9-5z' }), h('path', { d:'M3 8.5v7l9 5 9-5v-7' }), h('path', { d:'M12 13.5v7' }));
  if(type==='bag') return h('svg', base, h('path', { d:'M6 7h12l-1 11a2 2 0 01-2 1.8H9a2 2 0 01-2-1.8L6 7z' }), h('path', { d:'M9 7V5a3 3 0 016 0v2' }));
  if(type==='heart') return h('svg', base, h('path', { d:'M12 21s-6-4.3-6-9a3.5 3.5 0 016-2.5A3.5 3.5 0 0118 12c0 4.7-6 9-6 9z' }));
  if(type==='search') return h('svg', base, h('circle', { cx:'11', cy:'11', r:'6' }), h('path', { d:'M15.5 15.5L20 20' }));
  return h('svg', base, h('circle', { cx:'12', cy:'12', r:'7' }));
}

export function topBar(active) {
  const user = Store.getUser();
  const search = SearchBar();
  const cartCount = Store.cartCount();
  const wishCount = Store.wishlistCount ? Store.wishlistCount() : (Store._wishlist ? Store._wishlist.size : 0);

  const nav = h('nav', { class: 'nav-links', 'aria-label': 'Primary' },
    ...NAV.map((n) => h('a', { 
      href: n.href, 
      class: active === n.key ? 'active' : '',
    }, n.label)));

  const isAdmin = user && user.role === 'ADMIN';
  // Premium top icons — SVG outline (advanced/beautiful), balanced spacing, high contrast on dark
  const topIconBtnStyle = { background:'rgba(245,247,240,0.08)', borderColor:'rgba(245,247,240,0.14)', color:'rgb(245,247,240)', width:'40px', height:'40px', borderRadius:'10px', display:'grid', placeItems:'center', transition:'all 0.2s ease' };
  const actions = h('div', { class: 'nav-actions' },
    isAdmin ? h('a', { class: 'btn btn-ghost btn-sm', href: '#/admin', style:{background:'#fff', color:'#0f172a', fontWeight:'800', letterSpacing:'0.06em', border:'0.67px solid #cbc6c6', borderRadius:'999px', padding:'8px 14px'} }, 'Admin') : null,
    h('a', { class: 'icon-btn', href: '#/wishlist', title: 'Wishlist', 'aria-label': 'Wishlist', style: topIconBtnStyle, onmouseenter:(e)=>{ e.currentTarget.style.background='rgba(245,247,240,0.16)'; e.currentTarget.style.transform='translateY(-1px)'; }, onmouseleave:(e)=>{ e.currentTarget.style.background='rgba(245,247,240,0.08)'; e.currentTarget.style.transform=''; } }, navIcon('heart',18), wishCount ? h('span', { class: 'cart-count', style: { background: '#fff', color:'#0f172a', border:'1.5px solid #0f172a', fontWeight:'800' } }, String(wishCount)) : null),
    h('a', { class: 'icon-btn', href: '#/cart', title: 'Bag', 'aria-label': 'Bag', style: topIconBtnStyle, onmouseenter:(e)=>{ e.currentTarget.style.background='rgba(245,247,240,0.16)'; e.currentTarget.style.transform='translateY(-1px)'; }, onmouseleave:(e)=>{ e.currentTarget.style.background='rgba(245,247,240,0.08)'; e.currentTarget.style.transform=''; } },
      navIcon('bag',18), cartCount ? h('span', { class: 'cart-count', style:{background:'#fff', color:'#0f172a', border:'1.5px solid #0f172a', fontWeight:'800'} }, String(cartCount)) : null),
    h('a', { class: 'icon-btn', href: '#/search', title: 'Search', 'aria-label': 'Search', style: topIconBtnStyle, onmouseenter:(e)=>{ e.currentTarget.style.background='rgba(245,247,240,0.16)'; e.currentTarget.style.transform='translateY(-1px)'; }, onmouseleave:(e)=>{ e.currentTarget.style.background='rgba(245,247,240,0.08)'; e.currentTarget.style.transform=''; } }, navIcon('search',18)),
    user
      ? h('a', { class: 'avatar', href: '#/profile', title: user.name, style: { textDecoration: 'none', background: '#fff', color: '#0f172a', border:'1.5px solid rgba(245,247,240,0.3)', boxShadow:'0 2px 10px rgba(0,0,0,0.16)', fontWeight:'800' } }, initials(user.name))
      : h('a', { class: 'btn btn-primary', href: '#/login', style: { background: '#fff', color:'#0f172a', border:'0.67px solid #fff', borderRadius:'999px', padding:'10px 18px', fontWeight:'800', letterSpacing:'0.05em', fontFamily:'"Source Sans Pro", sans-serif', textTransform:'uppercase', fontSize:'13px', boxShadow:'0 4px 12px rgba(0,0,0,0.16)', transition:'all 0.2s ease' }, onmouseenter:(e)=>{ e.currentTarget.style.background='rgb(245,247,240)'; e.currentTarget.style.transform='translateY(-1px)'; }, onmouseleave:(e)=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.transform=''; } }, 'Sign in'));

  // ── "E" element fix — hamburger is now a functional navigation drawer (not decorative)
  // Provides useful ZUNO navigation: Shop, Studio, Orders, etc. with hover/focus feedback.
  function openNavDrawer() {
    const existing = document.querySelector('.zuno-drawer');
    if (existing) existing.remove();
    const close = () => { d.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    function onKey(e){ if(e.key==='Escape') close(); }
    const link = (href, label, sub) => h('a', { href, style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', borderRadius:'10px', textDecoration:'none', color:'#0f172a', background:'#fff', border:'1px solid #e2e8f0', fontWeight:'700', fontSize:'14px' }, onclick: () => close() }, h('span', {}, label), h('span', { style:{fontSize:'11px', color:'#64748b', fontWeight:'600'} }, sub || '→'));
    const sheet = h('div', { style: { background:'#fff', borderRadius:'16px', padding:'16px', display:'flex', flexDirection:'column', gap:'10px', maxWidth:'420px', width:'min(92vw,420px)', maxHeight:'86vh', overflowY:'auto', boxShadow:'0 20px 50px rgba(0,0,0,0.3)', position:'relative' } },
      h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'} },
        h('div', { style:{fontFamily:'Manrope, sans-serif', fontWeight:'800', letterSpacing:'0.12em', fontSize:'18px', color:'#0f172a'} }, 'ZUNO'),
        h('button', { type:'button', 'aria-label':'Close menu', style:{width:'36px', height:'36px', borderRadius:'50%', border:'1px solid #e2e8f0', background:'#f8fafc', display:'grid', placeItems:'center', cursor:'pointer'}, onclick: close }, '✕')),
      h('div', { style:{fontSize:'11px', letterSpacing:'0.14em', color:'#64748b', fontWeight:'700', marginBottom:'2px'} }, 'EXPLORE ZUNO'),
      link('#/shop', 'Shop T-Shirts', 'All drops'),
      link('#/shop?category=oversized', 'Oversized', 'Street form'),
      link('#/shop?category=graphic', 'Graphic', 'Bold prints'),
      link('#/custom', 'Custom — Customized T-Shirts', '✦'),
      link('#/orders', 'Orders & Tracking', '📦'),
      link('#/wishlist', 'Wishlist', '♡'),
      link('#/cart', 'Bag', '◧'),
      h('div', { style:{display:'flex', gap:'8px', marginTop:'6px'} },
        h('a', { href:'#/login', style:{flex:'1', textAlign:'center', padding:'12px', borderRadius:'999px', background:'#0f172a', color:'#fff', fontWeight:'800', textDecoration:'none'}, onclick: () => close() }, 'Sign in'),
        h('a', { href:'#/shop?sort=newest', style:{flex:'1', textAlign:'center', padding:'12px', borderRadius:'999px', background:'#f1f5f9', color:'#0f172a', fontWeight:'700', textDecoration:'none', border:'1px solid #e2e8f0'}, onclick: () => close() }, 'New Drops')),
      h('div', { style:{marginTop:'6px', padding:'10px 12px', borderRadius:'10px', background:'#f8fafc', border:'1px solid #e2e8f0', fontSize:'11px', color:'#64748b', lineHeight:'1.5'} }, 'Wear your attitude — Heavyweight 240 GSM • Made in India'));
    const d = h('div', { class: 'overlay zuno-drawer', style:{background:'rgba(15,23,42,0.55)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'} }, sheet);
    d.addEventListener('click', (e)=>{ if(e.target===d) close(); });
    document.getElementById('overlay-root').append(d);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    // focus close button for accessibility
    requestAnimationFrame(()=>{ const btn = sheet.querySelector('button'); if(btn) btn.focus(); });
  }
  const hamburger = h('button', { class: 'hamburger', type: 'button', 'aria-label': 'Open navigation menu', 'aria-haspopup': 'dialog', style: { color: 'rgb(245,247,240)', borderColor: 'rgba(245,247,240,0.15)', transition:'background 0.2s ease, border-color 0.2s ease, transform 0.2s ease' },
    onmouseenter: (e)=>{ e.currentTarget.style.background='rgba(245,247,240,0.08)'; e.currentTarget.style.borderColor='rgba(245,247,240,0.28)'; },
    onmouseleave: (e)=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(245,247,240,0.15)'; },
    onfocus: (e)=>{ e.currentTarget.style.outline='2px solid #fff'; e.currentTarget.style.outlineOffset='2px'; },
    onblur: (e)=>{ e.currentTarget.style.outline=''; },
    onclick: (e) => { e.preventDefault(); openNavDrawer(); } }, h('span', { style: { fontSize: '20px', lineHeight: '1' } }, '☰'));

  const announcement = h('div', { style: { background: '#0a0a0a', color: '#fff', textAlign: 'center', padding: '8px 16px', fontSize: 'var(--fs-xs)', letterSpacing: '0.08em', fontWeight: '600' } },
    'FREE SHIPPING ON ORDERS OVER ₹999  •  EASY 7-DAY RETURNS  •  MADE IN INDIA');

  const categoryBar = h('div', { class: 'category-bar', style: { background: 'rgb(245,247,240)', borderTop: '1px solid #dde3ef', borderBottom: '1px solid #dde3ef' } },
    h('div', { class: 'category-bar__track' },
      h('a', { href: '#/shop', style: { fontWeight: '700', color: 'rgb(16,20,29)', fontSize: '13px', textDecoration: 'none', borderBottom: active === 'shop' ? '2px solid #0a0a0a' : 'none', paddingBottom: '2px', flex: '0 0 auto' } }, 'All T-shirts'),
      h('a', { href: '#/shop?category=oversized', style: { color: '#23395d', fontSize: '13px', textDecoration: 'none', flex: '0 0 auto' } }, 'Oversized'),
      h('a', { href: '#/shop?category=graphic', style: { color: '#23395d', fontSize: '13px', textDecoration: 'none', flex: '0 0 auto' } }, 'Graphic'),
      h('a', { href: '#/shop?category=plain', style: { color: '#23395d', fontSize: '13px', textDecoration: 'none', flex: '0 0 auto' } }, 'Plain'),
      h('a', { href: '#/shop?category=polo', style: { color: '#23395d', fontSize: '13px', textDecoration: 'none', flex: '0 0 auto' } }, 'Polo'),
      h('a', { href: '#/shop?collection=Essentials', style: { color: '#23395d', fontSize: '13px', textDecoration: 'none', flex: '0 0 auto' } }, 'Essentials'),
      h('a', { href: '#/shop?collection=Street%20Form', style: { color: '#23395d', fontSize: '13px', textDecoration: 'none', flex: '0 0 auto' } }, 'Street Form'),
      h('a', { href: '#/custom', style: { color: 'rgb(245,247,240)', fontWeight: '700', fontSize: '12px', textDecoration: 'none', background: 'rgb(16,20,29)', padding: '6px 12px', borderRadius: '20px', flex: '0 0 auto' } }, '✦ Custom')));

  // Keep the active category tab visible: if it is outside the viewport,
  // bring it into view with native scrolling (no fake animation).
  requestAnimationFrame(() => {
    try {
      const hash = location.hash || '#/shop';
      const links = categoryBar.querySelectorAll('a[href]');
      let target = null;
      // Exact match first (e.g. #/shop?category=oversized)
      for (const a of links) {
        if (a.getAttribute('href') === hash) { target = a; break; }
      }
      // Fallback: match category/collection query value
      if (!target) {
        const q = (hash.split('?')[1] || '');
        const params = new URLSearchParams(q);
        const cat = params.get('category') || params.get('collection');
        if (cat) {
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            if (href.includes(encodeURIComponent(cat)) || href.includes(cat)) { target = a; break; }
          }
        }
      }
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
      }
    } catch {}
  });

  return h('header', { class: 'topbar' },
    announcement,
    h('div', { class: 'topbar-inner' },
      hamburger,
      h('a', { class: 'brand', href: '#/', 'aria-label': 'ZUNO home', style: { fontFamily: 'var(--font-display)', letterSpacing: '0.12em', fontWeight: '700', fontSize: '22px' } },
        'ZUNO'),
      nav,
      search,
      actions),
    categoryBar);
}

export function bottomNav(active) {
  const cartCount = Store.cartCount();
  return h('nav', { class: 'bottom-nav', 'aria-label': 'Mobile' },
    ...MOBILE_NAV.map((n) => {
      const isActive = active === n.key;
      return h('a', { 
        href: n.href, 
        class: isActive ? 'active' : '',
        style: isActive ? { color:'var(--primary-denim)', background:'rgba(43,76,126,0.08)' } : {}
      },
        h('span', { style:{display:'grid', placeItems:'center', width:'22px', height:'22px'} }, navIcon(n.icon, 20)),
        n.key === 'cart' && cartCount ? h('span', { class: 'cart-count' }, String(cartCount)) : null,
        h('span', { style:{fontSize:'11px', fontWeight:'700', letterSpacing:'0.02em', marginTop:'2px'} }, n.label));
    }));
}

function socialSvg(type) {
  const base = { width:'22', height:'22', viewBox:'0 0 24 24', fill:'currentColor', 'aria-hidden':'true', style:'display:block' };
  if (type==='youtube') return h('svg', { ...base, viewBox:'0 0 24 24' },
    h('path', { d:'M23 12s0-3.6-.46-5.33a1.9 1.9 0 00-1.34-1.34C19.47 5 12 5 12 5s-7.47 0-9.2.33A1.9 1.9 0 001.46 6.67C1 8.4 1 12 1 12s0 3.6.46 5.33a1.9 1.9 0 001.34 1.34C4.53 19 12 19 12 19s7.47 0 9.2-.33a1.9 1.9 0 001.34-1.34C23 15.6 23 12 23 12z', fill:'currentColor' }),
    h('path', { d:'M10 15.5 L16 12 L10 8.5 Z', fill:'#fff' }));
  if (type==='instagram') return h('svg', base,
    h('path', { d:'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.3 2.3.5.5.2.9.5 1.3.9.4.4.7.8.9 1.3.2.4.4 1.1.5 2.3.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.9-.5 2.3-.2.5-.5.9-.9 1.3-.4.4-.8.7-1.3.9-.4.2-1.1.4-2.3.5-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.3-2.3-.5a3.2 3.2 0 01-1.3-.9 3.2 3.2 0 01-.9-1.3c-.2-.4-.4-1.1-.5-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.9.5-2.3.2-.5.5-.9.9-1.3.4-.4.8-.7 1.3-.9.4-.2 1.1-.4 2.3-.5C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.8.1-1 .1-1.6.2-1.9.4-.4.1-.7.4-1 .7-.3.3-.5.6-.7 1-.1.3-.3.9-.4 1.9C3.1 8.5 3 8.9 3 12s0 3.5.1 4.8c.1 1 .2 1.6.4 1.9.1.4.4.7.7 1 .3.3.6.5 1 .7.3.1.9.3 1.9.4 1.3.1 1.7.1 4.8.1s3.5 0 4.8-.1c1-.1 1.6-.2 1.9-.4.4-.1.7-.4 1-.7.3-.3.5-.6.7-1 .1-.3.3-.9.4-1.9.1-1.3.1-1.7.1-4.8s0-3.5-.1-4.8c-.1-1-.2-1.6-.4-1.9-.1-.4-.4-.7-.7-1-.3-.3-.6-.5-1-.7-.3-.1-.9-.3-1.9-.4-1.3-.1-1.7-.1-4.8-.1zm0 3.2a5 5 0 110 10 5 5 0 010-10zm0 1.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4zm5.2-2.1a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z' }));
  // facebook - bold f
  return h('svg', base, h('path', { d:'M13.5 21v-7h2.3l.3-2.7h-2.6v-1.7c0-.8.2-1.3 1.3-1.3h1.4V5.1C15.6 5 14.7 5 13.6 5c-2.3 0-3.9 1.4-3.9 4v2.3H7.5V14h2.2v7h3.8z' }));
}
export function footer() {
  // High-visibility social rectangle — white icons on dark bg, clear hover/focus, centered rectangle
  const socialLink = (href, label, type) => h('a', {
    href, target: '_blank', rel: 'noopener noreferrer',
    class: 'social-btn',
    'aria-label': label, title: label,
    style: { color: 'rgb(16,20,29)', background: '#fff', border: '1px solid #fff', width:'44px', height:'44px', borderRadius:'10px', display:'grid', placeItems:'center', transition:'background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease', boxShadow:'0 2px 10px rgba(0,0,0,0.18)', textDecoration:'none' },
    onmouseenter: (e)=>{ e.currentTarget.style.background='#E9EEF5'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.24)'; },
    onmouseleave: (e)=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,0.18)'; },
    onfocus: (e)=>{ e.currentTarget.style.outline='2px solid #fff'; e.currentTarget.style.outlineOffset='2px'; },
    onblur: (e)=>{ e.currentTarget.style.outline=''; }
  }, socialSvg(type));
  return h('footer', { class: 'footer' },
    h('div', { class: 'container' },
      h('div', { class: 'footer-grid' },
        h('div', {},
          h('div', { class: 'brand', style: { color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' } }, 'ZUNO'),
          h('p', { class: 'muted', style: { maxWidth: '30ch', marginTop: '12px', lineHeight: '1.6' } }, 'Modern everyday clothing. Designed for people who don\'t follow the ordinary. Made in India, worn everywhere.'),
          // Rectangle social section — FOLLOW ZUNO with high-contrast premium icons
          h('div', { class: 'social-rectangle', style: { marginTop: '18px', padding:'16px 16px', borderRadius:'14px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.16)', maxWidth:'340px', backdropFilter:'blur(6px)' } },
            h('div', { style:{fontSize:'11px', letterSpacing:'0.16em', fontWeight:'800', color:'#fff', marginBottom:'12px', textAlign:'left'} }, 'FOLLOW ZUNO'),
            h('div', { class: 'row', style: { gap:'12px', flexWrap:'wrap', justifyContent:'flex-start', alignItems:'center' } },
              h('div', { style:{display:'flex', flexDirection:'column', alignItems:'center', gap:'6px'} }, socialLink('https://www.youtube.com/@Zunoworld18', 'ZUNO on YouTube — opens https://www.youtube.com/@Zunoworld18', 'youtube'), h('span', {style:{fontSize:'10px', color:'#cbd5e1', fontWeight:'600', letterSpacing:'0.02em'}}, 'YouTube')),
              h('div', { style:{display:'flex', flexDirection:'column', alignItems:'center', gap:'6px'} }, socialLink('https://www.instagram.com/zunoworld18?stkn=eHdxZG5tbDR1NmEy', 'ZUNO on Instagram — opens https://www.instagram.com/zunoworld18', 'instagram'), h('span', {style:{fontSize:'10px', color:'#cbd5e1', fontWeight:'600', letterSpacing:'0.02em'}}, 'Instagram')),
              h('div', { style:{display:'flex', flexDirection:'column', alignItems:'center', gap:'6px'} }, socialLink('https://www.facebook.com/share/19LNT6nuMH/', 'ZUNO on Facebook — opens https://www.facebook.com/share/19LNT6nuMH/', 'facebook'), h('span', {style:{fontSize:'10px', color:'#cbd5e1', fontWeight:'600', letterSpacing:'0.02em'}}, 'Facebook')))),
          h('div', { style:{marginTop:'10px', fontSize:'11px', color:'#e2e8f0', letterSpacing:'0.02em', fontWeight:'500'} }, 'Tap an icon → official ZUNO profile (new tab) →')),
        footerCol('SHOP', [['All T-shirts', '#/shop'], ['New Drops', '#/shop?sort=newest'], ['Best Sellers', '#/shop?sort=popular'], ['Custom T-shirts', '#/customize']]),
        footerCol('HELP', [['Contact Us', 'mailto:zunoworld3121@gmail.com'], ['Shipping', '#/about'], ['Returns', '#/about'], ['Size Guide', '#/shop'], ['FAQs', '#/about']]),
        footerCol('COMPANY', [['About ZUNO', '#/about'], ['Our Story', '#/about'], ['Careers', 'mailto:zunoworld3121@gmail.com?subject=Careers%20at%20ZUNO']]),
        footerCol('LEGAL', [['Privacy', '#/about'], ['Terms', '#/about'], ['Refund Policy', '#/about']])),
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
  const img = p.images && p.images[0] ? resolveImageUrl(p.images[0]) : productImage(p);
  const img2 = p.images && p.images[1] ? resolveImageUrl(p.images[1]) : null;
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

  const thumb = h('div', { class: 'product-thumb' },
    badge, heart,
    h('img', { class: 'product-img', src: img, alt: p.name, loading: 'lazy', decoding: 'async', width: '300', height: '375', sizes: '(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw', onerror: (e) => imgFallback(e.currentTarget, p) }),
    img2 ? h('img', { class: 'product-img-hover', src: img2, alt: p.name, loading: 'lazy', decoding: 'async', width: '300', height: '375', onerror: (e) => { e.currentTarget.style.display = 'none'; } }) : null);

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

// ── Mini-cart drawer popup — shown after Add to Bag, ESC/overlay to close ──
export function showCartDrawer({ addedProduct } = {}) {
  const existing = document.querySelector('.cart-drawer');
  if (existing) existing.remove();
  const isGuest = !Store.isAuthed();
  let items = [];
  let subtotal = 0;
  let count = 0;
  if (isGuest) {
    const guest = (Store.getGuest ? Store.getGuest() : []).filter(i => !i.module || i.module === 'shop');
    items = guest.slice(-3).reverse();
    guest.forEach(i => { subtotal += (i.price || 0) * (i.quantity || 0); count += i.quantity || 0; });
  } else {
    const cart = Store.getCart && Store.getCart();
    const shop = cart && cart.shop;
    if (shop && shop.items) { items = shop.items.slice(-3).reverse(); subtotal = shop.subtotal || 0; count = shop.items.reduce((a,b)=>a+(b.quantity||0),0); }
  }
  const titleAdded = addedProduct ? `Added — ${String(addedProduct.name||'').slice(0,28)}` : 'Added to bag';
  const drawer = h('div', { class: 'cart-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Bag' },
    h('div', { class: 'cart-drawer__backdrop', onclick: close }),
    h('div', { class: 'cart-drawer__panel' },
      h('div', { class: 'cart-drawer__head' },
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('span', { style: { width: '32px', height: '32px', borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'grid', placeItems: 'center', fontSize: '16px' } }, '✓'),
          h('div', {},
            h('h3', {}, titleAdded),
            h('div', { style: { fontSize: '12px', color: '#64748b' } }, count + ' item(s) • ' + money(subtotal)))),
        h('button', { class: 'cart-drawer__close', type: 'button', 'aria-label': 'Close', onclick: close }, '✕')),
      h('div', { class: 'cart-drawer__body' },
        addedProduct ? h('div', { class: 'cart-drawer__item', style: { borderColor: '#bbf7d0', background: '#f0fdf4' } },
          h('img', { src: addedProduct.image ? resolveImageUrl(addedProduct.image) : productImage({ name: addedProduct.name }), alt: addedProduct.name }),
          h('div', { style: { minWidth: 0, flex: 1 } },
            h('div', { style: { fontWeight: '700', color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, addedProduct.name),
            h('div', { style: { fontSize: '12px', color: '#64748b' } }, [addedProduct.variant?.color, addedProduct.variant?.size].filter(Boolean).join(' · ') || 'Premium • 240 GSM'),
            h('div', { style: { fontWeight: '800', color: '#0f172a', marginTop: '4px' } }, money(addedProduct.price)))) : null,
        ...items.map(it => h('div', { class: 'cart-drawer__item' },
          h('img', { src: it.image ? resolveImageUrl(it.image) : productImage({ name: it.name }), alt: it.name }),
          h('div', { style: { minWidth: 0, flex: 1 } },
            h('div', { style: { fontWeight: '600', color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.name),
            h('div', { style: { fontSize: '11px', color: '#64748b' } }, (it.variant ? [it.variant.color, it.variant.size].filter(Boolean).join(' · ') : '') || (it.isCustom ? 'Custom design' : 'Qty ' + it.quantity)),
            h('div', { style: { fontWeight: '700', color: '#334155', marginTop: '2px', fontSize: '12px' } }, money(it.price) + (it.quantity ? ' × ' + it.quantity : ''))),
          h('div', { style: { fontWeight: '800', color: '#0f172a', fontSize: '12px' } }, money((it.price||0)*(it.quantity||1))))),
        !items.length ? h('div', { style: { textAlign: 'center', padding: '20px', color: '#64748b' } }, 'Your bag will appear here') : null),
      h('div', { class: 'cart-drawer__foot' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#0f172a' } }, h('span', {}, 'Subtotal'), h('span', {}, money(subtotal))),
        h('a', { class: 'btn btn-outline btn-block', href: '#/cart', onclick: () => close() }, 'View bag'),
        h('a', { class: 'btn btn-primary btn-block', href: isGuest ? '#/cart' : '#/checkout?module=shop', style: { background: '#0f172a', borderColor: '#0f172a' }, onclick: () => close() }, isGuest ? 'Sign in to checkout →' : 'Proceed to checkout →'),
        h('p', { style: { fontSize: '11px', color: '#64748b', textAlign: 'center', margin: '4px 0 0' } }, 'Free shipping over ₹999 • 7-day returns'))));
  function close(){ drawer.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e){ if(e.key==='Escape') close(); }
  document.body.append(drawer);
  document.addEventListener('keydown', onKey);
  // Auto-close after 6s, toast already shown
  setTimeout(() => { try{ if(document.body.contains(drawer)) close(); } catch{} }, 6000);
  // Ensure cart count updated
  if (!isGuest) refreshCart().catch(()=>{});
}
