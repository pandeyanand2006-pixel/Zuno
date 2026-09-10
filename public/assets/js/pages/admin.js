import { h, money, toast, emptyState, modal } from '../ui.js';
import { statusBadge } from './orders.js';
import { api } from '../api.js';
import { Store } from '../store.js';

export async function Admin() {
  const root = h('div', { class: 'container section' });
  const user = Store.getUser();
  if (!user || user.role !== 'ADMIN') { root.append(emptyState({ icon: '◐', title: 'Founder Access Only', desc: 'This dashboard is exclusively for the Zuno founder. Please sign in with founder credentials.', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in as Founder') })); return root; }

  // Founder Welcome Banner with enhanced styling
  const founderBanner = h('div', { style: { 
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)', 
    color: 'white', 
    padding: '32px', 
    borderRadius: '16px', 
    marginBottom: '32px', 
    boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'hidden'
  } },
    // Decorative elements
    h('div', { style: { 
      position: 'absolute', 
      top: '-50px', 
      right: '-50px', 
      width: '200px', 
      height: '200px', 
      background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)',
      borderRadius: '50%'
    } }),
    h('div', { style: { 
      position: 'absolute', 
      bottom: '-30px', 
      left: '-30px', 
      width: '150px', 
      height: '150px', 
      background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
      borderRadius: '50%'
    } }),
    h('div', { class: 'row between', style: { alignItems: 'center', position: 'relative', zIndex: '2' } },
      h('div', {},
        h('div', { style: { 
          fontSize: '0.75rem', 
          fontWeight: '700',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#fbbf24', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        } }, 
          h('span', { style: { fontSize: '20px' } }, '⚡'),
          'FOUNDER DASHBOARD'),
        h('h1', { style: { 
          fontFamily: 'var(--font-display)', 
          letterSpacing: '-0.02em', 
          margin: '0', 
          fontSize: '2.5rem',
          background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        } }, 'ZUNO Admin'),
        h('div', { style: { marginTop: '12px', opacity: '0.9', fontSize: '1rem', color: '#cbd5e1' } }, 
          'Welcome back, ' + (user.name || 'Founder') + '! 👋 Manage your orders and business.')),
      h('div', { style: { 
        textAlign: 'right',
        background: 'rgba(255,255,255,0.1)',
        padding: '16px 20px',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)'
      } },
        h('div', { style: { fontSize: '0.7rem', opacity: '0.8', marginBottom: '4px', color: '#94a3b8' } }, 'Logged in as'),
        h('div', { class: 'fw-700', style: { fontSize: '0.95rem' } }, user.email || user.mobile))));

  const tabs = h('div', { class: 'tabs', style: { marginBottom: '20px', overflowX: 'auto' } },
    h('button', { class: 'tab active', 'data-t': 'overview' }, 'Overview'),
    h('button', { class: 'tab', 'data-t': 'orders' }, 'All Orders'),
    h('button', { class: 'tab', 'data-t': 'production' }, 'Production'),
    h('button', { class: 'tab', 'data-t': 'custom' }, '✦ Custom Orders'),
    h('button', { class: 'tab', 'data-t': 'products' }, 'Products'),
    h('button', { class: 'tab', 'data-t': 'users' }, 'Customers'));
  const panel = h('div', {}, skeletonPanel());
  root.append(founderBanner, tabs, panel);

  tabs.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('active')); t.classList.add('active'); load(t.dataset.t); }));

  async function load(t) {
    panel.innerHTML = ''; panel.append(skeletonPanel());
    try {
      if (t === 'overview') panel.append(await overview());
      if (t === 'orders') panel.append(await orders());
      if (t === 'production') panel.append(await productionQueue());
      if (t === 'custom') panel.append(await customOrders());
      if (t === 'products') panel.append(await products());
      if (t === 'users') panel.append(await users());
    } catch (e) { panel.innerHTML = ''; panel.append(emptyState({ icon: '◐', title: 'Failed', desc: e.message })); }
  }
  load('overview');
  return root;
}

function skeletonPanel() { return h('div', { class: 'row gap-4 wrap' }, ...Array.from({ length: 4 }, () => h('div', { class: 'stat skeleton', style: { width: '180px', height: '88px' } }))); }

