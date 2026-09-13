import { h, money, toast, emptyState, productImage, resolveImageUrl, imgFallback } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';

const COLORS = [
  { key: 'white', label: 'White', bg: '#ffffff', border: '#d8dee8' },
  { key: 'black', label: 'Black', bg: '#111111', border: '#111111' },
  { key: 'grey', label: 'Grey', bg: '#a3a3a3', border: '#a3a3a3' },
  { key: 'charcoal', label: 'Charcoal', bg: '#2a2a2a', border: '#2a2a2a' },
  { key: 'navy', label: 'Navy', bg: '#1e293b', border: '#1e293b' },
  { key: 'beige', label: 'Beige', bg: '#e8e6e1', border: '#d5d0c7' },
  { key: 'olive', label: 'Olive', bg: '#556b2f', border: '#556b2f' },
  { key: 'red', label: 'Red', bg: '#dc2626', border: '#dc2626' },
  { key: 'maroon', label: 'Maroon', bg: '#7f1d1d', border: '#7f1d1d' },
  { key: 'forest', label: 'Forest', bg: '#14532d', border: '#14532d' },
  { key: 'sage', label: 'Sage', bg: '#9caf88', border: '#9caf88' },
  { key: 'mustard', label: 'Mustard', bg: '#ca8a04', border: '#ca8a04' },
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

// px (legacy 280x340) -> percent
function toPct(el) {
  if (typeof el.xPct === 'number' && typeof el.yPct === 'number') return el;
  const x = typeof el.x === 'number' ? el.x : 140;
  const y = typeof el.y === 'number' ? el.y : 170;
  // legacy box was 280 wide / 340 tall
  const xPct = x > 100 ? (x / 280) * 100 : x;
  const yPct = y > 100 ? (y / 340) * 100 : y;
  el.xPct = Math.max(4, Math.min(96, xPct));
  el.yPct = Math.max(4, Math.min(96, yPct));
  return el;
}

function shade(hex, amt) {
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    let n = parseInt(c, 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  } catch { return hex; }
}

function teeSVG(bg, side) {
  const dark = shade(bg, -28);
  const darker = shade(bg, -55);
  const light = shade(bg, 18);
  const isFront = side === 'front';
  const neck = isFront
    ? `<path d="M118 28 C 130 52, 170 52, 182 28 C 170 38, 130 38, 118 28 Z" fill="${dark}" stroke="${darker}" stroke-width="2"/>`
    : `<path d="M118 28 C 132 38, 168 38, 182 28 L 182 24 L 118 24 Z" fill="${dark}" stroke="${darker}" stroke-width="2"/>`;
  return `
  <svg viewBox="0 0 300 330" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="teeGrad-${side}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${light}" stop-opacity="0.55"/>
        <stop offset="0.5" stop-color="${bg}" stop-opacity="0"/>
        <stop offset="1" stop-color="${dark}" stop-opacity="0.5"/>
      </linearGradient>
    </defs>
    <path d="M118 24 L84 38 L34 92 L68 114 L86 92 L86 304 C86 310 90 314 96 314 L204 314 C210 314 214 310 214 304 L214 92 L232 114 L266 92 L216 38 L182 24 C 168 34, 132 34, 118 24 Z"
      fill="${bg}" stroke="${darker}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M118 24 L84 38 L34 92 L68 114 L86 92 L86 304 C86 310 90 314 96 314 L204 314 C210 314 214 310 214 304 L214 92 L232 114 L266 92 L216 38 L182 24 C 168 34, 132 34, 118 24 Z"
      fill="url(#teeGrad-${side})"/>
    ${neck}
    <path d="M86 92 L68 114" stroke="${darker}" stroke-width="2" opacity="0.6"/>
    <path d="M214 92 L232 114" stroke="${darker}" stroke-width="2" opacity="0.6"/>
    <path d="M86 100 L86 300" stroke="${darker}" stroke-width="1" opacity="0.22"/>
    <path d="M214 100 L214 300" stroke="${darker}" stroke-width="1" opacity="0.22"/>
    <path d="M96 300 L204 300" stroke="${darker}" stroke-width="1.4" opacity="0.35"/>
    ${isFront ? '' : `<text x="150" y="72" text-anchor="middle" font-size="10" letter-spacing="3" fill="${darker}" opacity="0.55" font-weight="800">BACK</text>`}
  </svg>`;
}

export async function Customize() {
  const root = h('div', { class: 'container section', style: { maxWidth: '1320px', width: '100%', boxSizing: 'border-box' } });

  let products = [];
  try {
    const r = await api.get('/products', { module: 'shop', limit: 50 });
    products = (r.items || []).filter((p) => p.customizable);
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

  if (editingDesignId && Store.isAuthed()) {
    try {
      const { design } = await api.get('/custom-designs/' + editingDesignId);
      if (design) {
        color = design.color || color;
        size = design.size || size;
        fit = design.fit || fit;
        const data = typeof design.designData === 'string' ? JSON.parse(design.designData) : design.designData;
        front = (data.front?.elements || []).map(toPct);
        back = (data.back?.elements || []).map(toPct);
        designName = design.name || '';
        if (design.product_id) {
          const prod = products.find((p) => p.id === design.product_id);
          if (prod) selectedProduct = prod;
        }
      }
    } catch {}
  }

  const getActive = () => (side === 'front' ? front : back);

  // ── Preview ──
  const previewWrap = h('div', { class: 'custom-preview-wrap' });

  const segFront = h('button', { class: 'tee-seg active', type: 'button' }, '👕 FRONT');
  const segBack = h('button', { class: 'tee-seg', type: 'button' }, '👕 BACK');
  segFront.addEventListener('click', () => { side = 'front'; selectedId = null; renderPreview(); renderControls(); });
  segBack.addEventListener('click', () => { side = 'back'; selectedId = null; renderPreview(); renderControls(); });

  const segCtrl = h('div', { class: 'tee-seg-ctrl' }, segFront, segBack);
  const zoomIn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Zoom in' }, '🔍+');
  const zoomOut = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Zoom out' }, '🔍−');
  const resetBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Reset');
  const previewTools = h('div', { class: 'tee-tools' }, resetBtn, zoomIn, zoomOut);

  const previewHeader = h('div', { class: 'custom-preview-header' },
    h('div', { class: 'tee-live' },
      h('div', { class: 'fw-600 tee-live-title' }, '✨ Live T-Shirt Preview'),
      h('div', { class: 'text-sm muted' }, 'Design directly on the shirt. Switch front / back.')),
    h('div', { class: 'tee-bar' }, segCtrl, previewTools));

  const teeBody = h('div', { class: 'tee-body' });
  const printArea = h('div', { class: 'tee-print' },
    h('span', { class: 'print-guide' }, 'PRINT AREA'));
  teeBody.append(printArea);
  const teeStage = h('div', { class: 'tee-stage' }, teeBody);

  const previewHint = h('div', { class: 'tee-hint' },
    h('div', { class: 'text-xs fw-600 tee-hint-title' }, '💡 How to customize:'),
    h('ul', { class: 'text-xs tee-hint-list' },
      h('li', {}, 'Tap any element to select it'),
      h('li', {}, 'Drag to move · Use + / − to resize'),
      h('li', {}, 'Design stays on the shirt print area'),
      h('li', {}, 'Upload photos or add custom text')));

  previewWrap.append(previewHeader, teeStage, previewHint);

  let zoomLevel = 1;
  function zoom(f) { zoomLevel = Math.max(0.7, Math.min(1.5, zoomLevel * f)); teeBody.style.transform = `scale(${zoomLevel})`; }
  zoomIn.addEventListener('click', () => zoom(1.12));
  zoomOut.addEventListener('click', () => zoom(0.9));
  resetBtn.addEventListener('click', () => { zoomLevel = 1; teeBody.style.transform = 'scale(1)'; });

  const DARK_KEYS = ['black', 'charcoal', 'navy', 'olive', 'forest', 'maroon', 'red'];

  function renderPreview() {
    const c = COLORS.find((x) => x.key === color) || COLORS[0];
    teeBody.style.background = 'transparent';
    teeBody.innerHTML = '';
    const svgWrap = h('div', { class: 'tee-svg', html: teeSVG(c.bg, side) });
    teeBody.append(svgWrap, printArea);
    printArea.querySelectorAll('.custom-el, .custom-empty').forEach((el) => el.remove());

    const active = getActive().map(toPct);
    if (!active.length) {
      printArea.append(
        h('div', { class: 'custom-empty' },
          h('div', { style: { fontSize: '26px', lineHeight: '1' } }, '✦'),
          h('div', { class: 'fw-600', style: { marginTop: '6px', fontSize: '14px' } }, side === 'front' ? 'Front design starts here' : 'Back design starts here'),
          h('div', { class: 'muted text-sm' }, 'Add text or upload an image')));
    } else {
      active.forEach((el) => printArea.append(renderElement(el, c)));
    }
    segFront.classList.toggle('active', side === 'front');
    segBack.classList.toggle('active', side === 'back');
    renderSummary();
  }

  function renderElement(el, shirtColor) {
    toPct(el);
    const isSelected = el.id === selectedId;
    const wrap = h('div', {
      class: 'custom-el' + (isSelected ? ' selected' : ''),
      'data-id': el.id,
      style: {
        left: el.xPct + '%', top: el.yPct + '%',
        transform: `translate(-50%, -50%) scale(${el.scale || 1}) rotate(${el.rotation || 0}deg)`,
      },
    });
    wrap.addEventListener('click', (e) => { e.stopPropagation(); selectedId = el.id; renderPreview(); renderControls(); });

    if (el.type === 'text') {
      const darkShirt = DARK_KEYS.includes(color);
      wrap.append(h('span', {
        style: {
          fontFamily: el.fontFamily || 'Inter, sans-serif',
          fontSize: 'clamp(12px, ' + (el.fontSize || 26) + 'px, 9vw)',
          color: el.color || (darkShirt ? '#ffffff' : '#0a0a0a'),
          fontWeight: el.bold ? '800' : '700',
          fontStyle: el.italic ? 'italic' : 'normal',
          whiteSpace: 'nowrap', display: 'block', lineHeight: '1.1',
        },
      }, el.value || 'Text'));
    } else if (el.type === 'image') {
      wrap.append(h('img', {
        src: el.url, alt: 'design', draggable: 'false',
        style: { width: 'clamp(40px,' + (el.width || 110) + 'px, 32vw)', height: 'auto', maxHeight: '32vw', objectFit: 'contain', display: 'block', pointerEvents: 'none', borderRadius: '4px' },
      }));
    }

    if (isSelected) {
      const del = h('button', { class: 'el-del', type: 'button', title: 'Delete' }, '×');
      del.addEventListener('click', (e) => { e.stopPropagation(); removeElement(el.id); });
      const dup = h('button', { class: 'el-dup', type: 'button', title: 'Duplicate' }, '⧉');
      dup.addEventListener('click', (e) => { e.stopPropagation(); duplicateElement(el.id); });
      const plus = h('button', { class: 'el-scale', type: 'button', title: 'Larger' }, '+');
      plus.addEventListener('click', (e) => { e.stopPropagation(); el.scale = Math.min(2.6, (el.scale || 1) * 1.18); renderPreview(); });
      const minus = h('button', { class: 'el-scale el-minus', type: 'button', title: 'Smaller' }, '−');
      minus.addEventListener('click', (e) => { e.stopPropagation(); el.scale = Math.max(0.4, (el.scale || 1) * 0.84); renderPreview(); });
      wrap.append(del, dup, plus, minus);
    }

    let startX = 0, startY = 0, oX = 0, oY = 0, dragging = false;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      e.preventDefault();
      dragging = true;
      selectedId = el.id;
      renderControls();
      try { wrap.setPointerCapture(e.pointerId); } catch {}
      startX = e.clientX; startY = e.clientY;
      oX = el.xPct; oY = el.yPct;
      wrap.classList.add('dragging');
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = printArea.getBoundingClientRect();
      if (!rect.width) return;
      const dxPct = ((e.clientX - startX) / rect.width) * 100;
      const dyPct = ((e.clientY - startY) / rect.height) * 100;
      el.xPct = Math.max(2, Math.min(98, oX + dxPct));
      el.yPct = Math.max(2, Math.min(98, oY + dyPct));
      wrap.style.left = el.xPct + '%';
      wrap.style.top = el.yPct + '%';
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
    const idx = active.findIndex((e) => e.id === id);
    if (idx > -1) active.splice(idx, 1);
    if (selectedId === id) selectedId = null;
    renderPreview(); renderControls();
  }
  function duplicateElement(id) {
    const active = getActive();
    const el = active.find((e) => e.id === id);
    if (!el) return;
    const copy = { ...el, id: nextId(), xPct: Math.min(96, el.xPct + 5), yPct: Math.min(96, el.yPct + 5) };
    delete copy.x; delete copy.y;
    active.push(copy);
    selectedId = copy.id;
    renderPreview(); renderControls();
  }

  // ── Controls ──
  const controls = h('div', { class: 'custom-controls' });

  const productSel = h('select', { class: 'input' },
    ...products.map((p) => h('option', { value: String(p.id), selected: p.id === selectedProduct?.id }, p.name)));
  productSel.addEventListener('change', () => {
    const prod = products.find((p) => String(p.id) === productSel.value);
    if (prod) selectedProduct = prod;
    renderSummary();
  });

  const colorRow = h('div', { class: 'tee-colors' },
    ...COLORS.map((c) => {
      const btn = h('button', {
        type: 'button',
        class: 'color-swatch' + (c.key === color ? ' active' : ''),
        title: c.label,
        'aria-label': c.label,
        style: { background: c.bg, borderColor: c.border },
      });
      btn.addEventListener('click', () => {
        color = c.key;
        colorRow.querySelectorAll('.color-swatch').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderPreview();
        toast(`Selected ${c.label}`, 'success');
      });
      return h('div', { class: 'tee-color-cell' }, btn, h('div', { class: 'text-xs muted tee-color-label' }, c.label));
    }));

  const sizeRow = h('div', { class: 'tee-pills' },
    ...SIZES.map((s) => h('button', {
      type: 'button',
      class: 'btn btn-sm ' + (s === size ? 'btn-primary' : 'btn-ghost'),
      onclick: (e) => {
        size = s;
        sizeRow.querySelectorAll('button').forEach((b) => { b.className = 'btn btn-sm btn-ghost'; });
        e.currentTarget.className = 'btn btn-sm btn-primary';
        renderSummary();
      },
    }, s)));

  const fitRow = h('div', { class: 'tee-pills' },
    ...FITS.map((f) => h('button', {
      type: 'button',
      class: 'btn btn-sm ' + (f.key === fit ? 'btn-primary' : 'btn-ghost'),
      onclick: (e) => {
        fit = f.key;
        fitRow.querySelectorAll('button').forEach((b) => { b.className = 'btn btn-sm btn-ghost'; });
        e.currentTarget.className = 'btn btn-sm btn-primary';
        renderSummary();
      },
    }, f.label)));

  const textInput = h('input', { class: 'input', placeholder: 'Enter text — e.g. ZUNO' });
  const fontSel = h('select', { class: 'input' },
    ...FONTS.map((f) => h('option', { value: f.family }, f.label)));
  const textColor = h('input', { type: 'color', value: '#0a0a0a', class: 'tee-color-input' });
  const fontSize = h('input', { type: 'range', min: '14', max: '64', value: '26', class: 'tee-range' });
  const boldBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Bold', style: { fontWeight: '800' } }, 'B');
  const italicBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Italic', style: { fontStyle: 'italic' } }, 'I');
  let isBold = false, isItalic = false;
  boldBtn.addEventListener('click', () => { isBold = !isBold; boldBtn.classList.toggle('btn-primary', isBold); boldBtn.classList.toggle('btn-ghost', !isBold); });
  italicBtn.addEventListener('click', () => { isItalic = !isItalic; italicBtn.classList.toggle('btn-primary', isItalic); italicBtn.classList.toggle('btn-ghost', !isItalic); });

  const addTextBtn = h('button', { class: 'btn btn-outline btn-block', type: 'button', style: { marginTop: '10px' } }, '+ Add Text to ' + (side === 'front' ? 'Front' : 'Back'));
  addTextBtn.addEventListener('click', () => {
    const val = textInput.value.trim() || 'ZUNO';
    const el = {
      id: nextId(), type: 'text', value: val,
      xPct: 50, yPct: 42, scale: 1, rotation: 0,
      fontFamily: fontSel.value, fontSize: Number(fontSize.value),
      color: textColor.value, bold: isBold, italic: isItalic,
    };
    getActive().push(el);
    selectedId = el.id;
    textInput.value = '';
    renderPreview(); renderControls();
    toast(`Added to ${side}`, 'success');
  });

  const fileInput = h('input', { type: 'file', accept: '.png,.jpg,.jpeg,.webp', style: { display: 'none' } });
  const uploadBtn = h('button', { class: 'btn btn-outline btn-block', type: 'button' }, '⬆ Upload Image to ' + (side === 'front' ? 'Front' : 'Back'));
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
      const img = new Image();
      img.onload = () => {
        const w = Math.min(130, img.width);
        const el = { id: nextId(), type: 'image', url, xPct: 50, yPct: 50, scale: 1, rotation: 0, width: w };
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

  function renderControls() {
    addTextBtn.textContent = '+ Add Text to ' + (side === 'front' ? 'Front' : 'Back');
    uploadBtn.textContent = '⬆ Upload Image to ' + (side === 'front' ? 'Front' : 'Back');
    controls.innerHTML = '';
    const selected = selectedId ? getActive().find((e) => e.id === selectedId) : null;
    controls.append(
      h('div', { class: 'card card-pad tee-card' },
        h('h3', { class: 'tee-h' }, '👕 Choose Your T-Shirt'),
        h('p', { class: 'muted text-sm tee-sub' }, `Now editing: ${side.toUpperCase()} · ${front.length} front · ${back.length} back`),
        h('div', { class: 'field' }, h('label', {}, 'T-Shirt Style'), productSel),
        h('div', { class: 'field' }, h('label', {}, 'Color — tap to paint the shirt'), colorRow),
        h('div', { class: 'field' }, h('label', {}, 'Size'), sizeRow),
        h('div', { class: 'field' }, h('label', {}, 'Fit'), fitRow)),
      h('div', { class: 'card card-pad tee-card' },
        h('h3', { class: 'tee-h' }, `✏️ Text for ${side}`),
        h('p', { class: 'muted text-sm tee-sub' }, 'Words, slogans, names — placed on the shirt'),
        textInput,
        h('div', { class: 'tee-inline' }, fontSel, h('div', { class: 'tee-colorpick' }, h('span', { class: 'text-xs muted' }, 'Color'), textColor)),
        h('div', { class: 'tee-inline' }, h('span', { class: 'text-xs muted' }, 'Size'), fontSize, boldBtn, italicBtn),
        addTextBtn),
      h('div', { class: 'card card-pad tee-card' },
        h('h3', { class: 'tee-h' }, `🖼️ Image for ${side}`),
        h('p', { class: 'muted text-sm tee-sub' }, 'Logos, photos, artwork — on the shirt'),
        uploadBtn, fileInput, uploadHint),
      selected ? h('div', { class: 'card card-pad tee-card tee-selected' },
        h('h3', { class: 'tee-h' }, '🎯 Selected Element'),
        h('p', { class: 'muted text-sm' }, selected.type === 'text' ? `Text: "${selected.value}" on ${side}` : `Image on ${side}`),
        h('div', { class: 'row gap-2', style: { marginTop: '10px', flexWrap: 'wrap' } },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: { color: 'var(--zuno-danger)' }, onclick: () => removeElement(selected.id) }, '🗑️ Delete'),
          h('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => duplicateElement(selected.id) }, '⧉ Duplicate'),
          h('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => { side = side === 'front' ? 'back' : 'front'; const a = side === 'front' ? back : front; const idx = a.findIndex((e) => e.id === selected.id); if (idx > -1) { const [mv] = a.splice(idx, 1); (side === 'front' ? front : back).push(mv); } renderPreview(); renderControls(); } }, '⇄ Move to ' + (side === 'front' ? 'Back' : 'Front'))
        )) : h('div', { style: { display: 'none' } })
    );
  }

  // ── Summary ──
  const summary = h('div', { class: 'card card-pad elevated tee-summary' });
  function renderSummary() {
    const base = selectedProduct ? selectedProduct.price : 129900;
    // base already in paise? products use paise. keep consistent:
    const basePaise = selectedProduct ? selectedProduct.price : 129900;
    let extra = 0;
    if (front.length) extra += 10000;
    if (back.length) extra += 10000;
    const total = basePaise + extra;
    const savedCount = front.length + back.length;
    summary.innerHTML = '';
    summary.append(
      h('h3', { class: 'tee-h' }, 'Your Design'),
      selectedProduct ? h('div', { class: 'row gap-3 tee-prod' },
        h('img', { src: (selectedProduct.images && selectedProduct.images[0]) ? resolveImageUrl(selectedProduct.images[0]) : productImage({ name: selectedProduct.name, module: 'shop' }), alt: selectedProduct.name, class: 'tee-prod-img', loading: 'lazy', decoding: 'async', onerror: (e) => imgFallback(e.currentTarget, { name: selectedProduct.name, module: 'shop' }) }),
        h('div', { style: { minWidth: '0' } }, h('div', { class: 'fw-600 tee-ellipsis' }, selectedProduct.name), h('div', { class: 'muted text-sm' }, `${color} · ${size} · ${fit}`))) : null,
      h('div', { class: 'divider', style: { margin: '14px 0' } }),
      h('div', { class: 'row between' }, h('span', { class: 'muted text-sm' }, 'Base price'), h('span', {}, money(base))),
      savedCount ? h('div', { class: 'row between' }, h('span', { class: 'muted text-sm' }, 'Print'), h('span', {}, money(extra))) : null,
      h('div', { class: 'divider' }),
      h('div', { class: 'row between' }, h('strong', {}, 'Total'), h('strong', {}, money(total))),
      h('div', { class: 'muted text-xs', style: { marginTop: '6px' } }, front.length + ' front · ' + back.length + ' back · ' + savedCount + ' elements'),
      h('div', { style: { marginTop: '14px' } },
        h('div', { class: 'field', style: { marginBottom: '0' } }, h('label', {}, 'Design name (for saving)'),
          h('input', { class: 'input', placeholder: 'My Black Street Tee', value: designName, oninput: (e) => { designName = e.target.value; } }))),
      h('div', { class: 'tee-cta' },
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
    if (!Store.isAuthed()) {
      const guest = JSON.parse(localStorage.getItem('ZUNO_guest_cart') || '[]');
      guest.push({ productId: selectedProduct.id, name: `Custom: ${selectedProduct.name}`, price: selectedProduct.price + (front.length ? 10000 : 0) + (back.length ? 10000 : 0), slug: selectedProduct.slug, image: productImage({ name: selectedProduct.name, module: 'shop' }), module: 'shop', quantity: 1, customization: designData, variant: { color, size, fit }, isCustom: true });
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

  const layout = h('div', { class: 'custom-layout' },
    h('div', { class: 'custom-left' }, controls),
    h('div', { class: 'custom-center' }, previewWrap),
    h('div', { class: 'custom-right' }, summary));

  root.append(
    h('div', { class: 'tee-top' },
      h('div', { style: { minWidth: '0' } },
        h('h1', { class: 'tee-title' }, 'ZUNO CUSTOM STUDIO'),
        h('p', { class: 'muted tee-sub2' }, 'Make it yours — design on a real T-shirt')),
      h('a', { class: 'btn btn-ghost', href: '#/shop' }, '← Back to shop')),
    layout);

  renderPreview();
  renderControls();
  renderSummary();

  printArea.addEventListener('click', (e) => { if (e.target === printArea) { selectedId = null; renderPreview(); renderControls(); } });
  printArea.addEventListener('dragover', (e) => { e.preventDefault(); printArea.classList.add('drag-over'); });
  printArea.addEventListener('dragleave', () => printArea.classList.remove('drag-over'));
  printArea.addEventListener('drop', (e) => {
    e.preventDefault(); printArea.classList.remove('drag-over');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      } catch {}
    }
  });

  return root;
}
