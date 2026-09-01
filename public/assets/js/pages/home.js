import { h, money, skeletonGrid, emptyState, errorState, toast } from '../ui.js';
import { api } from '../api.js';
import { ProductCard, refreshCart } from '../components.js';

const QUICK = [
  { key: 'shop', label: 'Shop', em: '🛒', href: '#/shop', cls: 'shop' },
  { key: 'grocery', label: 'Grocery', em: '🥦', href: '#/grocery', cls: 'grocery' },
  { key: 'food', label: 'Food', em: '🍔', href: '#/food', cls: 'food' },
  { key: 'services', label: 'Services', em: '🔧', href: '#/services', cls: 'services' },
  { key: 'payments', label: 'Payments', em: '💳', href: '#/profile', cls: 'payments' },
  { key: 'experiences', label: 'Experiences', em: '🎟️', href: '#/', cls: 'experiences' },
];

export async function Home() {
  const main = h('div', { class: 'container' });

  // Hero
  const heroSearch = h('input', { class: '', type: 'search', placeholder: 'Search “iPhone”, “milk”, “AC repair”…', 'aria-label': 'Universal search', style: { width: '100%', border: '1px solid var(--ink-200)', background: 'var(--surface)', borderRadius: 'var(--r-full)', padding: '14px 18px', fontSize: 'var(--fs-md)' } });
  heroSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter' && heroSearch.value.trim()) location.hash = '#/search?q=' + encodeURIComponent(heroSearch.value.trim()); });
  const hero = h('section', { class: 'hero' },
    h('div', { class: 'hero-glow' }),
    h('span', { class: 'badge badge-info' }, 'Super app · India'),
    h('h1', {}, 'Everything you need, in one place.'),
    h('p', {}, 'Shop millions of products, get groceries in minutes, order food you love, book trusted home services and pay securely — all inside Zuno.'),
    h('div', { class: 'hero-search' }, heroSearch),
    h('div', { class: 'hero-cta' },
      h('a', { class: 'btn btn-primary btn-lg', href: '#/shop' }, 'Start shopping'),
      h('a', { class: 'btn btn-outline btn-lg', href: '#/services' }, 'Book a service')));

  const quick = h('section', { class: 'section', style: { paddingTop: '8px' } },
    h('div', { class: 'grid grid-quick' },
      ...QUICK.map((q) => h('a', { class: 'quick ' + q.cls, href: q.href }, h('span', { class: 'ic' }, q.em), h('span', { class: 'fw-600', style: { color: 'var(--ink-800)' } }, q.label)))));

  // Personalized / featured
  const featuredWrap = h('section', { class: 'section' }, h('div', { class: 'section-title' }, h('h2', {}, 'Picked for you'), h('a', { href: '#/shop', class: 'text-sm fw-600' }, 'View all →')));
  featuredWrap.append(skeletonGrid(8));
  const groceryWrap = h('section', { class: 'section' }, h('div', { class: 'section-title' }, h('h2', {}, 'Grocery, delivered fast'), h('a', { href: '#/grocery', class: 'text-sm fw-600' }, 'Shop grocery →')));
  groceryWrap.append(skeletonGrid(4));
  const foodWrap = h('section', { class: 'section' }, h('div', { class: 'section-title' }, h('h2', {}, 'Restaurants near you'), h('a', { href: '#/food', class: 'text-sm fw-600' }, 'Explore food →')));
  foodWrap.append(skeletonGrid(4));

  main.append(hero, quick, featuredWrap, groceryWrap, foodWrap);

  // data loads
  (async () => {
    try {
      const [{ items }, { items: gItems }, { items: food }] = await Promise.all([
        api.get('/products', { module: 'shop', limit: 12, sort: 'popular' }),
        api.get('/products', { module: 'grocery', limit: 8, sort: 'popular' }),
        api.get('/restaurants', { limit: 8 }),
      ]);
      const fg = featuredWrap.querySelector('.grid'); if (fg) fg.remove();
      if (items.length) featuredWrap.append(h('div', { class: 'grid grid-products' }, ...items.map(ProductCard)));
      else featuredWrap.append(emptyState({ title: 'Nothing yet', desc: 'Check back soon.' }));

      const gg = groceryWrap.querySelector('.grid'); if (gg) gg.remove();
      if (gItems.length) groceryWrap.append(h('div', { class: 'grid grid-products' }, ...gItems.map(ProductCard)));
      else groceryWrap.append(emptyState({ title: 'Grocery coming soon' }));

      const fgr = foodWrap.querySelector('.grid'); if (fgr) fgr.remove();
      if (food.length) foodWrap.append(h('div', { class: 'grid grid-cards' }, ...food.map(RestaurantCard)));
      else foodWrap.append(emptyState({ title: 'Restaurants coming soon' }));
    } catch (err) {
      const msg = err.message;
      [featuredWrap, groceryWrap, foodWrap].forEach((w) => {
        const g = w.querySelector('.grid'); if (g) g.remove();
        w.append(errorState(msg, () => location.reload()));
      });
    }
  })();

  return main;
}

export function RestaurantCard(r) {
  return h('a', { class: 'card', href: '#/food/' + r.slug, style: { textDecoration: 'none', color: 'inherit', display: 'block' } },
    h('div', { class: 'product-thumb', style: { aspectRatio: '16/9' } }, h('span', { style: { fontSize: '34px' } }, '🍴')),
    h('div', { class: 'product-body' },
      h('div', { class: 'product-name' }, r.name),
      h('div', { class: 'product-meta' }, (r.cuisine || '') + ' · ★ ' + (r.rating || '—')),
      h('div', { class: 'product-meta' }, money(r.delivery_fee) + ' delivery · ' + (r.eta_minutes || 30) + ' min')));
}
