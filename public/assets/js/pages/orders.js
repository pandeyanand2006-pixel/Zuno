import { h, money, toast, emptyState, errorState } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';

const FLOWS = {
  default: ['PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'PRINTING', 'QUALITY_CHECK', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  terminal: ['CANCELLED', 'REFUNDED', 'FAILED', 'REFUND_PENDING'],
};

function timeline(order) {
  const status = order.status;
  const history = order.history || [];
  const steps = FLOWS.default;
  const idx = steps.indexOf(status);
  const cancelled = FLOWS.terminal.includes(status);
  const wrap = h('div', { class: 'timeline', style: { marginTop: '12px' } });
  if (cancelled) {
    const last = history.findLast ? history.findLast(h => h.to_status === status) : history.slice().reverse().find(h => h.to_status === status);
    wrap.append(h('div', { class: 'tl-item done' }, h('div', { class: 'tl-dot' }, '✓'),
      h('div', {}, h('div', { class: 'fw-600' }, status.replace(/_/g, ' ')), h('div', { class: 'muted text-sm' }, last ? new Date(last.created_at).toLocaleString('en-IN') + (last.note ? ' · ' + last.note : '') : 'Order closed'))));
    return wrap;
  }
  steps.forEach((s, i) => {
    const done = i < idx || status === 'DELIVERED';
    const current = i === idx;
    const hist = history.find(h => h.to_status === s);
    const label = s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    const isCustom = s === 'PRINTING' && order.items?.some(it => it.isCustom);
    wrap.append(h('div', { class: 'tl-item ' + (done ? 'done' : current ? 'current' : '') },
      h('div', { class: 'tl-dot' }, done ? '✓' : current ? '•' : ''),
      h('div', {},
        h('div', { class: 'fw-600' }, label + (isCustom && s === 'PRINTING' ? ' · Your design is being printed' : '')),
        hist ? h('div', { class: 'muted text-sm' }, new Date(hist.created_at).toLocaleString('en-IN') + (hist.note ? ' · ' + hist.note : '')) : current ? h('div', { class: 'muted text-sm' }, 'In progress') : null)));
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
      h('div', { class: 'row between', style: { margin: '12px 0', alignItems: 'center' } },
        h('h1', { style: { margin: 0, fontFamily: 'var(--font-display)' } }, order.order_number),
        h('div', { class: 'row gap-2' }, statusBadge(order.status), h('button', { class: 'btn btn-ghost btn-sm', onclick: () => window.print() }, 'Print invoice'))));
    const card = h('div', { class: 'card card-pad' },
      h('h3', {}, 'Order tracking'),
      timeline(order),
      h('div', { class: 'divider' }),
      h('h3', {}, 'Items'),
      ...order.items.map((it) => {
        const variant = it.variant ? `${it.variant.color || ''} · ${it.variant.size || ''} ${it.variant.fit ? '· ' + it.variant.fit : ''}`.replace(/^ · | · $/g, '') : '';
        const isCustom = !!it.isCustom;
        return h('div', { style: { padding: '12px 0', borderBottom: '1px solid var(--ink-100)', display: 'flex', gap: '12px' } },
          h('div', { style: { width: '64px', height: '64px', background: '#f5f5f3', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: '0' } }, isCustom ? '✦' : '👕'),
          h('div', { class: 'grow' },
            h('div', { class: 'fw-600' }, it.name + (isCustom ? ' · Custom' : '')),
            variant ? h('div', { class: 'muted text-sm' }, variant) : null,
            isCustom && it.customization ? h('div', { class: 'muted text-xs', style: { marginTop: '6px', background: 'var(--ink-50)', padding: '8px', borderRadius: '6px' } },
              h('div', { class: 'fw-600', style: { color: 'var(--ink-800)' } }, 'Custom design'),
              h('div', {}, `Front: ${it.customization.front?.elements?.length || 0} · Back: ${it.customization.back?.elements?.length || 0}`),
              ...(it.customization.front?.elements || []).filter(e => e.type === 'text').slice(0, 2).map(e => h('div', { style: { fontStyle: e.italic ? 'italic' : 'normal', fontWeight: e.bold ? '700' : '400' } }, `"${e.value}"`)),
              ...(it.customization.front?.elements || []).filter(e => e.type === 'image').slice(0, 1).map(e => h('img', { src: e.url, style: { width: '60px', height: '60px', objectFit: 'contain', marginTop: '6px', borderRadius: '4px', border: '1px solid var(--ink-200)' } }))
            ) : null,
            h('div', { class: 'row between', style: { marginTop: '6px' } }, h('span', { class: 'muted text-sm' }, it.quantity + ' × ' + money(it.price)), h('span', { class: 'fw-600' }, money(it.price * it.quantity)))));
      }),
      h('div', { class: 'divider' }),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', {}, money(order.subtotal))),
      order.discount > 0 && h('div', { class: 'row between' }, h('span', { class: 'discount' }, 'Discount'), h('span', { class: 'discount' }, '− ' + money(order.discount))),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Tax'), h('span', {}, money(order.tax))),
      h('div', { class: 'row between' }, h('strong', {}, 'Total'), h('strong', {}, money(order.total))),
      order.customer_notes ? h('div', { class: 'card', style: { marginTop: '12px', padding: '12px', background: 'var(--ink-50)' } }, h('div', { class: 'fw-600 text-sm' }, 'Your note'), h('div', { class: 'muted text-sm' }, order.customer_notes)) : null,
      order.address ? h('div', { class: 'divider' }) : null,
      order.address ? h('div', {}, h('div', { class: 'fw-600' }, 'Deliver to'), h('div', { class: 'muted text-sm', style: { lineHeight: '1.6' } }, `${order.customer ? order.customer.name + ' · ' + (order.customer.mobile || '') : ''}`, h('br'), (order.address.line1 || '') + (order.address.line2 ? ', ' + order.address.line2 : '') + ', ' + order.address.city + ', ' + (order.address.state || '') + ' ' + order.address.pincode)) : null,
      order.customer ? h('div', { class: 'muted text-xs', style: { marginTop: '8px' } }, order.customer.email || '') : null);
    root.append(card);
    // Invoice
    const invoice = h('div', { class: 'card card-pad', style: { marginTop: '16px' } },
      h('h3', {}, 'Invoice'),
      h('div', { class: 'muted text-sm' }, `Order ${order.order_number} · ${new Date(order.created_at).toLocaleString('en-IN')} · ${order.status}`),
      h('div', { class: 'divider' }),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Payment'), h('span', {}, order.payment ? order.payment.status : '—')),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Amount paid'), h('span', { class: 'fw-600' }, money(order.total))),
      h('button', { class: 'btn btn-outline btn-sm', style: { marginTop: '12px' }, onclick: () => window.print() }, 'Download / Print invoice'));
    root.append(invoice);
    if (['PAID', 'CONFIRMED', 'PROCESSING', 'PRINTING', 'QUALITY_CHECK', 'PACKED'].includes(order.status)) {
      root.append(h('button', { class: 'btn btn-ghost', style: { marginTop: '16px', color: 'var(--zuno-danger)' }, onclick: async () => { if (confirm('Cancel this order? Custom printed orders cannot be cancelled once printing starts.')) { try { await api.post('/orders/' + order.id + '/cancel'); toast('Order cancelled', 'success'); location.reload(); } catch (e) { toast(e.message, 'error'); } } } }, 'Cancel order'));
    }
    // Admin notes / history visible to customer (admin notes are internal, but show if present)
    if (order.admin_notes) {
      root.append(h('div', { class: 'card card-pad', style: { marginTop: '16px', background: 'var(--ink-50)' } }, h('h4', {}, 'Note from ZUNO'), h('p', { class: 'muted text-sm', style: { whiteSpace: 'pre-wrap' } }, order.admin_notes)));
    }
  } catch (e) {
    root.innerHTML = ''; root.append(emptyState({ icon: '◐', title: 'Order not found', action: h('a', { class: 'btn btn-primary', href: '#/orders' }, 'Back to orders') }));
  }
  return root;
}

export function statusBadge(status) {
  const map = { PAID: 'badge-success', CONFIRMED: 'badge-info', PROCESSING: 'badge-info', OUT_FOR_DELIVERY: 'badge-info', DELIVERED: 'badge-success', CANCELLED: 'badge-danger', FAILED: 'badge-danger', REFUNDED: 'badge-warning', REFUND_PENDING: 'badge-warning', PAYMENT_PENDING: 'badge-warning', CREATED: 'badge-info' };
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return h('span', { class: 'badge ' + (map[status] || 'badge-info') }, label);
}
