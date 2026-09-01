import { h, money, emptyState } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

export async function Search({ query }) {
  const q = query.q || '';
  const root = h('div', { class: 'container section' });
  root.append(h('h1', {}, 'Search results'), h('p', { class: 'muted' }, 'For “' + q + '”'));
  const grid = h('div', { class: 'grid grid-products' });
  root.append(grid);
  if (!q) { grid.append(emptyState({ icon: '🔍', title: 'Type to search', desc: 'Try “iPhone”, “milk”, “pizza”, “AC repair”.' })); return root; }
  try {
    const { items } = await api.get('/products', { search: q, limit: 40 });
    if (!items.length) grid.append(emptyState({ icon: '🔍', title: 'No matches', desc: 'Try a broader term or another category.' }));
    else grid.append(...items.map(ProductCard));
  } catch (e) { grid.append(emptyState({ icon: '⚠️', title: 'Search failed', desc: e.message })); }
  return root;
}
