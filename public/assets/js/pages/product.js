import { h, money, toast, emptyState, errorState, skeletonGrid, productImage } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { ProductCard, refreshCart } from '../components.js';

export async function Product({ params }) {
  const root = h('div', { class: 'container section' });
  root.append(h('div', { class: 'sk-card skeleton', style: { height: '360px' } }));
  try {
    const { product } = await api.get('/products/' + params.slug);
    root.innerHTML = '';
    const gallery = h('div', { class: 'pdp-gallery' }, h('img', { class: 'pdp-img', src: (product.images && product.images[0]) || productImage(product), alt: product.name }));
    const specs = product.specs && Object.keys(product.specs).length
      ? h('div', { class: 'card card-pad', style: { marginTop: '16px' } },
          h('h3', {}, 'Specifications'),
          h('table', { class: 'table' }, ...Object.entries(product.specs).map(([k, v]) => h('tr', {}, h('td', { class: 'muted' }, k), h('td', {}, String(v))))))
      : null;

    const qty = h('input', { class: 'input', type: 'number', min: '1', max: String(product.stock || 1), value: '1', style: { width: '80px' } });
    const addBtn = h('button', { class: 'btn btn-outline btn-lg', onclick: () => add(Number(qty.value)) }, 'Add to cart');
    const buyBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: async () => { await add(Number(qty.value)); location.hash = '#/cart'; } }, 'Buy now');
    const wished = Store.isWished(product.id);
    const wishBtn = h('button', { class: 'btn btn-ghost btn-lg' + (wished ? ' active' : ''), onclick: async () => { await Store.toggleWish(product.id); const w = Store.isWished(product.id); wishBtn.textContent = w ? '♥ Saved' : '♡ Save'; wishBtn.classList.toggle('active', w); } }, wished ? '♥ Saved' : '♡ Save');

    const info = h('div', {},
      h('div', { class: 'pill-row', style: { marginBottom: '8px' } }, product.module === 'grocery' ? h('span', { class: 'badge badge-info' }, 'Grocery') : h('span', { class: 'badge badge-info' }, 'Shop')),
      h('h1', { style: { marginTop: '0' } }, product.name),
      h('div', { class: 'row gap-2', style: { marginBottom: '12px' } }, h('span', { class: 'price', style: { fontSize: 'var(--fs-2xl)' } }, money(product.price)), product.discountPercent > 0 && h('span', { class: 'strike' }, money(product.mrp)), product.discountPercent > 0 && h('span', { class: 'discount' }, product.discountPercent + '% OFF')),
      h('div', { class: 'muted text-sm' }, '★ ' + (product.rating || '—') + ' · ' + (product.ratingCount || 0) + ' ratings'),
      h('p', { style: { marginTop: '12px' } }, product.description || ''),
      h('div', { class: 'divider' }),
      h('div', { class: 'row gap-3', style: { alignItems: 'center', marginBottom: '12px' } }, h('span', { class: 'fw-600' }, 'Quantity'), qty),
      h('div', { class: 'row gap-3 wrap' }, addBtn, buyBtn, wishBtn),
      h('p', { class: 'muted text-sm', style: { marginTop: '12px' } }, product.stock > 0 ? '✓ In stock · Delivery in 2–4 days · 7-day easy returns' : 'Out of stock'),
      specs);

    const related = product.related && product.related.length
      ? h('div', { class: 'section' }, h('h2', {}, 'Related products'), h('div', { class: 'grid grid-products' }, ...product.related.map(ProductCard)))
      : null;

    root.append(h('div', { class: 'pdp' }, gallery, info));
    if (related) root.append(related);
    return root;
  } catch (err) {
    root.innerHTML = '';
    if (err.status === 404) root.append(emptyState({ icon: '🔍', title: 'Product not found', desc: 'This item may no longer be available.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Back to Shop') }));
    else root.append(errorState(err.message, () => location.reload()));
    return root;
  }

  async function add(qty) {
    if (!Store.isAuthed()) {
      Store.addGuestItem({ productId: product.id, name: product.name, price: product.price, mrp: product.mrp, slug: product.slug, image: (product.images && product.images[0]) || productImage(product), module: product.module || 'shop', quantity: qty });
      toast('Added to cart', 'success'); return;
    }
    try { await api.post('/cart/items?module=' + (product.module || 'shop'), { productId: product.id, quantity: qty }); await refreshCart(); toast('Added to cart', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }
}
