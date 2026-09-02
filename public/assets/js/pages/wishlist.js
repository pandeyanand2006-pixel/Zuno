import { h, toast, emptyState, money, productImage } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

export async function Wishlist() {
  const root = h('div', { class: 'container section' });
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in to see wishlist', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }
  const header = h('div', { class: 'row between', style: { alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' } },
    h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 } }, 'Wishlist'),
    h('div', { class: 'row gap-2' },
      h('span', { class: 'muted text-sm', id: 'wish-count' }, ''),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
        if (!confirm('Move all to bag?')) return;
        const { items } = await api.get('/wishlist');
        for (const it of items) {
          try { await api.post('/cart/items?module=shop', { productId: it.productId, quantity: 1 }); } catch {}
        }
        await refreshCart(); toast('Moved all to bag', 'success'); location.reload();
      } }, 'Move all to bag')));
  root.append(header);
  const grid = h('div', { class: 'grid grid-products' });
  root.append(grid);
  try {
    const { items } = await api.get('/wishlist');
    const countEl = header.querySelector('#wish-count');
    if (countEl) countEl.textContent = items.length ? `${items.length} saved` : '';
    if (!items.length) {
      grid.append(emptyState({ icon: '♡', title: 'Your wishlist is empty', desc: 'Tap the heart on any T-shirt to save it here. Your wishlist is saved to your account.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Discover T-shirts') }));
      return root;
    }
    // Fetch full product details for richer cards (price, MRP, colors)
    const detailed = await Promise.all(items.map(async (it) => {
      try { const { product } = await api.get('/products/' + it.slug); return { ...it, product }; } catch { return it; }
    }));
    detailed.forEach((it) => {
      const prod = it.product || it;
      const img = it.image || productImage({ name: it.name, module: 'shop' });
      const hasDiscount = prod.mrp && prod.mrp > prod.price;
      const card = h('div', { class: 'product-card', style: { textDecoration: 'none', color: 'inherit', position: 'relative' } },
        h('div', { class: 'product-thumb', style: { background: '#f5f5f3' } },
          h('button', { class: 'wish-btn active', type: 'button', title: 'Remove from wishlist', 'aria-label': 'Remove', style: { background: '#0a0a0a', color: '#fff' }, onclick: async (e) => {
            e.preventDefault(); const btn = e.currentTarget; btn.style.transform = 'scale(0.9)'; setTimeout(async () => { await Store.toggleWish(it.productId); toast('Removed', 'success'); location.reload(); }, 120);
          } }, '♥'),
          hasDiscount ? h('span', { class: 'product-badge', style: { background: '#0a0a0a' } }, Math.round(((prod.mrp - prod.price) / prod.mrp) * 100) + '% OFF') : null,
          h('a', { href: '#/product/' + it.slug, style: { display: 'block', width: '100%', height: '100%' } }, h('img', { class: 'product-img', src: img, alt: it.name, loading: 'lazy' }))),
        h('div', { class: 'product-body' },
          h('a', { href: '#/product/' + it.slug, style: { color: 'inherit', textDecoration: 'none' } }, h('div', { class: 'product-name', style: { fontWeight: '700' } }, it.name)),
          h('div', { class: 'muted text-xs', style: { marginTop: '4px' } }, (prod.colors || []).slice(0, 3).join(' · ') || 'Premium cotton'),
          h('div', { class: 'row gap-2', style: { marginTop: '8px', alignItems: 'baseline' } },
            h('span', { class: 'price', style: { fontWeight: '800' } }, money(prod.price || it.price)),
            hasDiscount ? h('span', { class: 'strike text-xs' }, money(prod.mrp)) : null),
          h('div', { class: 'row gap-2', style: { marginTop: '12px' } },
            h('button', { class: 'btn btn-primary btn-sm', style: { flex: '1' }, type: 'button', onclick: async () => {
              try {
                // Try with first available variant
                const variant = prod.colors && prod.sizes ? { color: prod.colors[0], size: prod.sizes[1] || prod.sizes[0] } : null;
                const payload = variant ? { productId: it.productId, quantity: 1, variant } : { productId: it.productId, quantity: 1 };
                await api.post('/cart/items?module=shop', payload); await refreshCart(); toast('Added to bag', 'success');
              } catch (e) { toast(e.message, 'error'); }
            } }, 'Add to bag'),
            h('a', { class: 'btn btn-ghost btn-sm', href: '#/product/' + it.slug }, 'View'))));
      // Subtle hover animation
      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = 'var(--shadow-md)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = 'none'; card.style.boxShadow = 'none'; });
      card.style.transition = 'transform var(--dur), box-shadow var(--dur)';
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
    else notifications.forEach((n) => list.append(h('div', { class: 'card card-pad', style: { opacity: n.read ? '0.7' : '1', borderLeft: n.read ? '' : '4px solid var(--Zuno-primary)' } },
      h('div', { class: 'fw-600' }, n.title), n.body && h('div', { class: 'muted text-sm' }, n.body), h('div', { class: 'muted text-xs', style: { marginTop: '4px' } }, new Date(n.created_at).toLocaleString('en-IN')))));
  } catch (e) { toast(e.message, 'error'); }
  return root;
}