async function overview() {
  const a = await api.get('/admin/analytics');
  const customCount = await api.get('/admin/custom-orders').then(r => r.orders.length).catch(() => 0);
  const stats = h('div', { class: 'row gap-4 wrap' },
    stat(a.revenue ? money(a.revenue) : '₹0', 'Revenue'),
    stat(String(a.totalOrders), 'Orders'),
    stat(String(customCount), 'Custom orders'),
    stat(String(a.users), 'Customers'),
    stat(String(a.ordersToday), 'Today'),
    stat(money(a.averageOrderValue), 'AOV'));
  const byMod = h('div', { class: 'card card-pad', style: { marginTop: '16px' } }, h('h3', {}, 'Revenue'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Module'), h('th', {}, 'Orders'), h('th', {}, 'Revenue'))),
      ...a.byModule.map((m) => h('tr', {}, h('td', {}, m.module), h('td', {}, String(m.count)), h('td', {}, money(m.revenue)))))));
  return h('div', {}, stats, byMod);
}

async function orders() {
  const search = h('input', { class: 'input', placeholder: 'Search order #, customer, mobile…', style: { maxWidth: '320px' } });
  const container = h('div', {});
  const tableWrap = h('div', { style: { overflowX: 'auto', marginTop: '12px' } });
  container.append(h('div', { class: 'row gap-3', style: { marginBottom: '12px' } }, search, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { search.value = ''; load(''); } }, 'Clear')));
  container.append(tableWrap);
  async function load(q = '') {
    tableWrap.innerHTML = 'Loading…';
    const { orders } = await api.get('/admin/orders' + (q ? '?q=' + encodeURIComponent(q) : ''));
    if (!orders.length) { tableWrap.innerHTML = ''; tableWrap.append(emptyState({ title: 'No orders' })); return; }
    const rows = orders.slice(0, 100).map((o) => h('tr', { style: { cursor: 'pointer' }, onclick: () => { showOrderDetail(o.id); } },
      h('td', {}, 
        h('a', { href: '#/admin/orders/' + o.id, style: { fontWeight: '700', color: 'var(--ink-900)' }, onclick: (e) => e.stopPropagation() }, o.order_number), 
        h('div', { class: 'muted text-xs', style: { marginTop: '4px', lineHeight: '1.4' } }, 
          h('div', { class: 'fw-600', style: { color: 'var(--ink-900)' } }, (o.customer_name || 'Guest')),
          (o.customer_mobile ? h('div', {}, '📱 ' + o.customer_mobile) : null),
          (o.customer_email ? h('div', {}, '✉️ ' + o.customer_email) : null),
          (o.addr_line1 ? h('div', { style: { marginTop: '4px', color: 'var(--ink-700)', borderTop: '1px solid var(--ink-100)', paddingTop: '4px' } }, `📍 ${o.addr_line1}, ${o.addr_city || ''} ${o.addr_pincode || ''}`) : h('div', { class: 'muted text-xs' }, '📍 No address')))),
      h('td', {}, 
        h('div', { class: 'fw-700' }, money(o.total)),
        h('div', { class: 'text-xs muted' }, new Date(o.created_at).toLocaleDateString('en-IN')),
        o.payment_status ? h('div', { class: 'text-xs', style: { color: o.payment_status==='captured'?'var(--zuno-success)':'var(--ink-500)' } }, o.payment_method ? `${o.payment_method} · ${o.payment_status}` : o.payment_status) : null),
      h('td', {}, statusBadge(o.status)),
      h('td', {}, h('select', { class: 'input', style: { padding: '6px 8px', fontSize: 'var(--fs-sm)' }, onclick: (e) => e.stopPropagation(), onchange: async (e) => { 
        try { 
          await api.post('/admin/orders/' + o.id + '/status', { status: e.target.value }); 
          toast('✅ Status updated', 'success');
          setTimeout(() => load(q), 500);
        } catch (err) { toast('❌ ' + err.message, 'error'); } 
      } },
        ...['PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'PROCESSING', 'PRINTING', 'QUALITY_CHECK', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((s) => h('option', { value: s, selected: s === o.status }, s.replace(/_/g, ' '))))),
      h('td', {}, h('button', { class: 'btn btn-ghost btn-sm', onclick: (e)=> { e.stopPropagation(); showOrderDetail(o.id); } }, 'View →'))));
    tableWrap.innerHTML = '';
    tableWrap.append(h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Order / Customer + Address (Delivery)'), h('th', {}, 'Total / Payment'), h('th', {}, 'Status'), h('th', {}, 'Update'), h('th', {}, ''))), ...rows));
  }
  
  async function showOrderDetail(orderId) {
    const { order } = await api.get('/admin/orders/' + orderId);
    const customer = order.customer || {};
    const address = order.address || {};
    const items = order.items || [];
    const payment = order.payment || null;
    
    const content = h('div', { style: { maxHeight: '80vh', overflowY: 'auto' } },
      h('h2', {}, '📦 Order: ' + order.order_number),
      h('div', { class: 'row gap-2 wrap', style: { marginTop: '8px' } }, statusBadge(order.status), order.coupon_code ? h('span', { class: 'badge badge-info' }, 'Coupon: ' + order.coupon_code) : null, payment ? h('span', { class: 'badge ' + (payment.verified ? 'badge-success' : 'badge-warning') }, payment.verified ? '✓ Paid' : 'Payment ' + payment.status) : null),
      // Customer + Address + Payment —  delivery-critical
      h('div', { style: { background: '#f0f9ff', padding: '16px', borderRadius: '12px', marginTop: '16px', border: '1px solid #bae6fd' } },
        h('div', { class: 'fw-700', style: { marginBottom: '12px', fontSize: '1rem', color: '#0369a1' } }, '👤 CUSTOMER & DELIVERY (auto-filled)'),
        h('div', { class: 'row gap-4 wrap' },
          h('div', { style: { minWidth: '180px' } },
            h('div', { class: 'text-xs muted' }, 'NAME'),
            h('div', { class: 'fw-600' }, customer.name || 'N/A'),
            h('div', { class: 'text-xs muted', style: { marginTop: '8px' } }, 'PHONE'),
            h('div', { class: 'fw-600' }, customer.mobile || 'N/A'),
            h('div', { class: 'text-xs muted', style: { marginTop: '8px' } }, 'EMAIL'),
            h('div', { class: 'text-sm' }, customer.email || 'N/A')),
          h('div', { style: { flex: '1', minWidth: '220px' } },
            h('div', { class: 'text-xs muted' }, 'SHIPPING ADDRESS (for delivery)'),
            address.line1 ? h('div', { class: 'fw-600', style: { lineHeight: '1.5' } },
              h('div', {}, address.line1),
              address.line2 ? h('div', {}, address.line2) : null,
              h('div', {}, `${address.city || ''}, ${address.state || ''} ${address.pincode || ''}`),
              address.landmark ? h('div', { class: 'text-sm muted' }, 'Landmark: ' + address.landmark) : null
            ) : h('div', { class: 'muted' }, 'No address — ask customer')),
          h('div', { style: { minWidth: '160px' } },
            h('div', { class: 'text-xs muted' }, 'PAYMENT'),
            h('div', { class: 'fw-600' }, payment ? `${payment.method || 'Razorpay'} · ${payment.status}${payment.verified ? ' ✓' : ''}` : '—'),
            payment ? h('div', { class: 'text-xs muted' }, money(payment.amount) + ' · ' + payment.currency) : null,
            order.customer_notes ? h('div', { style: { marginTop: '10px', background: '#fffbeb', padding: '8px', borderRadius: '6px', border: '1px solid #fde68a' } }, h('div', { class: 'text-xs fw-600' }, 'Customer note'), h('div', { class: 'text-sm' }, order.customer_notes)) : null
          ))),
      h('div', { style: { marginTop: '16px' } },
        h('div', { class: 'fw-700', style: { marginBottom: '12px' } }, '🛍️ ORDER ITEMS — T-Shirt / Size / Qty'),
        ...items.map(it => {
          const variant = it.variant || {};
          const cust = it.customization;
          const isCustom = !!it.customization_data || !!cust;
          return h('div', { style: { background: 'var(--ink-50)', padding: '12px', borderRadius: '8px', marginBottom: '8px', borderLeft: isCustom ? '4px solid #f59e0b' : '4px solid var(--primary-denim)' } },
            h('div', { class: 'fw-700' }, it.name + (isCustom ? ' ✦ Custom' : '')),
            variant.color || variant.size || variant.fit ? h('div', { class: 'text-sm', style: { marginTop: '4px' } }, `👕 T-Shirt: Color ${variant.color || '—'} · Size ${variant.size || '—'}${variant.fit ? ' · Fit ' + variant.fit : ''}`) : h('div', { class: 'text-sm muted' }, 'No variant (one-size)'),
            cust ? h('div', { class: 'text-xs', style: { marginTop: '6px', padding: '8px', background: '#fff7ed', borderRadius: '6px' } },
              h('div', { class: 'fw-600' }, '🎨 Custom Design'),
              cust.front?.elements?.length ? h('div', {}, `Front: ${cust.front.elements.length} elements`) : null,
              cust.back?.elements?.length ? h('div', {}, `Back: ${cust.back.elements.length} elements`) : null,
              ...((cust.front?.elements||[]).slice(0,2).map(e => e.type==='text' ? h('div', { style: { background: '#fff', padding: '4px 6px', borderRadius: '4px', marginTop: '4px' } }, `"${e.value}"`) : null))
            ) : null,
            h('div', { class: 'text-sm', style: { marginTop: '6px', display: 'flex', justifyContent: 'space-between' } }, h('span', {}, `Qty ${it.quantity} × ${money(it.price)}`), h('span', { class: 'fw-700' }, money(it.price * it.quantity))));
        }),
        h('div', { style: { marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '2px solid var(--ink-100)' } }, h('span', { class: 'muted' }, `Subtotal ${money(order.subtotal)}${order.discount ? ' · Discount -' + money(order.discount) : ''} · Tax ${money(order.tax)}`), h('span', { class: 'fw-800', style: { fontSize: '1.25rem' } }, `TOTAL ${money(order.total)}`))),
      h('div', { style: { marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-primary btn-sm', onclick: () => { navigator.clipboard?.writeText(`${customer.name} | ${customer.mobile} | ${address.line1 || ''}, ${address.city || ''} ${address.pincode || ''} | ${order.order_number} | ${items.map(i=>`${i.name} ${i.variant?`(${i.variant.color}/${i.variant.size})`:''} x${i.quantity}`).join(', ')}`); toast('Delivery details copied', 'success'); } }, '📋 Copy delivery details'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => window.print() }, '🖨️ Print')),
      h('div', { style: { marginTop: '16px' } },
        h('div', { class: 'fw-600', style: { marginBottom: '8px' } }, 'Status'),
        h('div', { class: 'row gap-2 wrap' }, h('select', { class: 'input', style: { maxWidth: '200px' }, onchange: async (e) => { try { await api.post('/admin/orders/' + order.id + '/status', { status: e.target.value }); toast('Status → ' + e.target.value, 'success'); order.status = e.target.value; } catch(err){ toast(err.message,'error'); } } }, ...['PAYMENT_PENDING','PAID','CONFIRMED','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s=> h('option', { value:s, selected: s===order.status }, s.replace(/_/g,' '))))),
        order.history?.length ? h('div', { class: 'text-sm muted', style: { marginTop: '8px' } },
          h('div', { class: 'fw-600' }, 'History'),
          ...order.history.slice(-8).map(h => h('div', {}, `${h.to_status} · ${new Date(h.created_at).toLocaleString()}${h.note ? ' · ' + h.note : ''}`))
        ) : null));
    
    modal(content);
  }
  
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(search.value.trim()); });
  await load('');
  return card('All Orders', container);
}

async function productionQueue() {
  const { orders } = await api.get('/admin/orders');
  const statuses = ['PAID', 'CONFIRMED', 'PRINTING', 'QUALITY_CHECK', 'PACKED', 'SHIPPED'];
  let filter = 'PAID';
  const wrap = h('div', {});
  const tabs = h('div', { class: 'row gap-2 wrap', style: { marginBottom: '16px' } },
    ...statuses.map(s => h('button', {
      class: 'btn btn-sm ' + (s === filter ? 'btn-primary' : 'btn-ghost'),
      onclick: () => { filter = s; render(); }
    }, s.replace(/_/g, ' '))));
  const list = h('div', { class: 'col gap-3' });
  wrap.append(h('h3', {}, 'Production Queue'), h('p', { class: 'muted text-sm' }, 'Quickly move orders through production. Custom orders are highlighted.'), tabs, list);
  async function render() {
    tabs.querySelectorAll('button').forEach(b => {
      const isActive = b.textContent.trim() === filter.replace(/_/g, ' ');
      b.className = 'btn btn-sm ' + (isActive ? 'btn-primary' : 'btn-ghost');
    });
    list.innerHTML = '';
    const filtered = orders.filter(o => o.status === filter);
    if (!filtered.length) { list.append(emptyState({ title: 'No orders in ' + filter.replace(/_/g, ' ') })); return; }
    for (const o of filtered.slice(0, 20)) {
      const row = h('div', { class: 'card card-pad', style: { display: 'flex', gap: '16px', alignItems: 'center' } },
        h('div', {}, h('div', { class: 'fw-600' }, o.order_number), h('div', { class: 'muted text-sm' }, new Date(o.created_at).toLocaleDateString('en-IN') + ' · ' + money(o.total))),
        h('div', { class: 'grow muted text-sm' }, o.customer_name || o.customer_email || ''),
        h('div', {}, statusBadge(o.status)),
        h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
          const nextMap = { PAID: 'CONFIRMED', CONFIRMED: 'PRINTING', PRINTING: 'QUALITY_CHECK', QUALITY_CHECK: 'PACKED', PACKED: 'SHIPPED', SHIPPED: 'OUT_FOR_DELIVERY' };
          const next = nextMap[o.status];
          if (!next) return;
          try { await api.post('/admin/orders/' + o.id + '/status', { status: next }); toast('Moved to ' + next, 'success'); o.status = next; render(); } catch (e) { toast(e.message, 'error'); }
        } }, '→ ' + ({ PAID: 'Confirm', CONFIRMED: 'Start Printing', PRINTING: 'Quality Check', QUALITY_CHECK: 'Pack', PACKED: 'Ship', SHIPPED: 'Deliver' }[filter] || 'Next')));
      list.append(row);
    }
  }
  render();
  return wrap;
}

async function customOrders() {
  const { orders } = await api.get('/admin/custom-orders');
  if (!orders.length) return emptyState({ icon: '✦', title: 'No custom orders', desc: 'Custom T-shirt orders will appear here.' });
  const wrap = h('div', { class: 'col gap-4' });
  
  // Fetch detailed order info for each custom order
  for (const o of orders) {
    const { order: fullOrder } = await api.get('/admin/orders/' + o.id).catch(() => ({ order: o }));
    const items = fullOrder.items || o.items || [];
    const customer = fullOrder.customer || {};
    const address = fullOrder.address || {};
    
    wrap.append(h('div', { class: 'card', style: { border: '2px solid var(--accent)', background: 'linear-gradient(to bottom, #fffbf0, white)', padding: '20px' } },
      // Order Header with Status
      h('div', { class: 'row between', style: { marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--ink-100)' } },
        h('div', {},
          h('div', { class: 'fw-700', style: { fontSize: '1.1rem' } }, '✦ ' + o.order_number),
          h('div', { class: 'muted text-sm' }, new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))),
        h('div', { style: { textAlign: 'right' } },
          statusBadge(o.status),
          h('div', { class: 'fw-700', style: { fontSize: '1.2rem', marginTop: '6px', color: 'var(--accent)' } }, money(o.total)))),
      
      // CUSTOMER DETAILS SECTION - Most Important for Founder!
      h('div', { style: { background: '#f0f9ff', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #bae6fd' } },
        h('div', { class: 'fw-700', style: { marginBottom: '12px', fontSize: '1rem', color: '#0369a1' } }, '👤 CUSTOMER DETAILS (For Delivery Preparation)'),
        h('div', { class: 'row gap-4 wrap' },
          // Customer Name & Contact
          h('div', { style: { flex: '1', minWidth: '250px' } },
            h('div', { class: 'text-xs muted', style: { marginBottom: '4px' } }, 'NAME'),
            h('div', { class: 'fw-600' }, customer.name || 'N/A'),
            h('div', { class: 'text-xs muted', style: { marginTop: '8px', marginBottom: '4px' } }, 'CONTACT'),
            h('div', { class: 'fw-600' }, customer.mobile || customer.email || 'N/A')),
          // Shipping Address
          h('div', { style: { flex: '2', minWidth: '300px' } },
            h('div', { class: 'text-xs muted', style: { marginBottom: '4px' } }, 'SHIPPING ADDRESS'),
            address.line1 ? h('div', { class: 'fw-600' }, 
              h('div', {}, address.line1),
              address.line2 ? h('div', {}, address.line2) : null,
              h('div', {}, `${address.city || ''}, ${address.state || ''} ${address.pincode || ''}`),
              address.landmark ? h('div', { class: 'text-sm muted' }, 'Landmark: ' + address.landmark) : null
            ) : h('div', { class: 'muted' }, 'No address provided')))),
      
      // T-SHIRT CUSTOMIZATION DETAILS
      ...items.map((it) => {
        const variant = it.variant || {};
        const cust = it.customization;
        return h('div', { style: { background: 'white', border: '1px solid var(--ink-200)', borderRadius: '12px', padding: '16px', marginBottom: '12px' } },
          h('div', { class: 'fw-700', style: { marginBottom: '12px', fontSize: '1rem' } }, '👕 T-SHIRT CUSTOMIZATION'),
          h('div', { class: 'row gap-4', style: { alignItems: 'flex-start' } },
            // T-shirt Visual Preview
            h('div', { style: { width: '120px', flexShrink: '0' } },
              h('div', { style: { 
                width: '120px', 
                height: '120px', 
                background: variant.color || '#f5f5f3', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '48px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                border: '2px solid var(--ink-200)'
              } }, '👕'),
              h('div', { class: 'text-xs text-center fw-600', style: { marginTop: '8px' } }, variant.color || 'Default')),
            
            // Customization Details
            h('div', { class: 'grow' },
              h('div', { class: 'fw-700', style: { marginBottom: '8px' } }, it.name + (it.isCustom ? ' (Custom Design)' : '')),
              
              // Variant Details (Color, Size, Fit)
              h('div', { style: { background: 'var(--ink-50)', padding: '12px', borderRadius: '8px', marginBottom: '12px' } },
                h('div', { class: 'text-xs fw-700 muted', style: { marginBottom: '6px' } }, 'SPECIFICATIONS'),
                h('div', { class: 'row gap-3 wrap' },
                  variant.color ? h('div', {}, h('span', { class: 'text-xs muted' }, 'Color: '), h('span', { class: 'fw-600' }, variant.color)) : null,
                  variant.size ? h('div', {}, h('span', { class: 'text-xs muted' }, 'Size: '), h('span', { class: 'fw-600' }, variant.size)) : null,
                  variant.fit ? h('div', {}, h('span', { class: 'text-xs muted' }, 'Fit: '), h('span', { class: 'fw-600' }, variant.fit)) : null,
                  h('div', {}, h('span', { class: 'text-xs muted' }, 'Quantity: '), h('span', { class: 'fw-600' }, it.quantity)))),
              
              // Custom Design Details
              cust ? h('div', { style: { background: '#fff7ed', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' } },
                h('div', { class: 'text-xs fw-700', style: { marginBottom: '8px', color: '#c2410c' } }, '🎨 CUSTOM DESIGN DETAILS'),
                h('div', { class: 'col gap-2' },
                  cust.front?.elements?.length ? h('div', {},
                    h('div', { class: 'fw-600 text-sm' }, `FRONT: ${cust.front.elements.length} element(s)`),
                    h('div', { class: 'col gap-1', style: { marginTop: '6px', paddingLeft: '12px' } },
                      ...cust.front.elements.map(e => {
                        if (e.type === 'text') {
                          return h('div', { style: { fontStyle: e.italic ? 'italic' : 'normal', fontWeight: e.bold ? '700' : '400', color: e.color || '#0a0a0a', background: 'white', padding: '6px 8px', borderRadius: '4px' } }, `📝 Text: "${e.value}"`);
                        } else if (e.type === 'image') {
                          return h('div', { style: { background: 'white', padding: '6px 8px', borderRadius: '4px' } }, `🖼️ Image uploaded (${e.width || 100}x${e.height || 100}px)`);
                        }
                        return null;
                      }))) : h('div', { class: 'text-sm muted' }, 'FRONT: No custom design'),
                  cust.back?.elements?.length ? h('div', { style: { marginTop: '8px' } },
                    h('div', { class: 'fw-600 text-sm' }, `BACK: ${cust.back.elements.length} element(s)`),
                    h('div', { class: 'col gap-1', style: { marginTop: '6px', paddingLeft: '12px' } },
                      ...cust.back.elements.map(e => {
                        if (e.type === 'text') {
                          return h('div', { style: { fontStyle: e.italic ? 'italic' : 'normal', fontWeight: e.bold ? '700' : '400', color: e.color || '#0a0a0a', background: 'white', padding: '6px 8px', borderRadius: '4px' } }, `📝 Text: "${e.value}"`);
                        } else if (e.type === 'image') {
                          return h('div', { style: { background: 'white', padding: '6px 8px', borderRadius: '4px' } }, `🖼️ Image uploaded`);
                        }
                        return null;
                      }))) : h('div', { class: 'text-sm muted', style: { marginTop: '8px' } }, 'BACK: No custom design')
                )) : h('div', { class: 'text-sm muted' }, 'No customization'),
              
              h('div', { class: 'fw-600', style: { marginTop: '12px', fontSize: '1.1rem' } }, `Price: ${money(it.price)} × ${it.quantity} = ${money(it.price * it.quantity)}`))
          ));
      }),
      
      // Order Status Update
      h('div', { style: { marginTop: '16px', paddingTop: '16px', borderTop: '2px solid var(--ink-100)' } },
        h('div', { class: 'row gap-3', style: { alignItems: 'center' } },
          h('label', { class: 'fw-600' }, 'Update Order Status:'),
          h('select', { class: 'input', style: { maxWidth: '220px' }, onchange: async (e) => { 
            try { 
              await api.post('/admin/orders/' + o.id + '/status', { status: e.target.value }); 
              toast('✅ Order status updated to ' + e.target.value, 'success'); 
              setTimeout(() => location.reload(), 1000);
            } catch (err) { toast('❌ ' + err.message, 'error'); } 
          } },
            ...['PAID', 'CONFIRMED', 'PRINTING', 'QUALITY_CHECK', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map(s => 
              h('option', { value: s, selected: s === o.status }, s.replace(/_/g, ' ')))),
          h('a', { href: `#/admin/orders/${o.id}`, class: 'btn btn-ghost btn-sm' }, 'View Full Details')))));
  }
  
  return card('Custom Orders - Complete Details for Production', wrap);
}

async function products() {
  const { items } = await api.get('/products', { limit: 100 });
  const head = h('div', { class: 'row between', style: { marginBottom: '16px', alignItems: 'center' } },
    h('h3', { style: { margin: 0 } }, 'Products'),
    h('button', { class: 'btn btn-primary btn-sm', onclick: () => showAddProduct() }, '+ Add product'));
  const rows = items.map((p) => h('tr', {},
    h('td', {}, h('div', { class: 'fw-600' }, p.name), h('div', { class: 'muted text-xs' }, (p.collection || '') + (p.customizable ? ' · Customizable' : ''))),
    h('td', {}, (p.colors || []).join(', ') || '—'),
    h('td', {}, (p.sizes || []).join(', ') || '—'),
    h('td', {}, money(p.price)),
    h('td', {}, String(p.stock)),
    h('td', {}, h('button', { class: 'btn btn-ghost btn-sm', style: { color: 'var(--ZUNO-danger)' }, onclick: async () => { if (confirm('Deactivate ' + p.name + '?')) { await api.del('/admin/products/' + p.id); toast('Deactivated', 'success'); location.reload(); } } }, 'Deactivate'))));
  const table = h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Product'), h('th', {}, 'Colors'), h('th', {}, 'Sizes'), h('th', {}, 'Price'), h('th', {}, 'Stock'), h('th', {}, ''))), ...rows));
  return card('', head, table);
}

function showAddProduct() {
  const name = h('input', { class: 'input', placeholder: 'Product name — e.g. ZUNO Essential Tee' });
  const price = h('input', { class: 'input', type: 'number', placeholder: 'Price in paise — e.g. 129900 for ₹1299' });
  const mrp = h('input', { class: 'input', type: 'number', placeholder: 'MRP in paise' });
  const stock = h('input', { class: 'input', type: 'number', placeholder: 'Stock' });
  const colors = h('input', { class: 'input', placeholder: 'Colors comma-separated — e.g. black,white,beige' });
  const sizes = h('input', { class: 'input', placeholder: 'Sizes — e.g. S,M,L,XL' });
  const catSel = h('select', { class: 'input' });
  // Load categories
  api.get('/categories', { module: 'shop' }).then(({ categories }) => {
    categories.forEach(c => {
      if (!c.parent_id) {
        catSel.append(h('option', { value: c.id }, c.name));
        (c.children || []).forEach(ch => catSel.append(h('option', { value: ch.id }, '— ' + ch.name)));
      }
    });
  });
  const content = h('div', {},
    h('h3', {}, 'Add product'),
    h('div', { class: 'col gap-3', style: { marginTop: '12px' } },
      h('div', { class: 'field' }, h('label', {}, 'Name'), name),
      h('div', { class: 'row gap-3' }, h('div', { class: 'field grow' }, h('label', {}, 'Price (paise)'), price), h('div', { class: 'field grow' }, h('label', {}, 'MRP'), mrp)),
      h('div', { class: 'field' }, h('label', {}, 'Stock'), stock),
      h('div', { class: 'field' }, h('label', {}, 'Category'), catSel),
      h('div', { class: 'field' }, h('label', {}, 'Colors'), colors),
      h('div', { class: 'field' }, h('label', {}, 'Sizes'), sizes),
      h('button', { class: 'btn btn-primary btn-block', onclick: async () => {
        try {
          await api.post('/admin/products', {
            name: name.value, categoryId: Number(catSel.value), price: Number(price.value), mrp: Number(mrp.value), stock: Number(stock.value),
            colors: colors.value.split(',').map(s => s.trim()).filter(Boolean),
            sizes: sizes.value.split(',').map(s => s.trim()).filter(Boolean),
          });
          toast('Product created', 'success'); location.reload();
        } catch (e) { toast(e.message, 'error'); }
      } }, 'Create product')));
  modal(content);
}

async function users() {
  const { users } = await api.get('/admin/users');
  const rows = users.map((u) => h('tr', {}, h('td', {}, u.name), h('td', {}, u.email || u.mobile), h('td', {}, u.role_id === 2 ? 'ADMIN' : 'USER'), h('td', {}, statusBadge(u.status))));
  return card('Customers', h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Contact'), h('th', {}, 'Role'), h('th', {}, 'Status'))), ...rows));
}

function stat(v, l) { 
  const icons = {
    'Revenue': '💰',
    'Orders': '📦',
    'Custom orders': '✨',
    'Customers': '👥',
    'Today': '📅',
    'AOV': '📊'
  };
  const icon = icons[l] || '📈';
  
  return h('div', { class: 'stat' }, 
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } },
      h('span', { style: { fontSize: '32px' } }, icon),
      h('div', { style: { fontSize: '0.7rem', fontWeight: '700', color: '#10b981', background: '#d1fae5', padding: '4px 8px', borderRadius: '6px' } }, '▲ Live')),
    h('div', { class: 'v' }, v), 
    h('div', { class: 'l' }, l)); 
}
function card(title, ...body) { return h('div', { class: 'card card-pad' }, title ? h('h3', {}, title) : null, ...body); }
