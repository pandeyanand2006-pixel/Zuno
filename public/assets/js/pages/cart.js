import { h, money, toast, emptyState, productImage } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

export async function Cart() {
  const root = h('div', { class: 'container section' });
  root.append(h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' } }, 'Your bag'));
  if (!Store.isAuthed()) return renderGuest(root);
  return renderAuthed(root);
}

function renderAuthed(root) {
  const list = h('div', { class: 'col gap-3' });
  const summaryBox = h('div', { class: 'card card-pad elevated', style: { position: 'sticky', top: 'calc(var(--nav-h) + 16px)' } });
  const main = h('div', { class: 'split' }, h('div', {}, list), h('div', {}, summaryBox));
  root.append(main);

  const summaryPromise = api.get('/cart/summary').then((s) => { Store.setCart(s); return s; });

  async function render() {
    const s = await summaryPromise;
    const cart = s.shop;
    list.innerHTML = '';
    if (!cart || !cart.items.length) {
      list.append(emptyState({ icon: '◧', title: 'Your bag is empty', desc: 'Add your favourite T-shirts and shirts — and create your own in the Custom Studio.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Start shopping') }));
    } else {
      cart.items.forEach((it) => list.append(cartRow(it, 'shop')));
    }
    const subtotal = cart ? cart.subtotal : 0;
    const count = cart ? cart.items.reduce((a, b) => a + b.quantity, 0) : 0;
    summaryBox.innerHTML = '';
    summaryBox.append(
      h('h3', {}, 'Order summary'),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', { class: 'fw-600' }, money(subtotal))),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Shipping'), h('span', { class: 'muted' }, subtotal > 99900 ? 'Free' : money(0))),
      h('p', { class: 'muted text-sm' }, count + ' item(s)'),
      h('div', { class: 'divider' }),
      h('button', { class: 'btn btn-primary btn-block btn-lg', disabled: !cart || !cart.items.length, onclick: () => { location.hash = '#/checkout?module=shop'; } }, 'Proceed to checkout'),
      h('p', { class: 'muted text-xs center', style: { marginTop: '10px' } }, 'Secure checkout via Razorpay')
    );
  }

  function cartRow(it, module) {
    const variantLabel = it.variant ? `${it.variant.color || ''} · ${it.variant.size || ''} ${it.variant.fit ? '· ' + it.variant.fit : ''}`.replace(/^ · | · $/g, '').trim() : '';
    const isCustom = !!it.isCustom || !!it.customization;
    const customPreview = isCustom ? h('div', { class: 'muted text-xs', style: { marginTop: '4px', padding: '6px 8px', background: 'var(--ink-50)', borderRadius: '6px' } },
      h('div', { class: 'fw-600', style: { color: 'var(--ink-800)' } }, 'Custom design'),
      it.customization ? h('div', {}, `${(it.customization.front?.elements?.length || 0)} front · ${(it.customization.back?.elements?.length || 0)} back`) : null,
      h('a', { href: '#/customize', class: 'text-xs', style: { color: 'var(--ink-900)', textDecoration: 'underline' } }, 'Edit design')
    ) : null;

    const qty = h('input', { class: 'input', type: 'number', min: '1', value: String(it.quantity), style: { width: '64px' } });
    qty.addEventListener('change', async () => {
      const q = Math.max(1, Number(qty.value) || 1);
      if (isCustom) {
        toast('Custom items: remove and re-add to change quantity', 'warning');
        qty.value = String(it.quantity);
        return;
      }
      await api.put('/cart/items/' + it.productId + '?module=' + module, { quantity: q });
      await refreshCart();
      // Re-fetch summary
      const s = await api.get('/cart/summary'); Store.setCart(s); render();
    });

    return h('div', { class: 'card', style: { display: 'flex', gap: '16px', padding: '16px', alignItems: 'flex-start' } },
      h('div', { class: 'product-thumb', style: { width: '96px', aspectRatio: '1/1', flexShrink: '0', background: '#f5f5f3' } },
        h('img', { class: 'product-img', src: it.image || productImage({ name: it.name, module: 'shop' }), alt: it.name })),
      h('div', { class: 'grow', style: { minWidth: '0' } },
        h('a', { href: '#/product/' + it.slug, style: { fontWeight: '700', color: 'var(--ink-900)', fontSize: 'var(--fs-md)' } }, it.name),
        variantLabel ? h('div', { class: 'muted text-sm', style: { marginTop: '4px' } }, variantLabel) : null,
        customPreview,
        h('div', { class: 'row gap-2', style: { marginTop: '8px', alignItems: 'center' } },
          h('span', { class: 'price', style: { fontWeight: '700' } }, money(it.price)),
          it.mrp > it.price ? h('span', { class: 'strike text-sm' }, money(it.mrp)) : null),
        h('div', { class: 'muted text-xs', style: { marginTop: '4px' } }, it.available ? 'In stock' : 'Unavailable')),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' } },
        qty,
        h('div', { class: 'fw-600' }, money(it.lineTotal)),
        h('button', { class: 'btn btn-ghost btn-sm', style: { color: 'var(--zuno-danger)', fontSize: 'var(--fs-xs)' }, onclick: async () => {
          await api.del('/cart/items/' + it.productId + '?module=' + module);
          await refreshCart();
          const s = await api.get('/cart/summary'); Store.setCart(s); render();
        } }, 'Remove')));
  }

  render();
  return root;
}

