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
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in to see orders', desc:'Create an account to track every order — live status, tracking and invoices.', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }
  const head = h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px', marginBottom:'16px'} },
    h('div',{},
      h('h1', { style:{margin:'0', fontFamily:'var(--font-display)'} }, 'Order history'),
      h('p', { class:'muted text-sm', style:{margin:'4px 0 0'} }, 'Track every order — tap any card for live timeline, invoice & tracking.')
    ),
    h('a', { class:'btn btn-outline btn-sm', href:'#/shop' }, 'Continue shopping →')
  );
  root.append(head);
  // filter tabs — All / Active / Delivered / Cancelled
  let filter = new URLSearchParams(location.hash.split('?')[1]||'').get('filter') || 'all';
  const tabs = h('div', { class:'row gap-2 wrap', style:{marginBottom:'16px'} },
    ...[
      ['all','All orders'], ['active','Active'], ['shipped','Shipped'], ['delivered','Delivered'], ['cancelled','Cancelled']
    ].map(([k,label])=> h('button', { class:'chip'+(filter===k?' active':'') , onclick:()=>{ location.hash='#/orders'+(k==='all'?'':'?filter='+k); } }, label))
  );
  root.append(tabs);
  const grid = h('div', { class: 'col gap-4' });
  root.append(grid);
  const countEl = h('div', { class:'muted text-xs', style:{marginBottom:'8px'} }, 'Loading orders…');
  root.append(countEl);
  try {
    const { orders: allOrders } = await api.get('/orders');
    let orders = allOrders;
    if (filter==='active') orders = allOrders.filter(o=> !['DELIVERED','CANCELLED','REFUNDED','FAILED'].includes(o.status));
    if (filter==='shipped') orders = allOrders.filter(o=> ['SHIPPED','OUT_FOR_DELIVERY'].includes(o.status));
    if (filter==='delivered') orders = allOrders.filter(o=> o.status==='DELIVERED');
    if (filter==='cancelled') orders = allOrders.filter(o=> ['CANCELLED','FAILED','REFUNDED'].includes(o.status));
    countEl.textContent = `${orders.length} of ${allOrders.length} orders` + (filter!=='all' ? ` • filtered: ${filter}` : '');
    if (!orders.length) {
      if (!allOrders.length) grid.append(emptyState({ icon: '📦', title: 'No orders yet', desc: 'Your next order could start here. Orders appear here instantly after checkout — COD or online.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Explore products') }));
      else grid.append(emptyState({ icon: '🔍', title: `No ${filter} orders`, desc: 'Try another filter.', action: h('button', { class:'btn btn-ghost', onclick:()=> location.hash='#/orders' }, 'Clear filter') }));
    } else orders.forEach((o) => grid.append(orderCard(o)));
  } catch (e) { grid.append(errorState(e.message, () => location.reload())); countEl.textContent=''; }
  return root;
}

