import { h, money, toast, emptyState, errorState } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';

const FLOWS = {
  default: ['CREATED', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  terminal: ['CANCELLED', 'REFUNDED', 'FAILED', 'REFUND_PENDING'],
};

function timeline(status) {
  const steps = FLOWS.default;
  const idx = steps.indexOf(status);
  const cancelled = FLOWS.terminal.includes(status);
  const wrap = h('div', { class: 'timeline', style: { marginTop: '12px' } });
  if (cancelled) {
    wrap.append(h('div', { class: 'tl-item done' }, h('div', { class: 'tl-dot' }, '✓'), h('div', {}, h('div', { class: 'fw-600' }, status), h('div', { class: 'muted text-sm' }, 'Order closed'))));
    return wrap;
  }
  steps.forEach((s, i) => {
    const done = i < idx || status === 'DELIVERED';
    const current = i === idx;
    const label = s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    wrap.append(h('div', { class: 'tl-item ' + (done ? 'done' : current ? 'current' : '') },
      h('div', { class: 'tl-dot' }, done ? '✓' : current ? '•' : ''),
      h('div', {}, h('div', { class: 'fw-600' }, label), current && h('div', { class: 'muted text-sm' }, 'In progress'))));
  });
  return wrap;
}

export async function Orders() {
  const root = h('div', { class: 'container section' });
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in to see orders', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }
  root.append(h('h1', {}, 'Your orders'));
  const grid = h('div', { class: 'col gap-4' });
  root.append(grid);
  try {
    const { orders } = await api.get('/orders');
    if (!orders.length) grid.append(emptyState({ icon: '📦', title: 'No orders yet', desc: 'Your next order could start here.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Explore products') }));
    else orders.forEach((o) => grid.append(orderCard(o)));
  } catch (e) { grid.append(errorState(e.message, () => location.reload())); }
  return root;
}

function orderCard(o) {
  return h('a', { class: 'card card-pad', href: '#/orders/' + o.id, style: { textDecoration: 'none', color: 'inherit', display: 'block' } },
    h('div', { class: 'row between' }, h('div', {}, h('div', { class: 'fw-600' }, o.order_number), h('div', { class: 'muted text-sm' }, o.module + ' · ' + new Date(o.created_at).toLocaleDateString('en-IN'))),
      statusBadge(o.status)),
    h('div', { class: 'row between', style: { marginTop: '8px' } }, h('span', { class: 'muted text-sm' }, money(o.total)), h('span', { class: 'fw-600' }, 'View →')));
}

export async function OrderDetail({ params }) {
  const root = h('div', { class: 'container-narrow section' });
  root.append(h('div', { class: 'sk-card skeleton', style: { height: '300px' } }));
  try {
    const { order } = await api.get('/orders/' + params.id);
    root.innerHTML = '';
    root.append(h('a', { href: '#/orders', class: 'text-sm fw-600' }, '← All orders'),
      h('div', { class: 'row between', style: { margin: '12px 0' } }, h('h1', { style: { margin: 0 } }, order.order_number), statusBadge(order.status)));
    const card = h('div', { class: 'card card-pad' },
      h('h3', {}, 'Status'),
      timeline(order.status),
      h('div', { class: 'divider' }),
      h('h3', {}, 'Items'),
      ...order.items.map((it) => h('div', { class: 'row between', style: { padding: '6px 0' } }, h('span', {}, it.quantity + '× ' + it.name), h('span', { class: 'fw-600' }, money(it.price * it.quantity)))),
      h('div', { class: 'divider' }),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', {}, money(order.subtotal))),
      order.discount > 0 && h('div', { class: 'row between' }, h('span', { class: 'discount' }, 'Discount'), h('span', { class: 'discount' }, '− ' + money(order.discount))),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Tax'), h('span', {}, money(order.tax))),
      h('div', { class: 'row between' }, h('strong', {}, 'Total'), h('strong', {}, money(order.total))),
      order.address && h('div', { class: 'divider' }),
      order.address && h('div', {}, h('div', { class: 'fw-600' }, 'Deliver to'), h('div', { class: 'muted text-sm' }, (order.address.line1 || '') + ', ' + order.address.city + ' ' + order.address.pincode)));
    root.append(card);
    if (['PAID', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      root.append(h('button', { class: 'btn btn-danger', style: { marginTop: '16px' }, onclick: async () => { if (confirm('Cancel this order?')) { try { await api.post('/orders/' + order.id + '/cancel'); toast('Order cancelled', 'success'); location.reload(); } catch (e) { toast(e.message, 'error'); } } } }, 'Cancel order'));
    }
  } catch (e) {
    root.innerHTML = ''; root.append(emptyState({ icon: '⚠️', title: 'Order not found', action: h('a', { class: 'btn btn-primary', href: '#/orders' }, 'Back to orders') }));
  }
  return root;
}

export function statusBadge(status) {
  const map = { PAID: 'badge-success', CONFIRMED: 'badge-info', PROCESSING: 'badge-info', OUT_FOR_DELIVERY: 'badge-info', DELIVERED: 'badge-success', CANCELLED: 'badge-danger', FAILED: 'badge-danger', REFUNDED: 'badge-warning', REFUND_PENDING: 'badge-warning', PAYMENT_PENDING: 'badge-warning', CREATED: 'badge-info' };
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return h('span', { class: 'badge ' + (map[status] || 'badge-info') }, label);
}
