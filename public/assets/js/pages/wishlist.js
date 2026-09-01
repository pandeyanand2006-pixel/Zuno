import { h, toast, emptyState, money, productImage } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

export async function Wishlist() {
  const root = h('div', { class: 'container section' });
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in to see wishlist', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }
  root.append(h('h1', {}, 'Wishlist'));
  const grid = h('div', { class: 'grid grid-products' });
  root.append(grid);
  try {
    const { items } = await api.get('/wishlist');
    if (!items.length) {
      grid.append(emptyState({ icon: '♥', title: 'Your wishlist is empty', desc: 'Tap the heart on any product to save it here.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Browse products') }));
      return root;
    }
    items.forEach((it) => {
      const img = it.image || productImage({ name: it.name, module: it.module });
      const card = h('div', { class: 'product-card', style: { textDecoration: 'none', color: 'inherit' } },
        h('div', { class: 'product-thumb' },
          h('button', { class: 'wish-btn active', type: 'button', title: 'Remove from wishlist', 'aria-label': 'Remove from wishlist', onclick: async () => { await Store.toggleWish(it.productId); location.reload(); } }, '♥'),
          h('img', { class: 'product-img', src: img, alt: it.name, loading: 'lazy' })),
        h('div', { class: 'product-body' },
          h('div', { class: 'product-name' }, it.name),
          h('div', { class: 'product-foot' },
            h('span', { class: 'price' }, money(it.price)),
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
              try { await api.post('/cart/items?module=' + (it.module || 'shop'), { productId: it.productId, quantity: 1 }); await refreshCart(); toast('Added to cart', 'success'); }
              catch (e) { toast(e.message, 'error'); }
            } }, 'Add to cart'))));
      grid.append(card);
    });
  } catch (e) { toast(e.message, 'error'); }
  return root;
}

export async function Notifications() {
  const root = h('div', { class: 'container-narrow section' });
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }
  root.append(h('div', { class: 'row between' }, h('h1', {}, 'Notifications'), h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await api.post('/notifications/read-all'); toast('Marked all read', 'success'); location.reload(); } }, 'Mark all read')));
  const list = h('div', { class: 'col gap-3' });
  root.append(list);
  try {
    const { notifications } = await api.get('/notifications');
    if (!notifications.length) list.append(emptyState({ icon: '🔔', title: 'No notifications', desc: 'We’ll let you know about orders, offers and more.' }));
    else notifications.forEach((n) => list.append(h('div', { class: 'card card-pad', style: { opacity: n.read ? '0.7' : '1', borderLeft: n.read ? '' : '4px solid var(--zuno-primary)' } },
      h('div', { class: 'fw-600' }, n.title), n.body && h('div', { class: 'muted text-sm' }, n.body), h('div', { class: 'muted text-xs', style: { marginTop: '4px' } }, new Date(n.created_at).toLocaleString('en-IN')))));
  } catch (e) { toast(e.message, 'error'); }
  return root;
}
