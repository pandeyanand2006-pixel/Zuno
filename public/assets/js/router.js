import { h, mount } from './ui.js';
import { topBar, bottomNav, footer, refreshCart } from './components.js';

const routes = [];
let currentCleanup = null;

export function route(pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ regex, keys, handler });
}

export function parseHash() {
  let hash = location.hash.slice(1) || '/';
  const [path, queryStr] = hash.split('?');
  const query = {};
  if (queryStr) new URLSearchParams(queryStr).forEach((v, k) => { query[k] = v; });
  return { path: path || '/', query };
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
  }
  return null;
}

function activeKey(path) {
  if (path === '/') return 'home';
  if (path.startsWith('/shop')) return 'shop';
  if (path.startsWith('/grocery')) return 'grocery';
  if (path.startsWith('/food')) return 'food';
  if (path.startsWith('/services')) return 'services';
  if (path.startsWith('/orders')) return 'orders';
  if (path.startsWith('/cart')) return 'cart';
  if (path.startsWith('/profile')) return 'profile';
  if (path.startsWith('/login') || path.startsWith('/register')) return 'auth';
  return '';
}

let mainEl, topEl, botEl;

export function startRouter({ main, top, bottom }) {
  mainEl = main; topEl = top; botEl = bottom;
  window.addEventListener('hashchange', render);
  refreshCart().finally(() => render());
}

async function render() {
  const { path, query } = parseHash();
  const matched = match(path) || match('/__notfound');
  const key = activeKey(path);

  // update shell chrome
  mount(topEl, topBar(key));
  mount(botEl, bottomNav(key));

  if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }

  let page;
  try {
    const result = matched ? await matched.handler({ params: matched.params, query }) : notFound();
    page = result;
  } catch (err) {
    console.error('route error', err);
    page = h('div', { class: 'container section' }, h('h2', {}, 'Page error'), h('p', { class: 'muted' }, err.message));
  }
  mainEl.classList.remove('page-enter'); void mainEl.offsetWidth; mainEl.classList.add('page-enter');
  mount(mainEl, page);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function notFound() {
  return h('div', { class: 'container section center' },
    h('h1', {}, '404'),
    h('p', { class: 'muted' }, 'We couldn’t find that page.'),
    h('a', { class: 'btn btn-primary', href: '#/' }, 'Back home'));
}
