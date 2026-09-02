import { h, money, toast, emptyState, productImage } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

const COLORS = [
  { key: 'white', label: 'White', bg: '#ffffff', border: '#e5e5e5' },
  { key: 'black', label: 'Black', bg: '#0a0a0a', border: '#0a0a0a' },
  { key: 'grey', label: 'Grey', bg: '#a3a3a3', border: '#a3a3a3' },
  { key: 'charcoal', label: 'Charcoal', bg: '#2a2a2a', border: '#2a2a2a' },
  { key: 'navy', label: 'Navy', bg: '#1e293b', border: '#1e293b' },
  { key: 'beige', label: 'Beige', bg: '#e8e6e1', border: '#e8e6e1' },
  { key: 'olive', label: 'Olive', bg: '#556b2f', border: '#556b2f' },
  { key: 'red', label: 'Red', bg: '#dc2626', border: '#dc2626' },
  { key: 'forest', label: 'Forest', bg: '#14532d', border: '#14532d' },
  { key: 'sage', label: 'Sage', bg: '#9caf88', border: '#9caf88' },
];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const FITS = [
  { key: 'regular', label: 'Regular' },
  { key: 'oversized', label: 'Oversized' },
  { key: 'relaxed', label: 'Relaxed' },
];
const FONTS = [
  { key: 'Inter', label: 'Inter', family: 'Inter, sans-serif' },
  { key: 'Playfair', label: 'Playfair', family: 'Playfair Display, serif' },
  { key: 'Mono', label: 'Mono', family: 'ui-monospace, monospace' },
  { key: 'Serif', label: 'Serif', family: 'Georgia, serif' },
];

let uid = 0;
function nextId() { return 'el-' + (++uid) + '-' + Date.now().toString(36); }

