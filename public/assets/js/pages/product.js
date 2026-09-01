import { h, money, toast, emptyState, errorState, productImage, modal } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { ProductCard, refreshCart } from '../components.js';

export async function Product({ params }) {
  const root = h('div', { class: 'container section' });
  root.append(h('div', { class: 'skeleton', style: { height: '480px', borderRadius: '12px' } }));
  try {
    const { product } = await api.get('/products/' + params.slug);
    root.innerHTML = '';

    // ── Gallery ─────────────────────────────────────────────────
    const mainImg = h('img', { class: 'pdp-img', src: (product.images && product.images[0]) || productImage(product), alt: product.name });
    const thumbs = h('div', { class: 'pdp-thumbs', style: { display: 'flex', gap: '8px', marginTop: '12px' } });
    // Generate variant color thumbs if available
    (product.colors || []).slice(0, 6).forEach(col => {
      const sw = h('button', { type: 'button', class: 'color-swatch', style: { background: col === 'white' ? '#fff' : col, borderColor: col === 'white' ? '#e5e5e5' : col, width: '44px', height: '44px' }, title: col,
        onclick: () => { selectColor(col); } });
      thumbs.append(sw);
    });

    const gallery = h('div', { class: 'pdp-gallery' }, mainImg, thumbs.childNodes.length ? thumbs : null);

    // ── Variant state ────────────────────────────────────────────
    let selColor = (product.colors && product.colors[0]) || null;
    let selSize = null;
    let selFit = product.fit || 'regular';
    let qty = 1;

    const colorRow = h('div', { class: 'row gap-2 wrap', style: { marginTop: '8px' } });
    (product.colors || []).forEach(col => {
      const btn = h('button', {
        type: 'button',
        class: 'color-swatch' + (col === selColor ? ' active' : ''),
        style: { background: colorToBg(col), borderColor: colorToBg(col), width: '36px', height: '36px' },
        title: col,
        onclick: () => selectColor(col)
      });
      colorRow.append(btn);
    });
    function colorToBg(c) {
      const map = { black: '#0a0a0a', white: '#ffffff', beige: '#e8e6e1', charcoal: '#2a2a2a', grey: '#a3a3a3', navy: '#1e293b', olive: '#556b2f', red: '#dc2626', forest: '#14532d', sage: '#9caf88', 'light-blue': '#93c5fd', 'washed-black': '#1a1a1a' };
      return map[c] || c;
    }
    function selectColor(c) {
      selColor = c;
      colorRow.querySelectorAll('.color-swatch').forEach(b => b.classList.toggle('active', b.title === c));
      // Update gallery bg to reflect color (subtle)
      const tshirtPreview = gallery.querySelector('.pdp-img');
      if (tshirtPreview) tshirtPreview.style.filter = c === 'black' ? 'brightness(0.95)' : 'none';
      updateVariantInfo();
    }

    const sizeRow = h('div', { class: 'row gap-2 wrap', style: { marginTop: '8px' } });
    (product.sizes || ['S', 'M', 'L', 'XL']).forEach(s => {
      const btn = h('button', {
        type: 'button',
        class: 'btn btn-sm ' + (s === selSize ? 'btn-primary' : 'btn-ghost'),
        style: { minWidth: '44px', borderColor: s === selSize ? '#0a0a0a' : '' },
        onclick: () => selectSize(s)
      }, s);
      sizeRow.append(btn);
    });
    function selectSize(s) {
      selSize = s;
      sizeRow.querySelectorAll('button').forEach(b => {
        const isActive = b.textContent === s;
        b.className = 'btn btn-sm ' + (isActive ? 'btn-primary' : 'btn-ghost');
      });
      updateVariantInfo();
    }

    const fitInfo = product.fit ? h('div', { class: 'muted text-sm', style: { marginTop: '6px' } }, 'Fit: ' + product.fit) : null;

    const variantInfo = h('div', { class: 'muted text-sm', style: { marginTop: '8px', minHeight: '18px' } }, '');

    function updateVariantInfo() {
      if (!selColor || !selSize) {
        variantInfo.textContent = selColor && selSize ? '' : 'Select color and size';
        return;
      }
      const variant = (product.variants || []).find(v => v.color === selColor && v.size === selSize);
      if (variant) {
        variantInfo.textContent = variant.stock > 0 ? `✓ In stock · ${variant.stock} left` : 'Out of stock in this variant';
        variantInfo.style.color = variant.stock > 0 ? 'var(--zuno-success)' : 'var(--zuno-danger)';
      } else {
        variantInfo.textContent = '✓ Available';
        variantInfo.style.color = 'var(--zuno-success)';
      }
    }
    updateVariantInfo();

    const qtyInput = h('input', { class: 'input', type: 'number', min: '1', max: '10', value: '1', style: { width: '80px' } });
    qtyInput.addEventListener('input', () => { qty = Math.max(1, Math.min(10, Number(qtyInput.value) || 1)); });

    const sizeGuideBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: openSizeGuide }, 'Size guide');
    const wishBtn = h('button', {
      class: 'btn btn-ghost btn-lg' + (Store.isWished(product.id) ? ' active' : ''),
      type: 'button',
      onclick: async () => { await Store.toggleWish(product.id); const w = Store.isWished(product.id); wishBtn.textContent = w ? '♥ Saved' : '♡ Save'; wishBtn.classList.toggle('active', w); }
    }, Store.isWished(product.id) ? '♥ Saved' : '♡ Save');

    const addBtn = h('button', { class: 'btn btn-outline btn-lg', type: 'button', onclick: () => addToBag(false) }, 'Add to bag');
    const buyBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => addToBag(true) }, 'Buy now');

    async function addToBag(buyNow) {
      if (product.colors?.length && !selColor) { toast('Please select a color', 'warning'); return; }
      if (product.sizes?.length && !selSize) { toast('Please select a size', 'warning'); return; }
      const variant = selColor && selSize ? { color: selColor, size: selSize } : null;
      const q = Math.max(1, Math.min(10, Number(qtyInput.value) || 1));
      if (!Store.isAuthed()) {
        Store.addGuestItem({
          productId: product.id, name: product.name, price: product.price, mrp: product.mrp, slug: product.slug,
          image: (product.images && product.images[0]) || productImage(product), module: 'shop', quantity: q,
          variant, isCustom: false
        });
        toast('Added to bag', 'success');
        if (buyNow) location.hash = '#/cart';
        return;
      }
      try {
        await api.post('/cart/items?module=shop', { productId: product.id, quantity: q, variant });
        await refreshCart();
        toast('Added to bag', 'success');
        if (buyNow) location.hash = '#/cart';
      } catch (e) { toast(e.message, 'error'); }
    }

    function openSizeGuide() {
      const rows = [
        ['XS', '34"', '27"'], ['S', '36"', '28"'], ['M', '38"', '29"'], ['L', '40"', '30"'], ['XL', '42"', '31"'], ['XXL', '44"', '32"'], ['XXXL', '46"', '33"'],
      ];
      const table = h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Size'), h('th', {}, 'Chest'), h('th', {}, 'Length'))),
        h('tbody', {}, ...rows.map(([sz, ch, len]) => h('tr', {}, h('td', {}, sz), h('td', {}, ch), h('td', {}, len)))));
      const content = h('div', {},
        h('h3', { style: { fontFamily: 'var(--font-display)' } }, 'Size Guide'),
        h('p', { class: 'muted text-sm', style: { marginBottom: '12px' } }, 'Measurements in inches. For best fit, measure a well-fitting T-shirt.'),
        table,
        h('p', { class: 'muted text-xs', style: { marginTop: '12px' } }, 'Fit may vary by style. Oversized is intentionally larger — size down for a regular fit.'));
      modal(content);
    }

    const info = h('div', {},
      h('div', { class: 'muted text-sm', style: { letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '700' } }, 'ZUNO'),
      h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: '4px 0 8px', lineHeight: '1.1' } }, product.name),
      h('div', { class: 'muted text-sm' }, '★ ' + (product.rating || '—') + ' · ' + (product.ratingCount || 0) + ' ratings · ' + (product.collection || 'Essentials')),
      h('div', { class: 'row gap-2', style: { marginTop: '12px', alignItems: 'baseline' } },
        h('span', { style: { fontSize: 'var(--fs-2xl)', fontWeight: '800' } }, money(product.price)),
        product.mrp > product.price ? h('span', { class: 'strike' }, money(product.mrp)) : null,
        product.discountPercent ? h('span', { class: 'badge', style: { background: '#0a0a0a', color: '#fff' } }, product.discountPercent + '% OFF') : null),
      h('p', { class: 'muted', style: { marginTop: '12px', lineHeight: '1.6' } }, product.description || ''),
      h('div', { class: 'divider', style: { margin: '16px 0' } }),
      product.colors?.length ? h('div', {}, h('div', { class: 'row between', style: { alignItems: 'center' } }, h('span', { class: 'fw-600 text-sm', style: { letterSpacing: '0.04em', textTransform: 'uppercase' } }, 'Color: ' + (selColor || '')), h('span', { class: 'muted text-xs' }, (product.colors || []).length + ' colors')), colorRow) : null,
      product.sizes?.length ? h('div', { style: { marginTop: '16px' } }, h('div', { class: 'row between', style: { alignItems: 'center' } }, h('span', { class: 'fw-600 text-sm', style: { letterSpacing: '0.04em', textTransform: 'uppercase' } }, 'Size'), sizeGuideBtn), sizeRow, variantInfo, fitInfo) : null,
      h('div', { class: 'row gap-3', style: { marginTop: '16px', alignItems: 'center' } }, h('span', { class: 'fw-600 text-sm' }, 'Qty'), qtyInput),
      h('div', { class: 'row gap-3', style: { marginTop: '20px' } }, addBtn, buyBtn, wishBtn),
      h('p', { class: 'muted text-xs', style: { marginTop: '12px' } }, '✓ Free shipping over ₹999 · 7-day returns · Premium 240 GSM'),
      product.fabric ? h('div', { class: 'card card-pad', style: { marginTop: '20px', background: 'var(--ink-50)' } },
        h('h4', { style: { margin: '0 0 8px' } }, 'Fabric & Care'),
        h('div', { class: 'muted text-sm', style: { lineHeight: '1.6' } },
          h('div', {}, 'Fabric: ' + product.fabric),
          h('div', {}, product.careInstructions || 'Machine wash cold'),
          product.specs ? h('div', { style: { marginTop: '8px' } }, ...Object.entries(product.specs).slice(0, 4).map(([k, v]) => h('div', {}, h('span', { class: 'fw-600' }, k + ': '), String(v)))) : null)) : null
    );

    const details = h('div', { class: 'section', style: { marginTop: '32px' } },
      h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '16px' } },
        h('div', { class: 'card card-pad' }, h('h4', {}, 'Shipping'), h('p', { class: 'muted text-sm', style: { marginTop: '8px', lineHeight: '1.6' } }, 'Free standard shipping on orders over ₹999. Express 2-3 days available at checkout.')),
        h('div', { class: 'card card-pad' }, h('h4', {}, 'Returns'), h('p', { class: 'muted text-sm', style: { marginTop: '8px', lineHeight: '1.6' } }, '7-day easy returns. Custom printed items are made to order and cannot be returned unless defective.'))));

    const related = product.related?.length
      ? h('div', { class: 'section' }, h('div', { class: 'section-title fashion' }, h('h2', {}, 'You may also like')), h('div', { class: 'grid grid-products' }, ...product.related.map(ProductCard)))
      : null;

    root.append(h('div', { class: 'pdp' }, gallery, info));
    root.append(details);
    if (related) root.append(related);
    return root;
  } catch (err) {
    root.innerHTML = '';
    if (err.status === 404) root.append(emptyState({ icon: '◐', title: 'Product not found', desc: 'This item is no longer available.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Back to shop') }));
    else root.append(errorState(err.message, () => location.reload()));
    return root;
  }
}
