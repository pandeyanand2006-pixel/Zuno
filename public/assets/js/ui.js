export function h(tag, props, ...children) {
  if (typeof tag === 'function') return tag(props || {}, ...children);
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v === false || v == null) { /* skip */ }
      else el.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function mount(target, node) {
  target.innerHTML = '';
  if (Array.isArray(node)) node.forEach((n) => target.append(n));
  else if (node) target.append(node);
  return target;
}

export function money(paise) {
  const n = Number(paise) / 100;
  if (Number.isInteger(n)) return '₹' + n.toLocaleString('en-IN');
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('') || 'Z';
}

const MODULE_EMOJI = { shop: '🛍️', grocery: '🥦', food: '🍴', services: '🔧', default: '🛒' };
function escXml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Pick an emoji that matches the product by scanning its name (and category).
const EMOJI_KEYWORDS = [
  // electronics / shop
  ['laptop', '💻'], ['notebook', '💻'], ['macbook', '💻'], ['computer', '🖥️'], ['desktop', '🖥️'], ['monitor', '🖥️'],
  ['headphone', '🎧'], ['earbud', '🎧'], ['earphone', '🎧'], ['airpod', '🎧'], ['headset', '🎧'], ['speaker', '🔊'], ['sound', '🔊'],
  ['phone', '📱'], ['mobile', '📱'], ['smartphone', '📱'], ['tablet', '📱'], ['ipad', '📱'],
  ['tv', '📺'], ['television', '📺'],
  ['camera', '📷'], ['webcam', '📷'],
  ['watch', '⌚'], ['smartwatch', '⌚'],
  ['keyboard', '⌨️'], ['mouse', '🖱️'], ['charger', '🔌'], ['adapter', '🔌'], ['power', '🔌'], ['battery', '🔋'],
  ['shoe', '👟'], ['sneaker', '👟'], ['boot', '🥾'], ['sandal', '🩴'], ['shirt', '👕'], ['tshirt', '👕'], ['cloth', '👕'], ['dress', '👗'], ['jean', '👖'], ['pant', '👖'], ['jacket', '🧥'], ['bag', '👜'], ['wallet', '👛'], ['sunglass', '🕶️'], ['cap', '🧢'],
  ['book', '📚'], ['novel', '📚'], ['pen', '🖊️'], ['stationery', '🖊️'],
  ['toy', '🧸'], ['game', '🎮'], ['controller', '🎮'],
  ['chair', '🪑'], ['table', '🛋️'], ['sofa', '🛋️'], ['furniture', '🛋️'], ['lamp', '💡'], ['bulb', '💡'],
  ['bottle', '🍾'], ['mug', '☕'], ['cookware', '🍳'], ['knife', '🔪'], ['utensil', '🍴'],
  // grocery
  ['banana', '🍌'], ['apple', '🍎'], ['mango', '🥭'], ['orange', '🍊'], ['grapes', '🍇'], ['watermelon', '🍉'], ['papaya', '🍈'], ['pineapple', '🍍'], ['strawberr', '🍓'], ['berry', '🍓'], ['pomegranate', '🥭'], ['guava', '🍐'], ['pear', '🍐'], ['kiwi', '🥝'], ['lemon', '🍋'], ['lime', '🍋'], [' plum', '🟣'], ['cherry', '🍒'],
  ['milk', '🥛'], ['curd', '🥛'], ['yogurt', '🥛'], ['paneer', '🧀'], ['cheese', '🧀'], ['butter', '🧈'], ['ghee', '🧈'], ['cream', '🥛'],
  ['bread', '🍞'], ['bun', '🍞'], ['pav', '🍞'], ['roti', '🫓'], ['chapati', '🫓'], ['naan', '🫓'],
  ['egg', '🥚'], ['chicken', '🍗'], ['mutton', '🍖'], ['fish', '🐟'], ['prawn', '🦐'], ['meat', '🍖'],
  ['rice', '🍚'], ['basmati', '🍚'], ['dal', '🫘'], ['lentil', '🫘'], ['bean', '🫘'], ['pulse', '🫘'],
  ['potato', '🥔'], ['onion', '🧅'], ['tomato', '🍅'], ['carrot', '🥕'], ['cauliflower', '🥦'], ['cabbage', '🥬'], ['spinach', '🥬'], ['leafy', '🥬'], ['chilli', '🌶️'], ['pepper', '🌶️'], ['ginger', '🫚'], ['garlic', '🧄'], ['cucumber', '🥒'], ['brinjal', '🍆'], ['eggplant', '🍆'], ['beetroot', '🥬'], ['radish', '🌶️'],
  ['sugar', '🍬'], ['salt', '🧂'], ['jaggery', '🟤'], ['masala', '🧂'], ['spice', '🧂'], ['tea', '🍵'], ['coffee', '☕'], ['chai', '🍵'],
  ['oil', '🛢️'], ['grain', '🌾'], ['atta', '🌾'], ['flour', '🌾'], ['corn', '🌽'], ['wheat', '🌾'],
  ['chips', '🍟'], ['biscuit', '🍪'], ['cookie', '🍪'], ['chocolate', '🍫'], ['candy', '🍬'], ['juice', '🧃'], ['soda', '🥤'], ['cold drink', '🥤'], ['water', '💧'], ['soft drink', '🥤'], ['namkeen', '🥨'], ['dry fruit', '🥜'], ['nut', '🥜'], ['almond', '🥜'], ['cashew', '🥜'], ['raisin', '🍇'], ['honey', '🍯'],
  ['soap', '🧼'], ['shampoo', '🧴'], ['detergent', '🧴'], ['cleaner', '🧴'], ['paste', '🪥'], ['brush', '🪥'], ['tissue', '🧻'], ['towel', '🧺'],
  // food / restaurants
  ['pizza', '🍕'], ['burger', '🍔'], ['sandwich', '🥪'], ['hotdog', '🌭'], ['fries', '🍟'], ['biryani', '🍛'], ['pulao', '🍛'], ['rice', '🍚'], ['curry', '🍲'], ['gravy', '🍲'], ['dal tadka', '🍲'], ['thali', '🍱'], ['dosa', '🥞'], ['idli', '🥞'], ['uttapam', '🥞'], ['vada', '🥟'], ['samosa', '🥟'], ['pakora', '🥟'], ['momos', '🥟'], ['noodle', '🍜'], ['pasta', '🍝'], ['soup', '🍲'], ['roll', '🌯'], ['wrap', '🌯'], ['taco', '🌮'], ['manchurian', '🥘'], ['noodles', '🍜'], ['fried rice', '🍚'],
  ['icecream', '🍦'], ['ice cream', '🍦'], ['kulfi', '🍦'], ['cake', '🍰'], ['pastry', '🥧'], ['gulab', '🍮'], ['jalebi', '🍯'], ['sweet', '🍬'], ['lassi', '🥛'], ['shake', '🥤'], ['falooda', '🍨'],
  ['coffee', '☕'], ['cappuccino', '☕'], ['espresso', '☕'], ['tea', '🍵'],
  // services / home
  ['salon', '💇'], ['hair', '💇'], ['spa', '💆'], ['massage', '💆'], ['beauty', '💄'], ['makeup', '💄'], ['parlour', '💄'], ['barber', '💈'],
  ['clean', '🧹'], ['housekeep', '🧹'], ['sweep', '🧹'], ['mop', '🧹'], ['deep clean', '🧽'],
  ['repair', '🔧'], ['plumb', '🔧'], ['electrician', '💡'], ['wiring', '💡'], ['appliance', '🔧'], ['ac', '❄️'], ['air condition', '❄️'], ['refrigerator', '🧊'], ['fridge', '🧊'], ['wash', '🧺'], ['laundry', '🧺'],
  ['paint', '🎨'], ['painter', '🎨'], ['pest', '🐜'], ['pest control', '🐜'],
  ['tutor', '📚'], ['tuition', '📚'], ['coach', '🏋️'], ['fitness', '🏋️'], ['yoga', '🧘'], ['trainer', '🏋️'], ['dance', '💃'], ['music', '🎵'],
  ['mechanic', '🔧'], ['carpenter', '🪚'], ['gardener', '🌿'], ['pest', '🐜'], ['moving', '📦'], ['pack', '📦'], ['shift', '📦'],
  ['doctor', '🩺'], ['consult', '🩺'], ['vet', '🐾'], ['pet', '🐾'],
];

