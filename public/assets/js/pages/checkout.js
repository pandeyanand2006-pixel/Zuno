import { h, money, toast, emptyState } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart } from '../components.js';
import { runPayment } from '../pay.js';

export async function Checkout() {
  const root = h('div', { class: 'container section' });
  if (!Store.isAuthed()) { root.append(emptyState({ icon: '🔐', title: 'Sign in to checkout', action: h('a', { class: 'btn btn-primary', href: '#/login' }, 'Sign in') })); return root; }

  const module = new URLSearchParams(location.hash.split('?')[1] || '').get('module') || 'shop';
  const summary = await api.get('/cart/summary');
  const cart = summary[module];
  if (!cart || !cart.items.length) { root.append(emptyState({ icon: '🛒', title: 'Nothing to checkout', action: h('a', { class: 'btn btn-primary', href: '#/' + module }, 'Browse ' + module) })); return root; }

  let addresses = await api.get('/users/addresses');
  let selectedAddress = addresses[0]?.id || null;
  let coupon = null;
  let payBtn = null;

  const left = h('div', { class: 'col gap-5' });
  const right = h('div', { class: 'card card-pad elevated', style: { position: 'sticky', top: 'calc(var(--nav-h) + 16px)' } });

  let customerNotes = '';
  root.append(h('h1', { style: { fontFamily: 'var(--font-display)' } }, 'Checkout'), h('div', { class: 'split' }, left, h('div', {}, right)));

  renderAddress();
  renderItems();
  renderNotes();
  renderSummary();

  function renderNotes() {
    const box = h('div', { class: 'card card-pad' },
      h('h3', {}, 'Order notes'),
      h('p', { class: 'muted text-sm', style: { marginBottom: '8px' } }, 'Add instructions for your order or custom design (optional)'),
      h('textarea', {
        class: 'input', placeholder: 'e.g. Please print design in center chest, higher placement...', rows: '3',
        style: { minHeight: '80px', resize: 'vertical' },
        value: customerNotes,
        oninput: (e) => { customerNotes = e.target.value; }
      }));
    replaceIn(left, box, 'notes');
  }

  function renderAddress() {
    const box = h('div', { class: 'card card-pad' }, h('h3', {}, 'Delivery address'));
    if (!addresses.length) box.append(h('p', { class: 'muted' }, 'Add a delivery address to continue.'));
    addresses.forEach((a) => {
      box.append(h('label', { class: 'row gap-3', style: { padding: '12px', border: '1px solid ' + (a.id === selectedAddress ? 'var(--zuno-primary)' : 'var(--ink-200)'), borderRadius: 'var(--r-md)', marginBottom: '8px', cursor: 'pointer', background: a.id === selectedAddress ? 'var(--zuno-primary-50)' : 'transparent' } },
        h('input', { type: 'radio', name: 'addr', checked: a.id === selectedAddress, onchange: () => { selectedAddress = a.id; renderAddress(); } }),
        h('div', {}, h('div', { class: 'fw-600' }, (a.label ? a.label + ' · ' : '') + a.line1), h('div', { class: 'muted text-sm' }, a.city + ' ' + a.pincode))));
    });
    box.append(h('button', { class: 'btn btn-outline btn-sm', onclick: addAddress }, '+ Add new address'));
    replaceIn(left, box, 'address');
  }

  async function addAddress() {
    const line1 = h('input', { class: 'input', placeholder: 'Flat / House / Street' });
    const city = h('input', { class: 'input', placeholder: 'City' });
    const pincode = h('input', { class: 'input', placeholder: 'PIN code' });
    const form = h('div', { class: 'card card-pad', style: { marginTop: '12px' } },
      h('div', { class: 'field' }, h('label', {}, 'Address'), line1),
      h('div', { class: 'field' }, h('label', {}, 'City'), city),
      h('div', { class: 'field' }, h('label', {}, 'PIN code'), pincode),
      h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
        try { const a = await api.post('/users/addresses', { line1: line1.value, city: city.value, pincode: pincode.value }); addresses = await api.get('/users/addresses'); selectedAddress = a.address.id; renderAddress(); toast('Address added', 'success'); }
        catch (e) { toast(e.message, 'error'); }
      } }, 'Save address'));
    replaceIn(left, form, 'newaddr');
  }

  function renderItems() {
    const box = h('div', { class: 'card card-pad' }, h('h3', {}, 'Items'),
      ...cart.items.map((it) => h('div', { class: 'row between', style: { padding: '8px 0' } }, h('span', {}, it.quantity + '× ' + it.name), h('span', { class: 'fw-600' }, money(it.lineTotal)))));
    replaceIn(left, box, 'items');
  }

  function renderSummary() {
    const subtotal = cart.subtotal;
    const discount = coupon ? coupon.discount : 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * 0.05);
    const total = taxable + tax;
    const box = h('div', {}, h('h3', {}, 'Price details'),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Subtotal'), h('span', {}, money(subtotal))),
      coupon && h('div', { class: 'row between' }, h('span', { class: 'discount' }, 'Coupon ' + coupon.code), h('span', { class: 'discount' }, '− ' + money(discount))),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Delivery fee'), h('span', {}, money(0))),
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Tax (GST)'), h('span', {}, money(tax))),
      h('div', { class: 'divider' }),
      h('div', { class: 'row between' }, h('strong', {}, 'Total'), h('strong', { style: { fontSize: 'var(--fs-lg)' } }, money(total))));

    const couponInput = h('input', { class: 'input', placeholder: 'Have a coupon? (try ZUNO100)' });
    const couponBtn = h('button', { class: 'btn btn-outline btn-sm', onclick: applyCoupon }, 'Apply');
    const couponRow = h('div', { class: 'row gap-2', style: { margin: '12px 0' } }, couponInput, couponBtn);

    payBtn = h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: startPayment }, 'Pay ' + money(total) + ' securely');
    box.append(couponRow, h('p', { class: 'muted text-xs' }, 'Secured by Razorpay. We never store your card details.'), payBtn);
    replaceIn(right, box, 'summary');
  }

  async function applyCoupon() {
    const code = couponInput.value.trim();
    if (!code) return;
    try { const r = await api.post('/coupons/validate', { code, module, subtotal: cart.subtotal }); if (r.valid) { coupon = r; toast('Coupon applied', 'success'); } else { coupon = null; toast(r.message || 'Invalid coupon', 'error'); } renderSummary(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function cartTotal() {
    const subtotal = cart.subtotal;
    const discount = coupon ? coupon.discount : 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * 0.05);
    return taxable + tax;
  }

  async function startPayment() {
    if (!selectedAddress) { toast('Please select a delivery address', 'warning'); return; }
    if (!cart.items.length) { toast('Your cart is empty', 'warning'); return; }
    payBtn.disabled = true; payBtn.textContent = 'Opening payment…';

    // In demo/test mode we open the Razorpay-style sheet immediately; the order
    // (and Razorpay order) are created only when the user confirms inside the sheet.
    const onPay = async (oid, pid, sig) => {
      try {
        let order = null;
        if (!oid) {
          order = await api.post('/orders', { module, addressId: selectedAddress, couponCode: coupon ? coupon.code : undefined, customerNotes: customerNotes || undefined });
          const { razorpay } = await api.post('/payments/create', { orderId: order.orderId });
          oid = razorpay.orderId; pid = razorpay.paymentId; sig = razorpay.signature;
        }
        await verifyAndConfirm(oid, pid, sig, order);
      } catch (err) {
        toast('Payment failed: ' + err.message, 'error');
        payBtn.disabled = false; payBtn.textContent = 'Pay securely';
      }
    };

    try {
      const testMode = typeof Store.isRazorpayTestMode === 'function' ? Store.isRazorpayTestMode() : true;
      if (testMode) {
        await runPayment({
          razorpay: { testMode: true, amount: Math.round(cartTotal() * 100), currency: 'INR', orderId: null, paymentId: null, signature: null },
          onSuccess: onPay,
          onDismiss: () => { payBtn.disabled = false; payBtn.textContent = 'Pay securely'; },
        });
      } else {
        const order = await api.post('/orders', { module, addressId: selectedAddress, couponCode: coupon ? coupon.code : undefined, customerNotes: customerNotes || undefined });
        const { razorpay } = await api.post('/payments/create', { orderId: order.orderId });
        await runPayment({
          razorpay,
          onSuccess: (oid, pid, sig) => verifyAndConfirm(oid, pid, sig, order),
          onDismiss: () => { payBtn.disabled = false; payBtn.textContent = 'Pay securely'; },
        });
      }
    } catch (err) {
      toast(err.message, 'error'); payBtn.disabled = false; payBtn.textContent = 'Pay securely';
    }
  }

  async function verifyAndConfirm(razorpayOrderId, razorpayPaymentId, razorpaySignature, order) {
    try {
      await api.post('/payments/verify', { orderId: order.orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature });
      await refreshCart();
      showConfirmation(order);
    } catch (err) {
      toast('Payment could not be verified: ' + err.message, 'error');
      payBtn.disabled = false; payBtn.textContent = 'Pay securely';
    }
  }

  function showConfirmation(order) {
    root.innerHTML = '';
    root.append(h('div', { class: 'container-narrow section center' },
      h('div', { class: 'em-ic', style: { background: 'var(--zuno-success-50)', color: 'var(--zuno-success)', fontSize: '40px', width: '88px', height: '88px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' } }, '✓'),
      h('h1', {}, 'Payment successful'),
      h('p', { class: 'muted' }, 'Order ' + order.orderNumber + ' is confirmed and being prepared.'),
      h('div', { class: 'row gap-3', style: { justifyContent: 'center', marginTop: '20px' } },
        h('a', { class: 'btn btn-primary', href: '#/orders/' + order.orderId }, 'Track order'),
        h('a', { class: 'btn btn-outline', href: '#/' }, 'Continue shopping'))));
  }

  function replaceIn(container, node, marker) {
    const existing = container.querySelector('[data-marker="' + marker + '"]');
    if (existing) existing.replaceWith(node); else container.append(node);
    node.setAttribute('data-marker', marker);
  }

  return root;
}
