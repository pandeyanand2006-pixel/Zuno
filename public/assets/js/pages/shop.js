import { h, money, skeletonGrid, emptyState, errorState, toast } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

const SORTS = [
  { v: 'popular', l: 'Popular' },
  { v: 'price_low', l: 'Price: Low to High' },
  { v: 'price_high', l: 'Price: High to Low' },
  { v: 'rating', l: 'Top rated' },
  { v: 'newest', l: 'Newest' },
];

function Listing({ module, title, icon }) {
  const query = routerQuery();
  let page = 1;
  const grid = h('div', { class: 'grid grid-products' });
  const sidebar = h('aside', { class: 'sidebar', style: { position: 'static' } });
  const sortSel = h('select', { class: 'select', onchange: () => reload() }, ...SORTS.map((s) => h('option', { value: s.v }, s.l)));
  sortSel.value = query.sort || 'popular';
  const titleEl = h('h1', { style: { marginBottom: '4px' } }, (icon ? icon + ' ' : '') + title);
  const countEl = h('div', { class: 'muted text-sm', style: { marginBottom: 'var(--sp-4)' } }, '');

  const main = h('div', { class: 'container section' }, titleEl, countEl,
    h('div', { class: 'split', style: { gridTemplateColumns: '240px 1fr' } }, sidebar, h('div', {}, h('div', { class: 'row between', style: { marginBottom: '16px' } }, h('div', { class: 'pill-row' }, sortSel), searchInline()), grid)));

  loadCategories();
  reload();

  async function loadCategories() {
    try {
      const { categories } = await api.get('/categories', { module });
      sidebar.innerHTML = '';
      sidebar.append(h('div', { class: 'fw-600 text-sm', style: { padding: '8px 10px' } }, 'Categories'));
      sidebar.append(catLink(null, 'All ' + title));
      categories.forEach((c) => {
        sidebar.append(catLink(c.id, c.icon ? c.icon + ' ' + c.name : c.name));
        (c.children || []).forEach((ch) => sidebar.append(catLink(ch.id, '   ' + ch.name)));
      });
    } catch {}
  }

  function catLink(id, label) {
    const active = (query.category || '') === String(id || '');
    return h('a', { href: `#/${module}?category=${id || ''}`, class: 'cat-link' + (active ? ' active' : ''), style: { display: 'block', padding: '8px 10px', borderRadius: 'var(--r-md)', color: active ? 'var(--zuno-primary)' : 'var(--ink-700)', fontWeight: active ? '700' : '600', fontSize: 'var(--fs-sm)', textDecoration: 'none' } }, label);
  }

  function searchInline() {
    const inp = h('input', { class: 'input', placeholder: 'Search in ' + title.toLowerCase() + '…', value: query.search || '', style: { maxWidth: '280px' } });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const q = inp.value.trim(); location.hash = `#/${module}?search=${encodeURIComponent(q)}`; } });
    return inp;
  }

  async function reload() {
    const q = routerQuery();
    grid.innerHTML = ''; grid.append(skeletonGrid(8));
    try {
      const { items, total } = await api.get('/products', { module, category: q.category || undefined, search: q.search || undefined, sort: q.sort || 'popular', page: 1, limit: 36 });
      grid.innerHTML = '';
      countEl.textContent = total + ' items';
      if (!items.length) grid.append(emptyState({ icon: '🔍', title: 'No results', desc: 'Try a different category or search term.' }));
      else grid.append(...items.map(ProductCard));
    } catch (err) {
      grid.innerHTML = ''; grid.append(errorState(err.message, reload));
    }
  }

  // keep sort in sync with query when hash changes
  sortSel.addEventListener('change', () => { const q = routerQuery(); location.hash = `#/${module}?sort=${sortSel.value}${q.category ? '&category=' + q.category : ''}${q.search ? '&search=' + encodeURIComponent(q.search) : ''}`; });

  return main;
}

function routerQuery() {
  const h2 = location.hash.slice(1).split('?')[1] || '';
  const q = {}; new URLSearchParams(h2).forEach((v, k) => { q[k] = v; }); return q;
}

export function Shop() { return Listing({ module: 'shop', title: 'Shop', icon: '🛒' }); }
export function Grocery() { return Listing({ module: 'grocery', title: 'Grocery', icon: '🥦' }); }
