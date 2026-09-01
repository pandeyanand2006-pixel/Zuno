import { h, money, skeletonGrid, emptyState, errorState } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

export async function Home() {
  const main = h('div', {});

  // ── HERO ──────────────────────────────────────────────────────────
  const hero = h('section', { class: 'hero-fashion' },
    h('div', { class: 'hero-fashion-inner container' },
      h('div', { class: 'hero-copy' },
        h('p', { class: 'hero-eyebrow' }, 'ZUNO — Est. 2024 · Made in India'),
        h('h1', { class: 'hero-title' }, 'WEAR', h('br'), 'YOUR', h('br'), h('span', { class: 'hero-accent' }, 'ATTITUDE.')),
        h('p', { class: 'hero-sub' }, 'Everyday essentials designed for people who don\'t follow the ordinary. Premium T-shirts and shirts, cut for your everyday.'),
        h('div', { class: 'hero-cta' },
          h('a', { class: 'btn btn-primary btn-lg', href: '#/shop?category=t-shirts' }, 'SHOP T-SHIRTS'),
          h('a', { class: 'btn btn-outline btn-lg', href: '#/shop?category=shirts' }, 'SHOP SHIRTS'),
          h('a', { class: 'btn btn-ghost btn-lg', href: '#/customize', style: { border: '1px solid var(--ink-900)' } }, 'CREATE YOUR OWN →'))),
      h('div', { class: 'hero-visual' },
        h('div', { class: 'hero-card hero-card-1' },
          h('div', { class: 'hero-card-label' }, 'Oversized Core Tee · Black'),
          h('div', { class: 'hero-card-price' }, '₹1,499')),
        h('div', { class: 'hero-card hero-card-2' },
          h('div', { class: 'hero-card-label' }, 'Oxford Shirt · White'),
          h('div', { class: 'hero-card-price' }, '₹2,499')))));

  // ── NEW ARRIVALS ─────────────────────────────────────────────────
  const newArrivals = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' },
      h('h2', {}, 'New Arrivals'),
      h('a', { href: '#/shop?sort=newest', class: 'link-arrow' }, 'View all →')));
  const newGrid = h('div', { class: 'grid grid-products' });
  newArrivals.append(skeletonGrid(8));
  newArrivals.append(newGrid);

  // ── CATEGORIES ───────────────────────────────────────────────────
  const categories = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' }, h('h2', {}, 'Shop by Category')),
    h('div', { class: 'cat-grid' },
      h('a', { class: 'cat-card cat-tshirts', href: '#/shop?category=t-shirts' },
        h('div', { class: 'cat-card-inner' },
          h('h3', {}, 'T-Shirts'),
          h('p', {}, 'Oversized · Regular · Graphic · Plain · Polo'),
          h('span', { class: 'cat-cta' }, 'Shop T-Shirts →'))),
      h('a', { class: 'cat-card cat-shirts', href: '#/shop?category=shirts' },
        h('div', { class: 'cat-card-inner' },
          h('h3', {}, 'Shirts'),
          h('p', {}, 'Casual · Printed · Overshirt · Solid'),
          h('span', { class: 'cat-cta' }, 'Shop Shirts →')))));

  // ── COLLECTIONS ──────────────────────────────────────────────────
  const collections = h('section', { class: 'section container' },
    h('div', { class: 'section-title fashion' }, h('h2', {}, 'Collections')),
    h('div', { class: 'collection-grid' },
      h('a', { class: 'collection-card', href: '#/shop?collection=Essentials' },
        h('div', { class: 'collection-card-bg', style: { background: '#f5f5f3' } }),
        h('div', { class: 'collection-card-content' }, h('h3', {}, 'THE EVERYDAY COLLECTION'), h('p', {}, 'Minimal everyday T-shirts and shirts'), h('span', { class: 'link-arrow' }, 'Explore →'))),
      h('a', { class: 'collection-card dark', href: '#/shop?collection=After%20Dark' },
        h('div', { class: 'collection-card-bg', style: { background: '#0a0a0a' } }),
        h('div', { class: 'collection-card-content' }, h('h3', {}, 'AFTER DARK'), h('p', {}, 'Dark-toned premium essentials'), h('span', { class: 'link-arrow' }, 'Explore →'))),
      h('a', { class: 'collection-card', href: '#/shop?collection=Street%20Form' },
        h('div', { class: 'collection-card-bg', style: { background: '#e8e6e1' } }),
        h('div', { class: 'collection-card-content' }, h('h3', {}, 'STREET FORM'), h('p', {}, 'Oversized and graphic'), h('span', { class: 'link-arrow' }, 'Explore →'))),
      h('a', { class: 'collection-card', href: '#/shop?collection=Essentials' },
        h('div', { class: 'collection-card-bg', style: { background: '#fafaf9' } }),
        h('div', { class: 'collection-card-content' }, h('h3', {}, 'ESSENTIALS'), h('p', {}, 'Plain T-shirts and shirts'), h('span', { class: 'link-arrow' }, 'Explore →')))));

  // ── CUSTOM STUDIO TEASER ─────────────────────────────────────────
  const studio = h('section', { class: 'studio-teaser' },
    h('div', { class: 'container' },
      h('div', { class: 'studio-teaser-inner' },
        h('div', {},
          h('p', { class: 'hero-eyebrow', style: { color: '#fff', opacity: '0.7' } }, 'ZUNO CUSTOM STUDIO'),
          h('h2', {}, 'MAKE IT', h('br'), 'YOURS.'),
          h('p', { style: { color: 'rgba(255,255,255,0.7)', marginTop: '12px', maxWidth: '36ch' } }, 'Create a T-shirt that is completely yours. Add text, upload images, choose colors — and see it live.'),
          h('a', { class: 'btn btn-primary btn-lg', href: '#/customize', style: { marginTop: '20px', background: '#fff', color: '#0a0a0a', borderColor: '#fff' } }, 'START DESIGNING →')),
        h('div', { class: 'studio-preview' },
          h('div', { class: 'studio-shirt' },
            h('div', { class: 'studio-shirt-label' }, 'YOUR DESIGN HERE'),
            h('div', { style: { fontSize: '48px', marginTop: '12px' } }, '✦'))))));

  // ── TRUST ────────────────────────────────────────────────────────
  const trust = h('section', { class: 'section container' },
    h('div', { class: 'trust-grid' },
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '◧'), h('h4', {}, 'Free shipping'), h('p', { class: 'muted text-sm' }, 'On orders above ₹999')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '↺'), h('h4', {}, 'Easy returns'), h('p', { class: 'muted text-sm' }, '7-day hassle-free returns')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '✓'), h('h4', {}, 'Premium cotton'), h('p', { class: 'muted text-sm' }, '240 GSM heavyweight')),
      h('div', { class: 'trust-item' }, h('div', { class: 'trust-icon' }, '♡'), h('h4', {}, 'Made in India'), h('p', { class: 'muted text-sm' }, 'Designed and made with care'))));

  main.append(hero, newArrivals, categories, collections, studio, trust);

  // ── DATA ─────────────────────────────────────────────────────────
  (async () => {
    try {
      const { items } = await api.get('/products', { module: 'shop', limit: 8, sort: 'newest' });
      const sk = newArrivals.querySelector('.skeleton'); if (sk) sk.remove();
      // Remove the extra skeleton grid, keep newGrid
      const skeletons = newArrivals.querySelectorAll('.grid'); skeletons.forEach(g => { if (g !== newGrid) g.remove(); });
      // Actually newGrid is empty, we appended skeletonGrid(8) directly. Clear it.
      newArrivals.querySelectorAll('.skeleton').forEach(el => el.remove());
      // Remove the skeletonGrid wrapper if present
      const grids = newArrivals.querySelectorAll('.grid'); grids.forEach(g => { if (g.children.length === 0 || g.querySelector('.skeleton')) g.remove(); });
      if (items.length) {
        // Ensure newGrid is in DOM
        if (!newArrivals.contains(newGrid)) newArrivals.append(newGrid);
        newGrid.innerHTML = '';
        newGrid.append(...items.map(ProductCard));
      } else {
        newArrivals.append(emptyState({ title: 'New arrivals coming soon', desc: 'We are cutting the next drop.' }));
      }
    } catch (err) {
      newArrivals.append(errorState(err.message, () => location.reload()));
    }
  })();

  return main;
}
