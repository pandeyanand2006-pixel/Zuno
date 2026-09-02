import { h, money, skeletonGrid, emptyState, errorState, toast } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

export async function Home() {
  const main = h('div', {});

  // ── HERO ──────────────────────────────────────────────────────────
  const hero = h('section', { class: 'hero-fashion' },
    h('div', { class: 'hero-fashion-inner container' },
      h('div', { class: 'hero-copy' },
        h('p', { class: 'hero-eyebrow' }, 'Zuno — Est. 2024 · Made in India'),
        h('h1', { class: 'hero-title' }, 'WEAR', h('br'), 'YOUR', h('br'), h('span', { class: 'hero-accent' }, 'ATTITUDE.')),
        h('p', { class: 'hero-sub' }, 'Premium T-shirts designed for everyday confidence. Heavyweight cotton, perfect fit, made for you.'),
        h('div', { class: 'hero-cta' },
          h('a', { class: 'btn btn-primary btn-lg', href: '#/shop' }, 'SHOP T-SHIRTS'),
          h('a', { class: 'btn btn-outline btn-lg', href: '#/customize' }, 'CREATE YOUR T-SHIRT'))),
      h('div', { class: 'hero-visual' },
        h('div', { class: 'hero-card hero-card-1' },
          h('div', { class: 'hero-card-label' }, 'Essential Heavyweight Tee · Black'),
          h('div', { class: 'hero-card-price' }, '₹1,299')),
        h('div', { class: 'hero-card hero-card-2' },
          h('div', { class: 'hero-card-label' }, 'Oversized Core Tee · White'),
          h('div', { class: 'hero-card-price' }, '₹1,499')))));

  // ── FEATURED COLLECTION ──────────────────────────────────────────
  const featured = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' },
      h('h2', {}, 'Featured Collection'),
      h('a', { href: '#/shop', class: 'link-arrow' }, 'Shop all →')));
  const featuredGrid = h('div', { class: 'grid grid-products' });
  featured.append(skeletonGrid(8));
  featured.append(featuredGrid);

  // ── NEW DROPS ────────────────────────────────────────────────────
  const newDrops = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' },
      h('h2', {}, 'New Drops'),
      h('a', { href: '#/shop?sort=newest', class: 'link-arrow' }, 'View all →')));
  const newGrid = h('div', { class: 'grid grid-products' });
  newDrops.append(skeletonGrid(4));
  newDrops.append(newGrid);

  // ── BEST SELLERS ─────────────────────────────────────────────────
  const bestSellers = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' },
      h('h2', {}, 'Best Sellers'),
      h('a', { href: '#/shop?sort=popular', class: 'link-arrow' }, 'View all →')));
  const bestGrid = h('div', { class: 'grid grid-products' });
  bestSellers.append(skeletonGrid(4));
  bestSellers.append(bestGrid);

  // ── CATEGORIES (T-shirts only) ───────────────────────────────────
  const categories = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' }, h('h2', {}, 'Shop by Fit')),
    h('div', { class: 'cat-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
      h('a', { class: 'cat-card cat-tshirts', href: '#/shop?category=oversized', style: { height: '240px' } },
        h('div', { class: 'cat-card-inner' }, h('h3', {}, 'Oversized'), h('p', {}, 'Relaxed drape, street-ready'), h('span', { class: 'cat-cta' }, 'Shop →'))),
      h('a', { class: 'cat-card', href: '#/shop?category=regular-fit', style: { height: '240px', background: '#fff', border: '1px solid var(--ink-100)' } },
        h('div', { class: 'cat-card-inner' }, h('h3', {}, 'Regular Fit'), h('p', {}, 'Classic, everyday'), h('span', { class: 'cat-cta' }, 'Shop →'))),
      h('a', { class: 'cat-card', href: '#/shop?category=graphic', style: { height: '240px', background: '#0a0a0a', color: '#fff' } },
        h('div', { class: 'cat-card-inner', style: { color: '#fff' } }, h('h3', { style: { color: '#fff' } }, 'Graphic'), h('p', { style: { color: 'rgba(255,255,255,0.7)' } }, 'Bold prints, minimal'), h('span', { class: 'cat-cta', style: { color: '#fff', borderColor: '#fff' } }, 'Shop →')))));

  // ── CUSTOM STUDIO TEASER ─────────────────────────────────────────
  const studio = h('section', { class: 'studio-teaser' },
    h('div', { class: 'container' },
      h('div', { class: 'studio-teaser-inner' },
        h('div', {},
          h('p', { class: 'hero-eyebrow', style: { color: '#fff', opacity: '0.7' } }, 'Zuno CUSTOM STUDIO'),
          h('h2', {}, 'MAKE IT', h('br'), 'YOURS.'),
          h('p', { style: { color: 'rgba(255,255,255,0.7)', marginTop: '12px', maxWidth: '36ch', lineHeight: '1.6' } }, 'Create a T-shirt that is completely yours. Add text, upload artwork, choose colors — and see it live. Premium printing, made to order.'),
          h('a', { class: 'btn btn-primary btn-lg', href: '#/customize', style: { marginTop: '20px', background: '#fff', color: '#0a0a0a', borderColor: '#fff' } }, 'START DESIGNING →')),
        h('div', { class: 'studio-preview' },
          h('div', { class: 'studio-shirt' },
            h('div', { class: 'studio-shirt-label' }, 'YOUR DESIGN HERE'),
            h('div', { style: { fontSize: '48px', marginTop: '12px' } }, '✦'))))));

  // ── WHY Zuno ─────────────────────────────────────────────────────
  const why = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' }, h('h2', {}, 'Why Zuno')),
    h('div', { class: 'trust-grid' },
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '◧'), h('h4', {}, 'Premium fabric'), h('p', { class: 'muted text-sm' }, '240 GSM heavyweight cotton')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '✦'), h('h4', {}, 'High-quality printing'), h('p', { class: 'muted text-sm' }, 'HD screen & puff print')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '◐'), h('h4', {}, 'Made in India'), h('p', { class: 'muted text-sm' }, 'Designed and made with care')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '✓'), h('h4', {}, 'Secure payments'), h('p', { class: 'muted text-sm' }, 'Razorpay protected'))),
    h('div', { class: 'trust-grid', style: { marginTop: '16px', borderTop: '1px solid var(--ink-100)', paddingTop: '24px' } },
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '↺'), h('h4', {}, 'Easy returns'), h('p', { class: 'muted text-sm' }, '7-day hassle-free')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '◧'), h('h4', {}, 'Fast delivery'), h('p', { class: 'muted text-sm' }, '2-4 days across India')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '♡'), h('h4', {}, 'Customer love'), h('p', { class: 'muted text-sm' }, '4.7/5 from 2k+ reviews')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '✦'), h('h4', {}, 'Custom made'), h('p', { class: 'muted text-sm' }, 'Your design, printed to order'))));

  // ── REVIEWS ──────────────────────────────────────────────────────
  const reviews = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' }, h('h2', {}, 'What our customers say')),
    h('div', { class: 'review-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } },
      h('div', { class: 'card card-pad' }, h('div', {}, '★★★★★'), h('p', { class: 'fw-600', style: { marginTop: '8px' } }, 'Perfect fit and the print quality is amazing.'), h('p', { class: 'muted text-sm' }, '— Rohan, Mumbai')),
      h('div', { class: 'card card-pad' }, h('div', {}, '★★★★★'), h('p', { class: 'fw-600', style: { marginTop: '8px' } }, 'The heavyweight tee is now my everyday go-to.'), h('p', { class: 'muted text-sm' }, '— Ananya, Delhi')),
      h('div', { class: 'card card-pad' }, h('div', {}, '★★★★★'), h('p', { class: 'fw-600', style: { marginTop: '8px' } }, 'Custom Studio is addictive — made 3 already!'), h('p', { class: 'muted text-sm' }, '— Arjun, Bangalore'))));

  // ── INSTAGRAM GALLERY ────────────────────────────────────────────
  const gallery = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' }, h('h2', {}, 'Worn by you'), h('a', { href: '#', class: 'link-arrow' }, 'Follow @Zuno →')),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', aspectRatio: '6/1' } },
      ...Array.from({ length: 6 }, (_, i) => h('div', { style: { background: i % 2 === 0 ? '#f5f5f3' : '#0a0a0a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: i % 2 === 0 ? '#0a0a0a' : '#fff', fontSize: '24px' } }, '◐'))));

  // ── NEWSLETTER ───────────────────────────────────────────────────
  const newsletter = h('section', { class: 'section', style: { background: '#0a0a0a', color: '#fff', padding: '48px 0', margin: '48px 0 0' } },
    h('div', { class: 'container', style: { textAlign: 'center', maxWidth: '640px', margin: '0 auto' } },
      h('h2', { style: { fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.02em' } }, 'Join the Zuno community'),
      h('p', { class: 'muted', style: { color: 'rgba(255,255,255,0.6)', marginTop: '8px' } }, 'Get early access to drops, custom studio tips and member-only offers.'),
      h('div', { class: 'row gap-3', style: { marginTop: '20px', justifyContent: 'center', maxWidth: '480px', margin: '20px auto 0' } },
        h('input', { class: 'input', placeholder: 'Enter your email', style: { flex: '1', background: '#fff', color: '#0a0a0a' } }),
        h('button', { class: 'btn btn-primary', style: { background: '#fff', color: '#0a0a0a', borderColor: '#fff', whiteSpace: 'nowrap' }, onclick: (e) => { e.preventDefault(); toast('Welcome to Zuno — coming soon!', 'success'); } }, 'Join'))));

  main.append(hero, featured, newDrops, bestSellers, categories, studio, why, reviews, gallery, newsletter);

  // ── DATA ─────────────────────────────────────────────────────────
  (async () => {
    try {
      const [feat, newest, popular] = await Promise.all([
        api.get('/products', { module: 'shop', limit: 8, sort: 'popular' }),
        api.get('/products', { module: 'shop', limit: 4, sort: 'newest' }),
        api.get('/products', { module: 'shop', limit: 4, sort: 'popular' }),
      ]);
      // Featured
      const fg = featured.querySelector('.skeleton'); if (fg) fg.closest('.grid')?.remove();
      featured.querySelectorAll('.skeleton').forEach(el => el.remove());
      if (feat.items.length) {
        if (!featured.contains(featuredGrid)) featured.append(featuredGrid);
        featuredGrid.append(...feat.items.slice(0, 8).map(ProductCard));
      }
      // New Drops
      newDrops.querySelectorAll('.skeleton').forEach(el => el.remove());
      if (newest.items.length) newGrid.append(...newest.items.map(ProductCard));
      // Best Sellers
      bestSellers.querySelectorAll('.skeleton').forEach(el => el.remove());
      if (popular.items.length) bestGrid.append(...popular.items.map(ProductCard));
    } catch (err) {
      [featured, newDrops, bestSellers].forEach(w => {
        w.querySelectorAll('.skeleton').forEach(el => el.remove());
        w.append(errorState(err.message, () => location.reload()));
      });
    }
  })();

  return main;
}
