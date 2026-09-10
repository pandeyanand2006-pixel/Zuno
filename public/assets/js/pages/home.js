import { h, money, skeletonGrid, emptyState, errorState, toast } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

export async function Home() {
  const main = h('div', {});

  // ── CAROUSEL BANNER (Denim) ────────────────────────────────────
  const hero = h('section', { class: 'hero-carousel', style: { position: 'relative', height: 'clamp(420px, 60vh, 640px)', overflow: 'hidden', background: 'var(--light-indigo)' } },
    h('img', { src: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1400&h=640&fit=crop', alt: 'Denim lifestyle', style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'eager' }),
    h('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(28,37,65,0.55) 0%, transparent 60%)' } }),
    h('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(20px, 6vw, 80px)', color: 'var(--pure-white)' } },
      h('p', { style: { fontSize: '12px', letterSpacing: '0.16em', fontWeight: '700', opacity: '0.9', marginBottom: '12px' } }, 'ZUNO DENIM — NEW SEASON'),
      h('h1', { style: { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: '0.9', letterSpacing: '-0.03em', fontWeight: '800' } }, 'WEAR YOUR', h('br'), 'ATTITUDE.'),
      h('p', { style: { marginTop: '12px', maxWidth: '42ch', opacity: '0.85' } }, 'Heavyweight cotton, perfect fit — made for everyday confidence.'),
      h('div', { style: { marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' } },
        h('a', { href: '#/shop', style: { background: 'var(--primary-denim)', color: 'var(--pure-white)', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', letterSpacing: '0.04em', textDecoration: 'none', transition: 'background 0.2s ease-in' }, onmouseenter: (e) => e.target.style.background = 'var(--secondary-wash)', onmouseleave: (e) => e.target.style.background = 'var(--primary-denim)' }, 'SHOP T-SHIRTS'),
        h('a', { href: '#/customize', style: { background: 'transparent', color: 'var(--pure-white)', border: '1px solid rgba(255,255,255,0.8)', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', textDecoration: 'none' } }, 'CREATE YOUR T-SHIRT'))),
    // Dots
    h('div', { style: { position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' } },
      h('span', { style: { width: '24px', height: '4px', borderRadius: '999px', background: 'var(--pure-white)' } }),
      h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' } }),
      h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' } })));

  // ── CATEGORY CIRCLES ───────────────────────────────────────────
  const categories = [
    { label: 'Oversized Tees', img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=200&fit=crop' },
    { label: 'Cargos', img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=200&h=200&fit=crop' },
    { label: 'Sneakers', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop' },
    { label: 'Shirts', img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=200&h=200&fit=crop' },
    { label: 'Hoodies', img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=200&h=200&fit=crop' },
    { label: 'Accessories', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop' },
  ];
  const catRow = h('div', { style: { display: 'flex', gap: '20px', overflowX: 'auto', padding: '24px 20px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }, onwheel: (e) => { if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault(); } } },
    ...categories.map(c => h('a', { href: '#/shop?category=' + encodeURIComponent(c.label.toLowerCase()), style: { flex: '0 0 88px', textAlign: 'center', textDecoration: 'none', scrollSnapAlign: 'start' } },
      h('div', { style: { width: '88px', height: '88px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--light-indigo)', transition: 'transform 0.2s ease-in, border-color 0.2s ease-in', background: 'var(--light-indigo)' }, onmouseenter: (e) => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.borderColor = 'var(--secondary-wash)'; }, onmouseleave: (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--light-indigo)'; } },
        h('img', { src: c.img, alt: c.label, style: { width: '100%', height: '100%', objectFit: 'cover' }, loading: 'lazy' })),
      h('span', { style: { display: 'block', marginTop: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--dark-charcoal)' } }, c.label))));

  // ── PRODUCT FEED GRID ──────────────────────────────────────────
  const feedSection = h('section', { style: { maxWidth: '1320px', margin: '0 auto', padding: '24px 20px' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' } },
      h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '-0.02em' } }, 'New Drops'),
      h('a', { href: '#/shop?sort=newest', style: { fontSize: '13px', fontWeight: '700', color: 'var(--primary-denim)', textDecoration: 'none' } }, 'View all →')));
  const productGrid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' } });
  // Responsive via CSS
  const style = h('style', {}, `
    @media (max-width: 1024px) { .product-grid-denim { grid-template-columns: repeat(3, 1fr) !important; } }
    @media (max-width: 640px) { .product-grid-denim { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; } }
    .cat-row::-webkit-scrollbar { display: none; }
  `);
  productGrid.classList.add('product-grid-denim');
  productGrid.style.cssText = 'display:grid; grid-template-columns:repeat(4, 1fr); gap:20px;';
  // Inject responsive style
  document.head.appendChild(style);
  feedSection.append(productGrid);
  productGrid.append(skeletonGrid(8));

  // ── CUSTOM STUDIO TEASER ───────────────────────────────────────
  const studio = h('section', { style: { background: 'var(--dark-charcoal)', color: 'var(--pure-white)', padding: '48px 20px', margin: '32px 0' } },
    h('div', { style: { maxWidth: '1320px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' } },
      h('div', {},
        h('p', { style: { fontSize: '12px', letterSpacing: '0.16em', opacity: '0.7', fontWeight: '700' } }, 'ZUNO CUSTOM STUDIO'),
        h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: '0.9', marginTop: '8px' } }, 'MAKE IT', h('br'), 'YOURS.'),
        h('p', { style: { opacity: '0.7', marginTop: '12px', maxWidth: '36ch' } }, 'Create a T-shirt that is completely yours. Add text, upload artwork — see it live.'),
        h('a', { href: '#/customize', style: { display: 'inline-block', marginTop: '20px', background: 'var(--pure-white)', color: 'var(--dark-charcoal)', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', textDecoration: 'none' } }, 'START DESIGNING →')),
      h('div', { style: { display: 'flex', justifyContent: 'center' } },
        h('div', { style: { width: '280px', height: '360px', background: 'var(--pure-white)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--dark-charcoal)' } },
          h('div', { style: { fontSize: '12px', letterSpacing: '0.12em', opacity: '0.5', border: '1px dashed #c9d2e3', padding: '6px 12px', borderRadius: '999px' } }, 'YOUR DESIGN HERE'),
          h('div', { style: { fontSize: '48px', marginTop: '12px' } }, '✦')))));

  // ── TRUST ──────────────────────────────────────────────────────
  const trust = h('section', { style: { maxWidth: '1320px', margin: '32px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center' } },
    h('div', {}, h('div', {}, '✓'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Premium fabric'), h('div', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, '240 GSM heavyweight')),
    h('div', {}, h('div', {}, '↺'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Easy returns'), h('div', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, '7-day hassle-free')),
    h('div', {}, h('div', {}, '◧'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Secure payments'), h('div', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'Razorpay protected')),
    h('div', {}, h('div', {}, '◐'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Made in India'), h('div', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'Designed with care')));

  main.append(hero, catRow, feedSection, studio, trust);

  // ── DATA ───────────────────────────────────────────────────────
  (async () => {
    try {
      const { items } = await api.get('/products', { module: 'shop', limit: 8, sort: 'newest' });
      productGrid.innerHTML = '';
      if (items.length) productGrid.append(...items.map(ProductCard));
      else productGrid.append(emptyState({ title: 'New drops coming soon' }));
    } catch (e) {
      productGrid.innerHTML = '';
      productGrid.append(errorState(e.message, () => location.reload()));
    }
  })();

  return main;
}
