import { h, money, toast, emptyState, skeletonGrid, modal } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { runPayment } from '../pay.js';

export async function ServiceProviders() {
  const root = h('div', { class: 'container section' });
  root.append(h('h1', {}, 'Home & local services'));
  const grid = h('div', { class: 'grid grid-cards' });
  grid.append(skeletonGrid(6));
  root.append(h('div', { class: 'pill-row', style: { marginBottom: '16px' } },
    h('input', { class: 'input', placeholder: 'Search services (AC repair, salon…)', id: 'svc-search', style: { maxWidth: '320px' } }),
    h('button', { class: 'btn btn-outline', onclick: () => load(document.getElementById('svc-search').value) }, 'Search')));
  root.append(grid);
  const load = async (q) => {
    try { const { items } = await api.get('/services/providers', { search: q || undefined, limit: 30 }); grid.innerHTML = '';
      if (!items.length) grid.append(emptyState({ icon: '🔧', title: 'No providers found' }));
      else grid.append(...items.map(ProviderCard)); }
    catch (e) { grid.innerHTML = ''; grid.append(emptyState({ icon: '⚠️', title: 'Failed to load', desc: e.message })); }
  };
  load();
  return root;
}

function ProviderCard(sp) {
  return h('a', { class: 'card', href: '#/services/' + sp.slug, style: { textDecoration: 'none', color: 'inherit', display: 'block' } },
    h('div', { class: 'product-thumb', style: { aspectRatio: '16/9' } }, h('span', { style: { fontSize: '34px' } }, '🔧')),
    h('div', { class: 'product-body' }, h('div', { class: 'product-name' }, sp.name), h('div', { class: 'product-meta' }, sp.category + ' · ★ ' + (sp.rating || '—') + ' · ' + (sp.service_count || 0) + ' services')));
}

export async function Provider({ params }) {
  const root = h('div', { class: 'container section' });
  root.append(h('div', { class: 'sk-card skeleton', style: { height: '220px' } }));
  try {
    const { provider } = await api.get('/services/providers/' + params.slug);
    root.innerHTML = '';
    root.append(h('div', { class: 'card', style: { padding: '20px', marginBottom: '16px', display: 'flex', gap: '20px', alignItems: 'center' } },
      h('div', { class: 'product-thumb', style: { width: '96px' } }, '🔧'),
      h('div', {}, h('h1', { style: { margin: 0 } }, provider.name), h('div', { class: 'muted' }, provider.category + ' · ★ ' + (provider.rating || '—') + ' · ' + provider.city))));
    const list = h('div', { class: 'col gap-3' });
    (provider.services || []).forEach((s) => list.append(h('div', { class: 'card', style: { padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', {}, h('div', { class: 'fw-600' }, s.name), h('div', { class: 'muted text-sm' }, s.duration_minutes + ' min')),
      h('div', { class: 'row gap-3' }, h('span', { class: 'price' }, money(s.price)),
        h('button', { class: 'btn btn-primary btn-sm', onclick: () => openBooking(s, provider) }, 'Book')))));
    root.append(h('h3', {}, 'Services'), list);
  } catch (e) { root.innerHTML = ''; root.append(emptyState({ icon: '⚠️', title: 'Provider not found' })); }
  return root;
}

async function openBooking(service, provider) {
  if (!Store.isAuthed()) { toast('Please sign in to book', 'warning'); location.hash = '#/login'; return; }
  let addresses = await api.get('/users/addresses');
  const date = h('input', { class: 'input', type: 'date' });
  const time = h('input', { class: 'input', type: 'time', value: '10:00' });
  const addrSel = h('select', { class: 'select' }, ...(addresses.length ? addresses.map((a) => h('option', { value: a.id }, (a.label ? a.label + ' · ' : '') + a.line1 + ', ' + a.city)) : [h('option', { value: '' }, 'Add an address first')]));
  const content = h('div', {},
    h('h3', {}, 'Book ' + service.name),
    h('div', { class: 'notice', style: { marginBottom: '12px' } }, provider.name + ' · ' + money(service.price) + ' · ' + service.duration_minutes + ' min'),
    h('div', { class: 'field' }, h('label', {}, 'Date'), date),
    h('div', { class: 'field' }, h('label', {}, 'Time'), time),
    h('div', { class: 'field' }, h('label', {}, 'Address'), addrSel),
    h('button', { class: 'btn btn-primary btn-block', onclick: submit }, 'Confirm & pay ' + money(service.price)));
  modal(content);

  async function submit() {
    if (!date.value) { toast('Choose a date', 'warning'); return; }
    if (!addrSel.value) { toast('Add a delivery address first', 'warning'); return; }
    const amount = Math.round(service.price * 100);
    const onPay = async (oid, pid, sig, bookingId) => {
      try {
        const { booking } = await api.post('/services/bookings', { serviceId: service.id, scheduledDate: date.value, scheduledTime: time.value, addressId: Number(addrSel.value) });
        const { razorpay } = await api.post('/services/bookings/' + booking.id + '/pay');
        oid = razorpay.orderId; pid = razorpay.paymentId; sig = razorpay.signature;
        await api.post('/services/bookings/' + booking.id + '/verify', { razorpayOrderId: oid, razorpayPaymentId: pid, razorpaySignature: sig });
        toast('Booking confirmed & paid', 'success'); location.hash = '#/profile';
      } catch (e) { toast(e.message, 'error'); }
    };
    try {
      if (Store.isRazorpayTestMode()) {
        await runPayment({ razorpay: { testMode: true, amount, currency: 'INR', orderId: null, paymentId: null, signature: null }, onSuccess: onPay, onDismiss: () => {} });
      } else {
        const { booking } = await api.post('/services/bookings', { serviceId: service.id, scheduledDate: date.value, scheduledTime: time.value, addressId: Number(addrSel.value) });
        const { razorpay } = await api.post('/services/bookings/' + booking.id + '/pay');
        await runPayment({ razorpay, onSuccess: (o, p, s) => onPay(o, p, s, booking.id), onDismiss: () => {} });
      }
    } catch (e) { toast(e.message, 'error'); }
  }
}
