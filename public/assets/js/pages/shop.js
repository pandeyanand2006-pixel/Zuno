import { h, money, skeletonGrid, emptyState, errorState, modal } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

const SORTS = [
  { v: 'popular', l: 'Popular' },
  { v: 'newest', l: 'Newest' },
  { v: 'price_low', l: 'Price: Low to High' },
  { v: 'price_high', l: 'Price: High to Low' },
  { v: 'rating', l: 'Top rated' },
];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const COLORS = [
  { key: 'black', bg: '#0a0a0a' }, { key: 'white', bg: '#ffffff' }, { key: 'beige', bg: '#e8e6e1' },
  { key: 'grey', bg: '#a3a3a3' }, { key: 'navy', bg: '#1e293b' }, { key: 'olive', bg: '#556b2f' },
  { key: 'charcoal', bg: '#2a2a2a' }, { key: 'red', bg: '#dc2626' },
];
const FITS = ['regular', 'oversized', 'relaxed'];
const COLLECTIONS = ['Essentials', 'After Dark', 'Street Form'];

function Shop() {
  const query = routerQuery();
  const grid = h('div', { class: 'grid grid-products' });
  const countEl = h('div', { class: 'muted text-sm' }, '');
  const sortSel = h('select', { class: 'input', style: { maxWidth: '200px' }, onchange: () => applySort() },
    ...SORTS.map(s => h('option', { value: s.v, selected: (query.sort || 'popular') === s.v }, s.l)));

  const activeCategory = query.category || '';
  const activeSize = query.size || '';
  const activeColor = query.color || '';
  const activeFit = query.fit || '';
  const activeCollection = query.collection || '';

  // Sidebar
  const sidebar = h('aside', { class: 'sidebar shop-sidebar', style: { position: 'static' } });

  async function loadSidebar() {
    sidebar.innerHTML = '';
    sidebar.append(
      h('div', { class: 'fw-600', style: { padding: '10px', fontSize: 'var(--fs-sm)', letterSpacing: '0.06em', textTransform: 'uppercase' } }, 'Filters'),
      h('button', { class: 'btn btn-ghost btn-sm', style: { marginBottom: '12px' }, onclick: () => { location.hash = '#/shop'; } }, 'Clear all')
    );
    // Categories
    try {
      const { categories } = await api.get('/categories', { module: 'shop' });
      const topCats = categories.filter(c => !c.parent_id);
      sidebar.append(h('div', { class: 'filter-group' }, h('div', { class: 'filter-title' }, 'Category')));
      topCats.forEach(cat => {
        const isActive = activeCategory === cat.slug || activeCategory === String(cat.id);
        sidebar.append(h('a', { href: `#/shop?category=${cat.slug}`, class: 'filter-link' + (isActive ? ' active' : '') }, cat.name));
        (cat.children || []).forEach(ch => {
          const chActive = activeCategory === ch.slug || activeCategory === String(ch.id);
          sidebar.append(h('a', { href: `#/shop?category=${ch.slug}`, class: 'filter-link sub' + (chActive ? ' active' : '') }, '— ' + ch.name));
        });
      });
    } catch {}

    // Size
    sidebar.append(h('div', { class: 'filter-group', style: { marginTop: '16px' } }, h('div', { class: 'filter-title' }, 'Size')));
    const sizeRow = h('div', { class: 'row gap-2 wrap' });
    SIZES.forEach(s => {
      sizeRow.append(h('a', { href: updateQuery({ size: s }), class: 'chip' + (activeSize === s ? ' active' : '') }, s));
    });
    sidebar.append(sizeRow);

    // Color
    sidebar.append(h('div', { class: 'filter-group', style: { marginTop: '16px' } }, h('div', { class: 'filter-title' }, 'Color')));
    const colorRow = h('div', { class: 'row gap-2 wrap' });
    COLORS.forEach(c => {
      const isActive = activeColor === c.key;
      colorRow.append(h('a', {
        href: updateQuery({ color: c.key }),
        class: 'color-swatch' + (isActive ? ' active' : ''),
        title: c.key, style: { background: c.bg, borderColor: c.key === 'white' ? '#e5e5e5' : c.bg, width: '28px', height: '28px' }
      }));
    });
    sidebar.append(colorRow);

    // Fit
    sidebar.append(h('div', { class: 'filter-group', style: { marginTop: '16px' } }, h('div', { class: 'filter-title' }, 'Fit')));
    FITS.forEach(f => {
      const isActive = activeFit === f;
      sidebar.append(h('a', { href: updateQuery({ fit: f }), class: 'filter-link' + (isActive ? ' active' : '') }, f));
    });

    // Collection
    sidebar.append(h('div', { class: 'filter-group', style: { marginTop: '16px' } }, h('div', { class: 'filter-title' }, 'Collection')));
    COLLECTIONS.forEach(col => {
      const isActive = activeCollection === col;
      sidebar.append(h('a', { href: updateQuery({ collection: col }), class: 'filter-link' + (isActive ? ' active' : '') }, col));
    });
  }

  function updateQuery(patch) {
    const q = { ...routerQuery(), ...patch };
    // Toggle off if same value
    for (const [k, v] of Object.entries(patch)) {
      if (routerQuery()[k] === v) q[k] = '';
    }
    const clean = Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `#/shop${clean ? '?' + clean : ''}`;
  }
  function applySort() {
    const q = routerQuery();
    q.sort = sortSel.value;
    const clean = Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    location.hash = `#/shop${clean ? '?' + clean : ''}`;
  }

  // Mobile filter button
  const filterBtn = h('button', { class: 'btn btn-outline filter-mobile-btn', onclick: () => openMobileFilters() }, '⚙ Filter');

  const header = h('div', { class: 'row between', style: { marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap', gap: '12px' } },
    h('div', {}, h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 } }, 'Shop'), countEl),
    h('div', { class: 'row gap-3', style: { alignItems: 'center', flexWrap: 'wrap' } },
      filterBtn, h('span', { class: 'muted text-sm desktop-only', style: { } }, 'Sort by'), sortSel));

  function openMobileFilters() {
    const { modal } = requireModal();
    // Build filter sheet content cloned from sidebar logic
    const sheet = h('div', { style: { maxHeight: '78vh', overflowY: 'auto', paddingRight: '4px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', position: 'sticky', top: '0', background: '#fff', padding: '8px 0', zIndex: '1' } },
        h('h3', { style: { margin: '0', color: '#0f172a' } }, 'Filters'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { document.querySelector('.overlay')?.remove(); } }, '✕')),
      h('div', { style: { display: 'flex', gap: '8px', marginBottom: '16px' } },
        h('a', { href: '#/shop', class: 'btn btn-ghost btn-sm', style: { flex: '1', justifyContent: 'center' }, onclick: () => { document.querySelector('.overlay')?.remove(); } }, 'Clear All'),
        h('button', { class: 'btn btn-primary btn-sm', style: { flex: '1', justifyContent: 'center' }, onclick: () => { document.querySelector('.overlay')?.remove(); } }, 'Apply')))
    ;
    // Clone filter groups into sheet (reuse same data)
    (async () => {
      try {
        const { categories } = await api.get('/categories', { module: 'shop' });
        const topCats = categories.filter(c => !c.parent_id);
        const catGroup = h('div', { style: { marginBottom: '16px' } }, h('div', { style: { fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Category'));
        topCats.forEach(cat => {
          const isActive = activeCategory === cat.slug || activeCategory === String(cat.id);
          catGroup.append(h('a', { href: `#/shop?category=${cat.slug}`, class: 'filter-link' + (isActive ? ' active' : ''), style: { display: 'block' }, onclick: () => { setTimeout(() => document.querySelector('.overlay')?.remove(), 100); } }, cat.name));
          (cat.children || []).forEach(ch => {
            const chActive = activeCategory === ch.slug || activeCategory === String(ch.id);
            catGroup.append(h('a', { href: `#/shop?category=${ch.slug}`, class: 'filter-link sub' + (chActive ? ' active' : ''), onclick: () => { setTimeout(() => document.querySelector('.overlay')?.remove(), 100); } }, '— ' + ch.name));
          });
        });
        sheet.insertBefore(catGroup, sheet.lastChild);
      } catch {}
    })();
    // Size
    {
      const sizeGroup = h('div', { style: { marginBottom: '16px' } },
        h('div', { style: { fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Size'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' } },
          ...SIZES.map(s => h('a', { href: updateQuery({ size: s }), class: 'chip' + (activeSize === s ? ' active' : ''), style: { justifyContent: 'center', padding: '10px', fontSize: '13px' }, onclick: () => { setTimeout(() => document.querySelector('.overlay')?.remove(), 100); } }, s))));
      sheet.insertBefore(sizeGroup, sheet.lastChild);
    }
    // Color
    {
      const colorGroup = h('div', { style: { marginBottom: '16px' } },
        h('div', { style: { fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Color'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' } },
          ...COLORS.map(c => {
            const isActive = activeColor === c.key;
            return h('a', { href: updateQuery({ color: c.key }), title: c.key, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none', padding: '8px', borderRadius: '8px', background: isActive ? '#f1f5f9' : '#fff', border: isActive ? '2px solid #1e40af' : '1px solid #e2e8f0' }, onclick: () => { setTimeout(() => document.querySelector('.overlay')?.remove(), 100); } },
              h('span', { style: { width: '28px', height: '28px', borderRadius: '50%', background: c.bg, border: c.key === 'white' ? '1px solid #e5e5e5' : 'none', display: 'block' } }),
              h('span', { style: { fontSize: '10px', color: '#334155', fontWeight: '600', textTransform: 'capitalize' } }, c.key));
          })));
      sheet.insertBefore(colorGroup, sheet.lastChild);
    }
    // Fit
    {
      const fitGroup = h('div', { style: { marginBottom: '16px' } },
        h('div', { style: { fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Fit'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } },
          ...FITS.map(f => {
            const isActive = activeFit === f;
            return h('a', { href: updateQuery({ fit: f }), class: 'filter-link' + (isActive ? ' active' : ''), style: { textAlign: 'center', padding: '10px', justifyContent: 'center' }, onclick: () => { setTimeout(() => document.querySelector('.overlay')?.remove(), 100); } }, f);
          })));
      sheet.insertBefore(fitGroup, sheet.lastChild);
    }
    // Collection
    {
      const collGroup = h('div', { style: { marginBottom: '8px' } },
        h('div', { style: { fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Collection'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
          ...COLLECTIONS.map(col => {
            const isActive = activeCollection === col;
            return h('a', { href: updateQuery({ collection: col }), class: 'chip' + (isActive ? ' active' : ''), style: { padding: '8px 14px' }, onclick: () => { setTimeout(() => document.querySelector('.overlay')?.remove(), 100); } }, col);
          })));
      sheet.insertBefore(collGroup, sheet.lastChild);
    }
    modal(sheet);
  }

  const main = h('div', { class: 'container section' }, header,
    h('div', { class: 'split', style: { gridTemplateColumns: '260px 1fr' } }, sidebar, h('div', {}, grid)));

  loadSidebar();
  reload();

  async function reload() {
    const q = routerQuery();
    grid.innerHTML = ''; grid.append(skeletonGrid(8));
    try {
      const params = { module: 'shop', limit: 32, sort: q.sort || 'popular' };
      if (q.category) params.category = q.category;
      if (q.search) params.search = q.search;
      if (q.color) params.color = q.color;
      if (q.size) params.size = q.size;
      if (q.fit) params.fit = q.fit;
      if (q.collection) params.collection = q.collection;
      const { items, total } = await api.get('/products', params);
      grid.innerHTML = '';
      countEl.textContent = total + ' products';
      if (!items.length) grid.append(emptyState({ icon: '◐', title: 'No products found', desc: 'Try adjusting your filters.' }));
      else grid.append(...items.map(ProductCard));
    } catch (err) {
      grid.innerHTML = ''; grid.append(errorState(err.message, reload));
    }
  }

  return main;
}

function routerQuery() {
  const hash = location.hash.slice(1).split('?')[1] || '';
  const q = {}; new URLSearchParams(hash).forEach((v, k) => { q[k] = v; }); return q;
}

export { Shop };
export function Grocery() { location.hash = '#/shop'; return h('div', { class: 'container section' }, 'Redirecting…'); }