function renderGuest(root) {
  const guest = Store.getGuest().filter(i => i.module === 'shop' || !i.module);
  const list = h('div', { class: 'col gap-3' });
  const summaryBox = h('div', { class: 'card card-pad elevated' });
  const main = h('div', { class: 'split' }, h('div', {}, list), h('div', {}, summaryBox));
  root.append(
    h('div', { class: 'card', style: { padding: '12px 16px', background: 'var(--ink-50)', border: '1px solid var(--ink-100)', marginBottom: '16px' } },
      h('span', { class: 'muted text-sm' }, 'You’re browsing as a guest — '), h('a', { href: '#/login', style: { fontWeight: '700' } }, 'sign in'), h('span', { class: 'muted text-sm' }, ' to save your bag.')),
    main);

  function render() {
    const items = Store.getGuest().filter(i => i.module === 'shop' || !i.module);
    list.innerHTML = '';
    if (!items.length) {
      list.append(emptyState({ icon: '◧', title: 'Your bag is empty', desc: 'Add your favourite T-shirts and shirts — and create your own in the Custom Studio.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Start shopping') }));
    } else {
      items.forEach(it => list.append(guestRow(it)));
    }
    const subtotal = items.reduce((a, b) => a + b.price * b.quantity, 0);
    summaryBox.innerHTML = '';
    summaryBox.append(
      h('h3', {}, 'Order summary'),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', { class: 'fw-600' }, money(subtotal))),
      h('p', { class: 'muted text-sm' }, items.reduce((a, b) => a + b.quantity, 0) + ' item(s)'),
      h('div', { class: 'divider' }),
      h('a', { class: 'btn btn-primary btn-block btn-lg', href: '#/login' }, 'Sign in to checkout')
    );
  }

  function guestRow(it) {
    const variantLabel = it.variant ? `${it.variant.color || ''} · ${it.variant.size || ''}`.trim() : '';
    const isCustom = !!it.isCustom;
    const qty = h('input', { class: 'input', type: 'number', min: '1', value: String(it.quantity), style: { width: '64px' } });
    qty.addEventListener('change', () => { Store.setGuestQty(it.productId, Math.max(1, Number(qty.value) || 1)); render(); });
    return h('div', { class: 'card', style: { display: 'flex', gap: '16px', padding: '16px', alignItems: 'flex-start' } },
      h('div', { class: 'product-thumb', style: { width: '96px', aspectRatio: '1/1', flexShrink: '0', background: '#f5f5f3' } },
        h('img', { class: 'product-img', src: it.image || productImage({ name: it.name, module: 'shop' }), alt: it.name })),
      h('div', { class: 'grow' },
        h('a', { href: '#/product/' + it.slug, style: { fontWeight: '700', color: 'var(--ink-900)' } }, it.name),
        variantLabel ? h('div', { class: 'muted text-sm' }, variantLabel) : null,
        isCustom ? h('div', { class: 'muted text-xs', style: { marginTop: '4px', padding: '6px 8px', background: 'var(--ink-50)', borderRadius: '6px' } }, 'Custom design') : null,
        h('div', { class: 'price', style: { marginTop: '8px', fontWeight: '700' } }, money(it.price))),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' } },
        qty,
        h('div', { class: 'fw-600' }, money(it.price * it.quantity)),
        h('button', { class: 'btn btn-ghost btn-sm', style: { color: 'var(--zuno-danger)' }, onclick: () => { Store.removeGuestItem(it.productId); render(); } }, 'Remove')));
  }

  render();
  return root;
}
