import { h, skeletonGrid, emptyState, errorState } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

export async function Home() {
  const main = h('div', {});

  // ── HERO — Reference section.hero 1fr 1.15fr radial Manrope (252) ──
  const hero = h('section', { class: 'hero', style: { display: 'grid', gridTemplateColumns: '1fr 1.15fr', alignItems: 'center', position: 'relative', height: '709px', padding: '85px clamp(22px,7vw,120px) 54px', backgroundImage: 'radial-gradient(circle at 72% 45%, rgb(35, 48, 58) 0px, rgb(16, 20, 29) 27%, transparent 52%)', backgroundColor: 'rgb(16,20,29)', color: 'rgb(245,247,240)', fontFamily: 'Manrope, sans-serif', overflow: 'hidden' } },
    h('div', { class: 'hero-copy', style: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' } },
      h('p', { style: { fontFamily: '"DM Mono", monospace', color: '#8a94a8', fontSize: '11px', letterSpacing: '0.14em', margin: '0', textTransform: 'uppercase' } }, 'DROP 01 — ZUNO LABS / HEAVYWEIGHT COTTON'),
      h('h1', { style: { fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(36px,6vw,64px)', lineHeight: '0.9', fontWeight: '800', letterSpacing: '-0.03em', margin: '0', color: 'rgb(245,247,240)' } }, 'WEAR YOUR', h('br'), h('span', { style: { color: 'rgb(245,247,240)' } }, 'ATTITUDE.')),
      h('p', { style: { color: 'rgba(245,247,240,0.7)', fontSize: '15px', lineHeight: '1.6', maxWidth: '42ch', margin: '0' } }, 'Heavyweight cotton, perfect fit — made for everyday confidence. Engineered for the everyday future.'),
      h('div', { style: { display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' } },
        h('a', { href: '#/shop', class: 'btn btn-primary', style: { background: 'rgb(245,247,240)', color: 'rgb(16,20,29)', borderRadius: '999px', padding: '14px 28px', fontWeight: '800', letterSpacing: '0.04em', border: 'none', textDecoration: 'none' } }, 'SHOP T-SHIRTS'),
        h('a', { href: '#/customize', style: { background: 'transparent', color: 'rgb(245,247,240)', border: '1px solid rgba(245,247,240,0.25)', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', textDecoration: 'none', backdropFilter: 'blur(6px)' } }, 'CREATE YOUR T-SHIRT')
      ),
      h('div', { style: { display: 'flex', gap: '20px', marginTop: '18px', fontFamily: '"DM Mono", monospace', fontSize: '11px', color: '#555d6f' } },
        h('span', {}, '01 — CORE FORM'), h('span', {}, '240 GSM'), h('span', {}, 'MADE IN INDIA')
      )
    ),
    h('div', { class: 'hero-art', style: { display: 'grid', height: '570px', position: 'relative', alignItems: 'center', justifyItems: 'center' } },
      h('img', { src: 'https://static.prod-images.emergentagent.com/jobs/f1d81413-9ad3-4b13-b1af-776dbf9ca9c1/images/7da540be91dd7a64dfab0e50e3c6394af0022bcd8e94f44d78605248ae0f2ec0.jpeg', alt: 'ZUNO Tee', style: { maxHeight: '540px', width: 'auto', maxWidth: '90%', objectFit: 'contain', filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.5))', borderRadius: '12px' }, loading: 'eager' })
    ),
    h('div', { class: 'hero-index', style: { display: 'none', fontFamily: '"DM Mono", monospace', color: '#555d6f', position: 'absolute', top: '28px', right: 'clamp(22px,7vw,120px)', fontSize: '11px', letterSpacing: '0.08em' } }, 'INDEX 01 / 04')
  );

  // ── CATEGORY CIRCLES — only real backend categories ──
  const categories = [
    { label: 'Oversized', img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=200&fit=crop', q: 'oversized' },
    { label: 'Graphic', img: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=200&h=200&fit=crop', q: 'graphic' },
    { label: 'Plain', img: 'https://images.unsplash.com/photo-1618354691321-e851c56960d1?w=200&h=200&fit=crop', q: 'plain' },
    { label: 'Polo', img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=200&h=200&fit=crop', q: 'polo' },
    { label: 'Premium Cotton', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop', q: 'premium-cotton' },
    { label: 'Essentials', img: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=200&h=200&fit=crop', q: '', collection: 'Essentials' },
    { label: 'Street Form', img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=200&h=200&fit=crop', q: '', collection: 'Street Form' },
    { label: 'Custom Studio', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop', q: '', href: '#/customize' },
  ];
  const catRow = h('div', { class: 'cat-bubbles', 'aria-label': 'Shop by category', onwheel: (e) => { if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault(); } } },
    ...categories.map(c => {
      const href = c.href || (c.collection ? '#/shop?collection=' + encodeURIComponent(c.collection) : c.q ? '#/shop?category=' + encodeURIComponent(c.q) : '#/shop');
      return h('a', { href, class: 'cat-bubble', 'aria-label': c.label },
        h('div', { class: 'cat-bubble__circle', 'aria-hidden': 'true' }, h('img', { src: c.img, alt: c.label, loading: 'lazy' })),
        h('span', { class: 'cat-bubble__label' }, c.label));
    }));

  // ── PRODUCT FEED GRID — 4-col desktop → 2-col mobile (no rigid px) ──
  const feedSection = h('section', { class: 'feed-section' },
    h('div', { class: 'feed-header' },
      h('h2', {}, 'New Drops'),
      h('a', { href: '#/shop?sort=newest', style: { fontSize: '13px', fontWeight: '700', color: 'var(--primary-denim)', textDecoration: 'none' } }, 'View all →')));
  const productGrid = h('div', { class: 'grid grid-products' });
  feedSection.append(productGrid);
  productGrid.append(skeletonGrid(8));

  // ── CUSTOM STUDIO TEASER ──
  const studio = h('section', { class: 'studio-teaser', style: { background: 'var(--dark-charcoal)', color: 'var(--pure-white)', padding: '48px 20px', margin: '32px 0' } },
    h('div', { class: 'studio-teaser-inner', style: { maxWidth: '1320px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' } },
      h('div', {},
        h('p', { style: { fontSize: '12px', letterSpacing: '0.16em', opacity: '0.7', fontWeight: '700' } }, 'ZUNO CUSTOM STUDIO'),
        h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: '0.9', marginTop: '8px' } }, 'MAKE IT', h('br'), 'YOURS.'),
        h('p', { style: { opacity: '0.7', marginTop: '12px', maxWidth: '36ch' } }, 'Create a T-shirt that is completely yours. Add text, upload artwork — see it live.'),
        h('a', { href: '#/customize', style: { display: 'inline-block', marginTop: '20px', background: 'var(--pure-white)', color: 'var(--dark-charcoal)', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', textDecoration: 'none', transition: 'background 0.2s ease-in' }, onmouseenter:(e)=>e.target.style.background='var(--light-indigo)', onmouseleave:(e)=>e.target.style.background='var(--pure-white)' }, 'START DESIGNING →')),
      h('div', { style: { display: 'flex', justifyContent: 'center' } },
        h('div', { style: { width: '280px', height: '360px', background: 'var(--pure-white)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--dark-charcoal)' } },
          h('div', { style: { fontSize: '12px', letterSpacing: '0.12em', opacity: '0.5', border: '1px dashed #c9d2e3', padding: '6px 12px', borderRadius: '999px' } }, 'YOUR DESIGN HERE'),
          h('div', { style: { fontSize: '48px', marginTop: '12px' } }, '✦')))));

  // ── TRUST ──
  const trust = h('section', { class: 'trust-grid', style: { maxWidth: '1320px', margin: '32px auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center', borderTop: '1px solid var(--light-indigo)', borderBottom: '1px solid var(--light-indigo)' } },
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '✓'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Premium fabric'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, '240 GSM heavyweight')),
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '↺'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Easy returns'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, '7-day hassle-free')),
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '◧'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Secure payments'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, 'Razorpay protected')),
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '◐'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Made in India'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, 'Designed with care')));

  main.append(hero, catRow, feedSection, studio, trust);

  // ── DATA ──
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

  // No carousel timer — static hero
  main._cleanup = () => {};

  return main;
}