const MODULE_FALLBACK = { shop: '🛍️', grocery: '🥦', food: '🍴', services: '🔧', default: '🛒' };

function emojiForProduct(p = {}) {
  const name = ' ' + String(p.name || '').toLowerCase() + ' ';
  const cat = ' ' + String(p.category || '') + ' ';
  const hay = name + cat;
  for (const [kw, em] of EMOJI_KEYWORDS) {
    if (hay.includes(kw)) return em;
  }
  return MODULE_FALLBACK[p.module] || MODULE_FALLBACK.default;
}

// Deterministic, offline-safe image (data-URI SVG) for any product/service.
export function productImage(p = {}, opts = {}) {
  const label = p.name || 'Product';
  const emoji = p.imageEmoji || emojiForProduct(p);
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  const h1 = hash % 360, h2 = (hash * 7) % 360;
  const c1 = `hsl(${h1} 72% 62%)`, c2 = `hsl(${h2} 70% 44%)`;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
    `<rect width='400' height='400' fill='url(#g)'/>` +
    `<text x='200' y='190' font-size='150' text-anchor='middle'>${emoji}</text>` +
    `<text x='200' y='330' font-size='26' font-family='sans-serif' font-weight='700' fill='white' text-anchor='middle'>${escXml(label).slice(0, 24)}</text>` +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastRoot;
export function toast(message, type = 'info') {
  if (!toastRoot) toastRoot = document.getElementById('toast-root');
  const icon = { success: '✓', error: '✕', warning: '!', info: 'i' }[type] || 'i';
  const node = h('div', { class: `toast ${type}`, role: 'status' },
    h('div', { class: 'fw-600', style: { minWidth: '18px' } }, icon),
    h('div', { class: 'grow' }, message));
  toastRoot.append(node);
  setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateX(20px)'; setTimeout(() => node.remove(), 220); }, 3200);
}

export function modal(content, { onClose } = {}) {
  const overlay = h('div', { class: 'overlay' });
  const close = () => { overlay.remove(); onClose && onClose(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, content);
  overlay.append(box);
  document.getElementById('overlay-root').append(overlay);
  return { close, overlay };
}

export function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const content = h('div', {},
      h('h3', {}, title),
      h('p', { class: 'muted' }, message),
      h('div', { class: 'row gap-3', style: { marginTop: '20px', justifyContent: 'flex-end' } },
        h('button', { class: 'btn btn-ghost', onclick: () => { m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => { m.close(); resolve(true); } }, confirmText)));
    const m = modal(content);
  });
}

export function skeletonGrid(n = 8) {
  return h('div', { class: 'grid grid-products' }, ...Array.from({ length: n }, () => h('div', { class: 'sk-card skeleton' })));
}

export function emptyState({ icon = '📭', title, desc, action }) {
  return h('div', { class: 'empty' },
    h('div', { class: 'em-ic' }, icon),
    h('h3', {}, title),
    desc && h('p', { class: 'muted' }, desc),
    action);
}

export function errorState(message, onRetry) {
  return h('div', { class: 'empty' },
    h('div', { class: 'em-ic' }, '⚠️'),
    h('h3', {}, 'Something went wrong'),
    h('p', { class: 'muted' }, message || 'We couldn’t complete that request. Please try again.'),
    onRetry && h('button', { class: 'btn btn-primary', onclick: onRetry }, 'Try again'));
}

export function spinner(size = 20) {
  return h('span', { class: 'skeleton', style: { width: size + 'px', height: size + 'px', borderRadius: '50%', display: 'inline-block' } });
}