export async function Customize() {
  const root = h('div', { class: 'container section' });

  // Load customizable products
  let products = [];
  try {
    const r = await api.get('/products', { module: 'shop', limit: 50 });
    products = (r.items || []).filter(p => p.customizable);
    if (!products.length) products = r.items || [];
  } catch {}

  let selectedProduct = products[0] || null;
  let color = 'white';
  let size = 'M';
  let fit = 'regular';
  let side = 'front';
  let front = [];
  let back = [];
  let selectedId = null;
  let designName = '';
  let editingDesignId = new URLSearchParams(location.hash.split('?')[1] || '').get('id') || null;

  // If editing existing design, load it
  if (editingDesignId && Store.isAuthed()) {
    try {
      const { design } = await api.get('/custom-designs/' + editingDesignId);
      if (design) {
        color = design.color || color;
        size = design.size || size;
        fit = design.fit || fit;
        const data = typeof design.designData === 'string' ? JSON.parse(design.designData) : design.designData;
        front = data.front?.elements || [];
        back = data.back?.elements || [];
        designName = design.name || '';
        if (design.product_id) {
          const prod = products.find(p => p.id === design.product_id);
          if (prod) selectedProduct = prod;
        }
      }
    } catch {}
  }

  const getActive = () => side === 'front' ? front : back;
  const setActive = (arr) => { if (side === 'front') front = arr; else back = arr; };

  // ── Preview ───────────────────────────────────────────────────
  const previewWrap = h('div', { class: 'custom-preview-wrap' });
  const tshirt = h('div', { class: 'custom-tshirt' });
  const printArea = h('div', { class: 'custom-print-area' },
    h('span', { class: 'print-guide' }, 'PRINT AREA'));
  tshirt.append(printArea);
  previewWrap.append(
    h('div', { class: 'custom-preview-header row between' },
      h('div', { class: 'row gap-2' },
        h('button', { class: 'btn ' + (side === 'front' ? 'btn-primary' : 'btn-ghost'), type: 'button', onclick: () => { side = 'front'; selectedId = null; renderPreview(); renderControls(); } }, 'FRONT'),
        h('button', { class: 'btn ' + (side === 'back' ? 'btn-primary' : 'btn-ghost'), type: 'button', onclick: () => { side = 'back'; selectedId = null; renderPreview(); renderControls(); } }, 'BACK')),
      h('div', { class: 'row gap-2' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => resetView() }, 'Reset view'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => zoom(1.15) }, 'Zoom +'),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => zoom(0.87) }, 'Zoom −'))),
    tshirt,
    h('p', { class: 'muted text-xs center', style: { marginTop: '10px' } }, 'Drag to move · use handles to resize/rotate · designs stay inside the print area'));

  let zoomLevel = 1;
  function zoom(f) { zoomLevel = Math.max(0.6, Math.min(1.6, zoomLevel * f)); tshirt.style.transform = `scale(${zoomLevel})`; }
  function resetView() { zoomLevel = 1; tshirt.style.transform = 'scale(1)'; }

  function renderPreview() {
    // T-shirt color
    const c = COLORS.find(x => x.key === color);
    tshirt.style.background = c ? c.bg : '#fff';
    tshirt.style.color = (color === 'black' || color === 'charcoal' || color === 'navy' || color === 'olive' || color === 'forest') ? '#fff' : '#0a0a0a';
    tshirt.style.borderColor = c ? c.border : '#e5e5e5';
    // Clear elements, keep printArea
    printArea.querySelectorAll('.custom-el').forEach(el => el.remove());
    const active = getActive();
    if (!active.length) {
      if (!printArea.querySelector('.custom-empty')) {
        const empty = h('div', { class: 'custom-empty' },
          h('div', { style: { fontSize: '28px' } }, '✦'),
          h('div', { class: 'fw-600', style: { marginTop: '8px' } }, 'Your design starts here'),
          h('div', { class: 'muted text-sm' }, 'Add text or upload an image'));
        printArea.append(empty);
      }
    } else {
      const em = printArea.querySelector('.custom-empty'); if (em) em.remove();
      active.forEach((el) => {
        const node = renderElement(el);
        printArea.append(node);
      });
    }
    // Update side button styles
    previewWrap.querySelectorAll('.custom-preview-header .btn').forEach((b, i) => {
      const isFront = i === 0;
      b.className = 'btn ' + ((side === 'front' && isFront) || (side === 'back' && !isFront) ? 'btn-primary' : 'btn-ghost') + (b.classList.contains('btn-sm') ? ' btn-sm' : '');
    });
    renderSummary();
  }

  function renderElement(el) {
    const isSelected = el.id === selectedId;
    const wrap = h('div', {
      class: 'custom-el' + (isSelected ? ' selected' : ''),
      'data-id': el.id,
      style: {
        left: el.x + 'px', top: el.y + 'px',
        transform: `translate(-50%, -50%) scale(${el.scale || 1}) rotate(${el.rotation || 0}deg)`,
        position: 'absolute',
        cursor: 'move',
        userSelect: 'none',
        touchAction: 'none',
      },
      onclick: (e) => { e.stopPropagation(); selectedId = el.id; renderPreview(); renderControls(); },
    });

    if (el.type === 'text') {
      const span = h('span', {
        style: {
          fontFamily: el.fontFamily || 'Inter, sans-serif',
          fontSize: (el.fontSize || 24) + 'px',
          color: el.color || (tshirt.style.color || '#0a0a0a'),
          fontWeight: el.bold ? '800' : '600',
          fontStyle: el.italic ? 'italic' : 'normal',
          textAlign: el.align || 'center',
          letterSpacing: (el.letterSpacing || 0) + 'px',
          whiteSpace: 'nowrap',
          display: 'block',
          lineHeight: '1',
        }
      }, el.value || 'Text');
      wrap.append(span);
    } else if (el.type === 'image') {
      const img = h('img', {
        src: el.url, alt: 'design', draggable: 'false',
        style: { width: (el.width || 100) + 'px', height: (el.height || 100) + 'px', objectFit: 'contain', display: 'block', pointerEvents: 'none' }
      });
      wrap.append(img);
    }

    if (isSelected) {
      const del = h('button', { class: 'el-del', type: 'button', title: 'Delete', onclick: (e) => { e.stopPropagation(); removeElement(el.id); } }, '×');
      const dup = h('button', { class: 'el-dup', type: 'button', title: 'Duplicate', onclick: (e) => { e.stopPropagation(); duplicateElement(el.id); } }, '⧉');
      const rot = h('input', { type: 'range', min: '-180', max: '180', value: String(el.rotation || 0), class: 'el-rot', title: 'Rotate', oninput: (e) => { el.rotation = Number(e.target.value); wrap.style.transform = `translate(-50%, -50%) scale(${el.scale || 1}) rotate(${el.rotation}deg)`; } });
      wrap.append(del, dup);
      // Simple resize handles
      const scaleUp = h('button', { class: 'el-scale', type: 'button', title: 'Larger', onclick: (e) => { e.stopPropagation(); el.scale = Math.min(3, (el.scale || 1) * 1.2); renderPreview(); } }, '+');
      const scaleDown = h('button', { class: 'el-scale', type: 'button', title: 'Smaller', style: { right: '28px' }, onclick: (e) => { e.stopPropagation(); el.scale = Math.max(0.4, (el.scale || 1) * 0.8); renderPreview(); } }, '−');
      wrap.append(scaleUp, scaleDown);
      // Hidden rot slider positioned below
      wrap.append(h('div', { style: { position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px', background: '#fff', padding: '4px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px' } }, rot));
    }

    // Drag handling
    let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      e.preventDefault();
      dragging = true;
      selectedId = el.id;
      renderControls();
      wrap.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      origX = el.x; origY = el.y;
      wrap.classList.add('dragging');
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = (e.clientX - startX) / zoomLevel;
      const dy = (e.clientY - startY) / zoomLevel;
      el.x = Math.max(20, Math.min(260, origX + dx));
      el.y = Math.max(20, Math.min(340, origY + dy));
      wrap.style.left = el.x + 'px';
      wrap.style.top = el.y + 'px';
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove('dragging');
      try { wrap.releasePointerCapture(e.pointerId); } catch {}
      renderPreview();
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);

    return wrap;
  }

  function removeElement(id) {
    const active = getActive();
    const idx = active.findIndex(e => e.id === id);
    if (idx > -1) active.splice(idx, 1);
    if (selectedId === id) selectedId = null;
    renderPreview(); renderControls();
  }
  function duplicateElement(id) {
    const active = getActive();
    const el = active.find(e => e.id === id);
    if (!el) return;
    const copy = { ...el, id: nextId(), x: el.x + 16, y: el.y + 16 };
    active.push(copy);
    selectedId = copy.id;
    renderPreview(); renderControls();
  }

  // ── Controls ──────────────────────────────────────────────────
  const controls = h('div', { class: 'custom-controls' });

  // Product selector
  const productSel = h('select', { class: 'input' },
    ...products.map(p => h('option', { value: String(p.id), selected: p.id === selectedProduct?.id }, p.name)));
  productSel.addEventListener('change', () => {
    const prod = products.find(p => String(p.id) === productSel.value);
    if (prod) selectedProduct = prod;
    renderSummary();
  });

  // Color
  const colorRow = h('div', { class: 'row gap-2 wrap', style: { marginTop: '8px' } },
    ...COLORS.map(c => {
      const btn = h('button', {
        type: 'button',
        class: 'color-swatch' + (c.key === color ? ' active' : ''),
        title: c.label,
        style: { background: c.bg, borderColor: c.border },
        onclick: () => {
          color = c.key;
          colorRow.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderPreview();
        }
      });
      return btn;
    }));

  // Size
  const sizeRow = h('div', { class: 'row gap-2 wrap', style: { marginTop: '8px' } },
    ...SIZES.map(s => h('button', {
      type: 'button',
      class: 'btn btn-sm ' + (s === size ? 'btn-primary' : 'btn-ghost'),
      style: { minWidth: '44px' },
      onclick: (e) => {
        size = s;
        sizeRow.querySelectorAll('button').forEach(b => { b.className = 'btn btn-sm btn-ghost'; b.style.minWidth = '44px'; });
        e.target.className = 'btn btn-sm btn-primary';
        e.target.style.minWidth = '44px';
        renderSummary();
      }
    }, s)));

  // Fit
  const fitRow = h('div', { class: 'row gap-2', style: { marginTop: '8px' } },
    ...FITS.map(f => h('button', {
      type: 'button',
      class: 'btn btn-sm ' + (f.key === fit ? 'btn-primary' : 'btn-ghost'),
      onclick: (e) => {
        fit = f.key;
        fitRow.querySelectorAll('button').forEach(b => b.className = 'btn btn-sm btn-ghost');
        e.target.className = 'btn btn-sm btn-primary';
        renderSummary();
      }
    }, f.label)));

  // Text controls
  const textInput = h('input', { class: 'input', placeholder: 'Enter text — e.g. ZUNO', style: { marginTop: '8px' } });
  const fontSel = h('select', { class: 'input', style: { marginTop: '8px' } },
    ...FONTS.map(f => h('option', { value: f.family }, f.label)));
  const textColor = h('input', { type: 'color', value: '#0a0a0a', style: { width: '44px', height: '36px', padding: '2px', borderRadius: '6px', border: '1px solid var(--ink-200)' } });
  const fontSize = h('input', { type: 'range', min: '12', max: '72', value: '28', style: { flex: '1' } });
  const boldBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Bold' }, 'B');
  const italicBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Italic', style: { fontStyle: 'italic' } }, 'I');
  let isBold = false, isItalic = false;
  boldBtn.addEventListener('click', () => { isBold = !isBold; boldBtn.classList.toggle('btn-primary', isBold); boldBtn.classList.toggle('btn-ghost', !isBold); });
  italicBtn.addEventListener('click', () => { isItalic = !isItalic; italicBtn.classList.toggle('btn-primary', isItalic); italicBtn.classList.toggle('btn-ghost', !isItalic); });

  const addTextBtn = h('button', { class: 'btn btn-outline btn-block', type: 'button', style: { marginTop: '10px' } }, '+ Add Text');
  addTextBtn.addEventListener('click', () => {
    const val = textInput.value.trim() || 'ZUNO';
    const el = {
      id: nextId(),
      type: 'text',
      value: val,
      x: 140, y: 160,
      scale: 1, rotation: 0,
      fontFamily: fontSel.value,
      fontSize: Number(fontSize.value),
      color: textColor.value,
      bold: isBold, italic: isItalic,
      align: 'center',
    };
    getActive().push(el);
    selectedId = el.id;
    textInput.value = '';
    renderPreview(); renderControls();
  });

  // Image upload
  const fileInput = h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp', style: { display: 'none' } });
  const uploadBtn = h('button', { class: 'btn btn-outline btn-block', type: 'button' }, '⬆ Upload Image');
  const uploadHint = h('p', { class: 'muted text-xs', style: { marginTop: '6px' } }, 'PNG, JPG, WEBP up to 5MB. Transparent PNG works best.');
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/jpg'].includes(file.type)) { toast('Only PNG, JPG, WEBP allowed', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      // Validate dimensions via Image
      const img = new Image();
      img.onload = () => {
        if (img.width < 50 || img.height < 50) { toast('Image too small', 'warning'); }
        const el = { id: nextId(), type: 'image', url, x: 140, y: 180, scale: 1, rotation: 0, width: Math.min(120, img.width), height: Math.min(120, img.height) };
        getActive().push(el);
        selectedId = el.id;
        renderPreview(); renderControls();
      };
      img.onerror = () => toast('Could not load image', 'error');
      img.src = url;
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  // Drag & drop
  printArea.addEventListener('dragover', (e) => { e.preventDefault(); printArea.classList.add('drag-over'); });
  printArea.addEventListener('dragleave', () => printArea.classList.remove('drag-over'));
  printArea.addEventListener('drop', (e) => {
    e.preventDefault(); printArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });

  function renderControls() {
    controls.innerHTML = '';
    controls.append(
      h('div', { class: 'card card-pad' },
        h('h3', {}, 'Product'),
        h('div', { class: 'field', style: { marginTop: '10px' } }, h('label', {}, 'T-Shirt'), productSel),
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', {}, 'Color'), colorRow),
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', {}, 'Size'), sizeRow),
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', {}, 'Fit'), fitRow)),
      h('div', { class: 'card card-pad', style: { marginTop: '16px' } },
        h('h3', {}, 'Add Text'),
        textInput,
        h('div', { class: 'row gap-2', style: { marginTop: '8px', alignItems: 'center' } }, fontSel, textColor),
        h('div', { class: 'row gap-2', style: { marginTop: '8px', alignItems: 'center' } },
          h('span', { class: 'muted text-xs', style: { minWidth: '40px' } }, 'Size'),
          fontSize, boldBtn, italicBtn),
        addTextBtn),
      h('div', { class: 'card card-pad', style: { marginTop: '16px' } },
        h('h3', {}, 'Upload Image'),
        uploadBtn, fileInput, uploadHint),
      selectedId ? (() => {
        const active = getActive(); const el = active.find(e => e.id === selectedId);
        if (!el) return h('div', {});
        const delBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: { color: 'var(--ZUNO-danger)' }, onclick: () => { removeElement(el.id); } }, 'Delete selected');
        return h('div', { class: 'card card-pad', style: { marginTop: '16px', borderColor: 'var(--ZUNO-primary)' } },
          h('h3', {}, 'Selected'),
          h('p', { class: 'muted text-sm' }, el.type === 'text' ? `Text: "${el.value}"` : 'Image'),
          h('div', { class: 'row gap-2', style: { marginTop: '10px' } }, delBtn, h('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => duplicateElement(el.id) }, 'Duplicate')));
      })() : h('div', {})
    );
  }

  // ── Summary ───────────────────────────────────────────────────
  const summary = h('div', { class: 'card card-pad elevated', style: { position: 'sticky', top: 'calc(var(--nav-h) + 16px)' } });
  function renderSummary() {
    const base = selectedProduct ? selectedProduct.price : 1299;
    let extra = 0;
    if (front.length) extra += 10000;
    if (back.length) extra += 10000;
    const total = base + extra;
    const savedCount = front.length + back.length;
    summary.innerHTML = '';
    summary.append(
      h('h3', {}, 'Your Design'),
      selectedProduct ? h('div', { class: 'row gap-3', style: { marginTop: '12px', alignItems: 'center' } },
        h('img', { src: productImage({ name: selectedProduct.name, module: 'shop' }), alt: selectedProduct.name, style: { width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover' } }),
        h('div', {}, h('div', { class: 'fw-600' }, selectedProduct.name), h('div', { class: 'muted text-sm' }, `${color} · ${size} · ${fit}`))) : null,
      h('div', { class: 'divider', style: { margin: '14px 0' } }),
      h('div', { class: 'row between' }, h('span', { class: 'muted text-sm' }, 'Base price'), h('span', {}, money(base))),
      savedCount ? h('div', { class: 'row between' }, h('span', { class: 'muted text-sm' }, 'Print'), h('span', {}, money(extra))) : null,
      h('div', { class: 'divider' }),
      h('div', { class: 'row between' }, h('strong', {}, 'Total'), h('strong', {}, money(total))),
      h('div', { class: 'muted text-xs', style: { marginTop: '6px' } }, front.length + ' front · ' + back.length + ' back · ' + savedCount + ' elements'),
      h('div', { style: { marginTop: '16px' } },
        h('div', { class: 'field' }, h('label', {}, 'Design name (for saving)'),
          h('input', {
            class: 'input', placeholder: 'My Black Street Tee', value: designName,
            oninput: (e) => { designName = e.target.value; }
          }))),
      h('div', { class: 'row gap-2', style: { marginTop: '14px' } },
        h('button', { class: 'btn btn-outline btn-block', type: 'button', onclick: saveDesign }, '♡ Save'),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: addToCart }, 'Add to bag — ' + money(total))),
      h('p', { class: 'muted text-xs center', style: { marginTop: '10px' } }, 'Pricing verified server-side · No hidden charges')
    );
  }

  async function saveDesign() {
    if (!Store.isAuthed()) { toast('Please sign in to save designs', 'warning'); location.hash = '#/login'; return; }
    if (!front.length && !back.length) { toast('Add something to your design first', 'warning'); return; }
    const name = designName.trim() || `ZUNO Custom — ${color} ${size}`;
    const payload = {
      name, productId: selectedProduct?.id || null, color, size, fit,
      designData: { front: { elements: front }, back: { elements: back } },
      previewImage: null,
    };
    try {
      if (editingDesignId) {
        await api.put('/custom-designs/' + editingDesignId, payload);
        toast('Design updated', 'success');
      } else {
        const { design } = await api.post('/custom-designs', payload);
        editingDesignId = design.id;
        history.replaceState(null, '', '#/customize?id=' + design.id);
        toast('Design saved', 'success');
      }
    } catch (e) { toast(e.message, 'error'); }
  }

  async function addToCart() {
    if (!selectedProduct) { toast('Select a T-shirt', 'warning'); return; }
    if (!front.length && !back.length) { toast('Add text or an image to your design', 'warning'); return; }
    const designData = { front: { elements: front }, back: { elements: back } };
    // For guest, store locally and go to cart
    if (!Store.isAuthed()) {
      const guestCustom = {
        productId: selectedProduct.id, name: `Custom: ${selectedProduct.name}`, price: selectedProduct.price + (front.length ? 10000 : 0) + (back.length ? 10000 : 0),
        slug: selectedProduct.slug, image: productImage({ name: selectedProduct.name, module: 'shop' }), module: 'shop', quantity: 1,
        isCustom: true, customization: designData, variant: { color, size, fit }
      };
      // Reuse guest cart but mark as custom
      const guest = JSON.parse(localStorage.getItem('ZUNO_guest_cart') || '[]');
      guest.push({ productId: guestCustom.productId, name: guestCustom.name, price: guestCustom.price, slug: guestCustom.slug, image: guestCustom.image, module: 'shop', quantity: 1, customization: designData, variant: { color, size, fit }, isCustom: true });
      localStorage.setItem('ZUNO_guest_cart', JSON.stringify(guest));
      Store._guest = guest; Store.emit();
      toast('Custom design added to bag', 'success');
      location.hash = '#/cart';
      return;
    }
    try {
      await api.post('/cart/custom', { productId: selectedProduct.id, color, size, fit, designData, quantity: 1 });
      await refreshCart();
      toast('Custom design added to bag', 'success');
      location.hash = '#/cart';
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── Layout ────────────────────────────────────────────────────
  const layout = h('div', { class: 'custom-layout' },
    h('div', { class: 'custom-left' }, controls),
    h('div', { class: 'custom-center' }, previewWrap),
    h('div', { class: 'custom-right' }, summary));

  root.append(
    h('div', { class: 'row between', style: { alignItems: 'center', marginBottom: '16px' } },
      h('div', {},
        h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 } }, 'ZUNO CUSTOM STUDIO'),
        h('p', { class: 'muted' }, 'Make it yours — design your T-shirt live')),
      h('a', { class: 'btn btn-ghost', href: '#/shop' }, '← Back to shop')),
    layout);

  // Initial render
  renderPreview();
  renderControls();
  renderSummary();

  // Deselect on printArea click
  printArea.addEventListener('click', (e) => { if (e.target === printArea) { selectedId = null; renderPreview(); renderControls(); } });

  return root;
}
