import { h, money, emptyState } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

export async function Search({ query }) {
  const q = query.q || '';
  const root = h('div', { class: 'container section' });
  root.append(h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' } }, 'Search'), q ? h('p', { class: 'muted' }, `For “${q}” — ${q ? 'T-shirts' : ''}`) : null);
  const grid = h('div', { class: 'grid grid-products' });
  // Quick suggestions for T-shirts
  const suggestions = h('div', { class: 'row gap-2 wrap', style: { marginBottom: '16px' } },
    ...['oversized', 'graphic', 'black tee', 'white tee', 'polo', 'heavyweight'].map(term =>
      h('a', { class: 'chip', href: '#/search?q=' + encodeURIComponent(term) }, term)));
  root.append(suggestions, grid);
  if (!q) {
    grid.append(emptyState({ icon: '◐', title: 'Search T-shirts', desc: 'Try “oversized black tee”, “graphic”, “polo”, “heavyweight”. All products are premium T-shirts.' }));
    return root;
  }
  try {
    const { items } = await api.get('/products', { module: 'shop', search: q, limit: 40 });
    if (!items.length) grid.append(emptyState({ icon: '◐', title: 'No matches', desc: `No T-shirts found for “${q}”. Try “oversized”, “graphic” or “ essential”.` , action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Browse all T-shirts') }));
    else {
      grid.append(h('div', { class: 'muted text-sm', style: { marginBottom: '12px', gridColumn: '1/-1' } }, `${items.length} products found`));
      grid.append(...items.map(ProductCard));
    }
  } catch (e) { grid.append(emptyState({ icon: '◐', title: 'Search failed', desc: e.message })); }
  return root;
}
