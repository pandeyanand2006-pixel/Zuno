import { h, money, modal } from './ui.js';

let rzpPromise = null;
function loadRzp() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (rzpPromise) return rzpPromise;
  rzpPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Could not load Razorpay'));
    document.head.append(s);
  });
  return rzpPromise;
}

// onSuccess(razorpayOrderId, razorpayPaymentId, razorpaySignature)
export async function runPayment({ razorpay, onSuccess, onDismiss }) {
  if (!razorpay) { onDismiss && onDismiss(); return; }
  // Lazy demo: sheet opened before the order exists (caller creates order inside onSuccess).
  if (razorpay.testMode && !razorpay.orderId) {
    showTestSheet(razorpay, onSuccess);
    return;
  }
  if (razorpay.testMode) {
    showTestSheet(razorpay, onSuccess);
    return;
  }
  try {
    const Rzp = await loadRzp();
    const rzp = new Rzp({
      key: razorpay.key,
      amount: razorpay.amount,
      currency: razorpay.currency,
      order_id: razorpay.orderId,
      name: 'ZUNO',
      description: 'Order payment',
      handler: (r) => onSuccess(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature),
      modal: { ondismiss: () => onDismiss && onDismiss() },
      theme: { color: '#4F46E5' },
    });
    rzp.open();
  } catch (e) {
    onDismiss && onDismiss();
  }
}

function chip(label) {
  return h('span', { class: 'chip' }, label);
}

function showTestSheet(razorpay, onSuccess) {
  let method = 'card';
  const methods = [
    { key: 'upi', label: 'UPI', ph: 'name@bank' },
    { key: 'card', label: 'Card', ph: '1234 5678 9012 3456' },
    { key: 'nb', label: 'Netbanking', ph: 'Select your bank' },
    { key: 'wallet', label: 'Wallet', ph: 'PhonePe / Paytm / Amazon' },
  ];
  const input = h('input', { class: 'input', placeholder: methods[0].ph, style: { marginTop: '12px' } });
  const methodRow = h('div', { class: 'row gap-2 wrap' });
  methods.forEach((m) => {
    const btn = h('button', { type: 'button', class: 'chip' + (m.key === method ? ' chip-active' : ''), onclick: () => { method = m.key; input.placeholder = m.ph; methodRow.querySelectorAll('button').forEach((b) => b.classList.remove('chip-active')); btn.classList.add('chip-active'); } }, m.label);
    methodRow.append(btn);
  });
  const content = h('div', {},
    h('div', { class: 'row between', style: { marginBottom: '10px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' } }, h('span', { class: 'logo', style: { width: '28px', height: '28px', fontSize: '14px' } }, 'Z'), 'ZUNO'),
      h('span', { class: 'badge badge-warning' }, 'Test mode')),
    h('div', { style: { fontSize: 'var(--fs-2xl)', fontWeight: '800' } }, money(razorpay.amount)),
    h('p', { class: 'muted text-sm' }, 'Secured by Razorpay · demo payment (no real charge)'),
    methodRow,
    input,
    h('button', { class: 'btn btn-primary btn-block btn-lg', style: { marginTop: '14px' }, onclick: () => { m.close(); onSuccess(razorpay.orderId, razorpay.paymentId, razorpay.signature); } }, 'Pay ' + money(razorpay.amount)),
    h('button', { class: 'btn btn-ghost btn-block', style: { marginTop: '8px' }, onclick: () => m.close() }, 'Cancel'),
    h('p', { class: 'muted text-xs center', style: { marginTop: '10px' } }, '🔒 Secured by Razorpay'));
  const m = modal(content);
}