function orderCard(o) {
  const tracking = o.printroveTrackingNumber || o.printrove_tracking_number || o.printroveTracking || null;
  const courier = o.printroveCourier || o.printrove_courier || null;
  const date = (()=>{ try{ return new Date(o.created_at).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});}catch{ return o.created_at; }})();
  return h('a', { class: 'card card-pad', href: '#/orders/' + o.id, style: { textDecoration: 'none', color: 'inherit', display: 'block', borderLeft: o.status==='DELIVERED' ? '4px solid #16a34a' : o.status==='CANCELLED' ? '4px solid #dc2626' : '4px solid #0f172a' } },
    h('div', { class: 'row between', style:{alignItems:'flex-start', gap:'12px'} },
      h('div', { style:{minWidth:0, flex:'1'} },
        h('div', { class: 'fw-600', style:{display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'} }, h('span',{}, o.order_number), statusBadge(o.status)),
        h('div', { class: 'muted text-sm', style:{marginTop:'4px'} }, `${o.module || 'shop'} · ${date} · ${money(o.total)}`),
        tracking ? h('div', { style:{marginTop:'6px', display:'inline-flex', gap:'6px', alignItems:'center', background:'#eff6ff', border:'1px solid #bfdbfe', padding:'4px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', color:'#1e40af'} }, `↗ Tracking: ${tracking}${courier?` (${courier})`:''}`) : null,
        o.printroveStatus || o.printrove_status ? h('div',{style:{marginTop:'4px', fontSize:'11px', color:'#334155'}}, `Fulfillment: ${o.printroveStatus || o.printrove_status}`) : null
      ),
      h('span', { class: 'fw-600', style:{fontSize:'12px', color:'#0f172a', whiteSpace:'nowrap'} }, 'Track →')
    ),
    h('div', { class: 'row between', style: { marginTop: '10px', paddingTop:'10px', borderTop:'1px dashed #e2e8f0' } },
      h('span', { class: 'muted text-sm' }, 'Tap for timeline, invoice & re-order'),
      h('span', { class: 'badge badge-info' }, 'View details')
    )
  );
}

export async function OrderDetail({ params }) {
  const root = h('div', { class: 'container-narrow section' });
  root.append(h('div', { class: 'sk-card skeleton', style: { height: '300px' } }));
  try {
    const { order } = await api.get('/orders/' + params.id);
    root.innerHTML = '';
    const tracking = order.printroveTrackingNumber || order.printrove_tracking_number || null;
    const courier = order.printroveCourier || order.printrove_courier || null;
    const fulfillment = order.printroveStatus || order.printrove_status || order.printroveStatus || null;
    root.append(h('a', { href: '#/orders', class: 'text-sm fw-600' }, '← All orders / Order history'),
      h('div', { class: 'row between', style: { margin: '12px 0', alignItems: 'center', flexWrap:'wrap', gap:'10px' } },
        h('h1', { style: { margin: 0, fontFamily: 'var(--font-display)', fontSize:'22px' } }, order.order_number),
        h('div', { class: 'row gap-2', style:{flexWrap:'wrap'} }, statusBadge(order.status), tracking ? h('span', { class:'badge badge-info', style:{background:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe'} }, `↗ ${tracking}${courier?` · ${courier}`:''}`) : null, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => window.print() }, 'Print invoice'))),
      tracking ? h('div', { class:'card', style:{padding:'12px', background:'#eff6ff', border:'1px solid #bfdbfe', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px'} },
        h('div',{}, h('div',{style:{fontWeight:'800', color:'#1e40af', fontSize:'13px'}}, `Tracking: ${tracking}`), h('div',{style:{fontSize:'11px', color:'#334155'}}, `${courier||'Courier'} • ${fulfillment||order.status}`)),
        h('a', { href: tracking ? `https://www.google.com/search?q=${encodeURIComponent(tracking+' '+ (courier||''))}` : '#', target:'_blank', class:'btn btn-primary btn-sm', style:{background:'#1e40af'} }, 'Track shipment →')
      ) : null,
      fulfillment ? h('div', { class:'muted text-xs', style:{marginBottom:'8px'} }, `Fulfillment status: ${fulfillment} • Updates from Printrove sync`) : null
    );
    const card = h('div', { class: 'card card-pad' },
      h('h3', {}, 'Order tracking — live timeline'),
      h('p', { class:'muted text-xs', style:{margin:'4px 0 8px'} }, 'Every status change is recorded — from payment to delivery. Admin updates reflect here instantly.'),
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
      root.append(h('button', { class: 'btn btn-ghost', style: { marginTop: '16px', color: 'var(--ZUNO-danger)' }, onclick: async () => { if (confirm('Cancel this order? Custom printed orders cannot be cancelled once printing starts.')) { try { await api.post('/orders/' + order.id + '/cancel'); toast('Order cancelled', 'success'); location.reload(); } catch (e) { toast(e.message, 'error'); } } } }, 'Cancel order'));
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
