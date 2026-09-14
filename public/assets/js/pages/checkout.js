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
  let selectedAddress = addresses[0]?.id || addresses[0]?._id || null;
  if (selectedAddress) selectedAddress = String(selectedAddress);
  let coupon = null;
  let couponInput = null;
  let payBtn = null;
  let paymentMethod = 'cod'; // default to COD for immediate working flow — user wanted COD fully working

  const left = h('div', { class: 'col gap-5' });
  const right = h('div', { class: 'card card-pad elevated', style: { position: 'sticky', top: 'calc(var(--nav-h) + 16px)' } });

  let customerNotes = '';
  root.append(h('h1', { style: { fontFamily: 'var(--font-display)' } }, 'Checkout'), h('div', { class: 'split' }, left, h('div', {}, right)));

  renderAddress();
  renderItems();
  renderNotes();
  renderSummary();
  renderPaymentMethod();
  // Buy Now → auto-scroll to details/proceed section (address + payment) like Proceed flow
  try {
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    if (qs.get('from') === 'buyNow' || qs.get('scroll') === 'details') {
      setTimeout(() => {
        const addrEl = left.querySelector('[data-marker="address"]');
        const payEl = left.querySelector('[data-marker="paymethod"]');
        const target = addrEl || payEl || left;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const origBg = target.style.background;
          const origBo = target.style.border;
          target.style.border = '2px solid #0f172a';
          target.style.background = '#f8fafc';
          target.style.transition = 'all 0.3s ease';
          setTimeout(() => { target.style.border = origBo; target.style.background = origBg; }, 1800);
          toast('Details ready — choose address and payment, then Place order', 'info');
        }
      }, 380);
    }
  } catch {}

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
    const box = h('div', { class: 'card card-pad' }, h('div', { class: 'row between' }, h('h3', {}, 'Delivery address'), h('span', { class: 'muted text-xs' }, 'Auto-detect or add manually')));
    if (!addresses.length) box.append(h('p', { class: 'muted' }, 'Add a delivery address to continue.'));
    addresses.forEach((a) => {
      const aid = String(a._id || a.id);
      const isSel = aid === String(selectedAddress);
      const line = [a.house_no, a.line1].filter(Boolean).join(', ') || a.line1;
      const line2 = [a.landmark, a.area, a.line2].filter(Boolean).join(', ');
      box.append(h('label', { class: 'row gap-3', style: { padding: '12px', border: '1px solid ' + (isSel ? 'var(--primary-denim)' : 'var(--ink-200)'), borderRadius: 'var(--r-md)', marginBottom: '8px', cursor: 'pointer', background: isSel ? 'var(--light-indigo)' : 'transparent' } },
        h('input', { type: 'radio', name: 'addr', checked: isSel, onchange: () => { selectedAddress = aid; renderAddress(); renderSummary(); } }),
        h('div', { style: { flex: 1 } },
          h('div', { class: 'fw-600' }, (a.label ? a.label + ' · ' : '') + line),
          line2 ? h('div', { class: 'muted text-sm' }, line2) : null,
          h('div', { class: 'muted text-sm' }, [a.city, a.state, a.pincode].filter(Boolean).join(', ')),
          (a.latitude && a.longitude) ? h('div', { class: 'text-xs', style: { color: 'var(--zuno-success)' } }, `📍 ${Number(a.latitude).toFixed(4)}, ${Number(a.longitude).toFixed(4)}`) : null
        )));
    });
    box.append(h('button', { class: 'btn btn-outline btn-sm', onclick: addAddress }, '+ Add new address'));
    replaceIn(left, box, 'address');
  }

  async function addAddress() {
    const label = h('input', { class: 'input', placeholder: 'Label (Home / Office) — optional' });
    const houseNo = h('input', { class: 'input', placeholder: 'House No., Building, Apartment *' });
    const street = h('input', { class: 'input', placeholder: 'Street, Road, Area * (e.g. MG Road)' });
    const landmark = h('input', { class: 'input', placeholder: 'Landmark (e.g. Near City Mall) — optional' });
    const area = h('input', { class: 'input', placeholder: 'Locality / Area — optional' });
    const city = h('input', { class: 'input', placeholder: 'City *' });
    const state = h('input', { class: 'input', placeholder: 'State (e.g. Maharashtra)' });
    const pincode = h('input', { class: 'input', placeholder: 'PIN code * (6 digits)', inputmode: 'numeric' });
    let lat = null, lon = null;
    const latLonInfo = h('div', { class: 'muted text-xs', style: { marginTop: '6px' } }, 'No location captured. Use auto-detect or enter manually.');
    const geoBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '📍 Use my current location');

    geoBtn.onclick = async () => {
      geoBtn.disabled = true; geoBtn.textContent = 'Detecting…';
      try {
        const pos = await new Promise((res, rej) => {
          if (!navigator.geolocation) return rej(new Error('Geolocation not supported'));
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 });
        });
        lat = pos.coords.latitude; lon = pos.coords.longitude;
        latLonInfo.textContent = `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)} — reverse geocoding…`;
        // Reverse geocode via Nominatim (no key required)
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, { headers: { 'Accept': 'application/json' } });
        const j = await r.json();
        const addr = j.address || {};
        // Fill fields if empty
        if (!houseNo.value && addr.house_number) houseNo.value = addr.house_number;
        if (!street.value && addr.road) street.value = addr.road;
        if (!area.value && (addr.suburb || addr.neighbourhood || addr.hamlet)) area.value = addr.suburb || addr.neighbourhood || addr.hamlet;
        if (!city.value && (addr.city || addr.town || addr.village || addr.county)) city.value = addr.city || addr.town || addr.village || addr.county;
        if (!state.value && addr.state) state.value = addr.state;
        if (!pincode.value && addr.postcode) pincode.value = String(addr.postcode).replace(/\s/g,'').slice(0,6);
        // Compose line1 preview
        latLonInfo.textContent = `📍 ${j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`}`;
        toast('Location detected — please verify house no. and landmark', 'success');
      } catch (e) {
        latLonInfo.textContent = 'Could not detect location: ' + (e.message || 'permission denied');
        toast(e.message, 'error');
      } finally { geoBtn.disabled = false; geoBtn.textContent = '📍 Use my current location'; }
    };

    const form = h('div', { class: 'card card-pad', style: { marginTop: '12px', border: '1px solid var(--primary-denim)' } },
      h('h4', {}, 'Add delivery address'),
      h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } }, geoBtn, h('span', { class: 'muted text-xs', style: { alignSelf: 'center' } }, 'Auto-fill city, PIN, street')),
      h('div', { class: 'field' }, h('label', {}, 'Label (optional)'), label),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        h('div', { class: 'field' }, h('label', {}, 'House No. / Building *'), houseNo),
        h('div', { class: 'field' }, h('label', {}, 'Street / Road *'), street)
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        h('div', { class: 'field' }, h('label', {}, 'Landmark'), landmark),
        h('div', { class: 'field' }, h('label', {}, 'Area / Locality'), area)
      ),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        h('div', { class: 'field' }, h('label', {}, 'City *'), city),
        h('div', { class: 'field' }, h('label', {}, 'PIN code *'), pincode)
      ),
      h('div', { class: 'field' }, h('label', {}, 'State'), state),
      latLonInfo,
      h('div', { class: 'row gap-2', style: { marginTop: '12px' } },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { const el = left.querySelector('[data-marker="newaddr"]'); if (el) el.remove(); } }, 'Cancel'),
        h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
          const hno = houseNo.value.trim();
          const st = street.value.trim();
          const lm = landmark.value.trim();
          const ar = area.value.trim();
          const c = city.value.trim();
          const pc = pincode.value.trim();
          if (!hno || !st || !c || !pc) { toast('Fill House No., Street, City and PIN', 'warning'); return; }
          if (!/^\d{6}$/.test(pc)) { toast('PIN must be 6 digits', 'error'); return; }
          const line1 = [hno, st].filter(Boolean).join(', ');
          const line2 = [lm, ar].filter(Boolean).join(', ');
          try {
            const a = await api.post('/users/addresses', {
              label: label.value.trim() || undefined,
              line1, line2: line2 || undefined,
              house_no: hno || undefined,
              landmark: lm || undefined,
              area: ar || undefined,
              city: c, state: state.value.trim() || undefined,
              pincode: pc,
              latitude: lat ?? undefined,
              longitude: lon ?? undefined,
              is_default: addresses.length === 0
            });
            addresses = await api.get('/users/addresses');
            selectedAddress = String(a.address._id || a.address.id);
            renderAddress(); renderSummary();
            const el = left.querySelector('[data-marker="newaddr"]'); if (el) el.remove();
            toast('Address added', 'success');
          } catch (e) { toast(e.message, 'error'); }
        } }, 'Save address'))
    );
    replaceIn(left, form, 'newaddr');
  }

  function renderItems() {
    const box = h('div', { class: 'card card-pad' }, h('h3', {}, 'Items'),
      ...cart.items.map((it) => h('div', { class: 'row between', style: { padding: '8px 0' } }, h('span', {}, it.quantity + '× ' + it.name), h('span', { class: 'fw-600' }, money(it.lineTotal)))));
    replaceIn(left, box, 'items');
  }

  function renderPaymentMethod() {
    const box = h('div', { class: 'card card-pad' },
      h('h3', {}, 'Payment method'),
      h('label', { class: 'row gap-3', style: { padding: '12px', border: '1px solid ' + (paymentMethod === 'cod' ? 'var(--primary-denim)' : 'var(--ink-200)'), borderRadius: 'var(--r-md)', marginBottom: '8px', cursor: 'pointer', background: paymentMethod === 'cod' ? 'var(--light-indigo)' : 'transparent' } },
        h('input', { type: 'radio', name: 'pay', checked: paymentMethod === 'cod', onchange: () => { paymentMethod = 'cod'; renderPaymentMethod(); renderSummary(); } }),
        h('div', {}, h('div', { class: 'fw-600' }, 'Cash on Delivery (COD)'), h('div', { class: 'muted text-sm' }, 'Pay when your order arrives — no online payment needed'))
      ),
      h('label', { class: 'row gap-3', style: { padding: '12px', border: '1px solid ' + (paymentMethod === 'online' ? 'var(--primary-denim)' : 'var(--ink-200)'), borderRadius: 'var(--r-md)', cursor: 'pointer', background: paymentMethod === 'online' ? 'var(--light-indigo)' : 'transparent' } },
        h('input', { type: 'radio', name: 'pay', checked: paymentMethod === 'online', onchange: () => { paymentMethod = 'online'; renderPaymentMethod(); renderSummary(); } }),
        h('div', {}, h('div', { class: 'fw-600' }, 'Pay Online (Razorpay)'), h('div', { class: 'muted text-sm' }, 'UPI / Card / Netbanking — secured by Razorpay'))
      ),
      paymentMethod === 'online' ? h('p', { class: 'muted text-xs', style: { marginTop: '8px' } }, 'You will be redirected to Razorpay. Test mode works without real credentials; add RAZORPAY_KEY_ID/SECRET in Render to enable live payments.') : h('p', { class: 'text-sm', style: { marginTop: '8px', color: 'var(--zuno-success)', fontWeight: '600' } }, '✓ COD selected — order will be confirmed immediately and visible in admin dashboard.')
    );
    replaceIn(left, box, 'paymethod');
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

    couponInput = h('input', { class: 'input', placeholder: 'Have a coupon? (try ZUNO100)', value: coupon ? coupon.code : '' });
    const couponBtn = h('button', { class: 'btn btn-outline btn-sm', onclick: applyCoupon }, coupon ? 'Remove' : 'Apply');
    if (coupon) {
      couponBtn.onclick = () => { coupon = null; toast('Coupon removed', 'info'); renderSummary(); };
    }
    const couponRow = h('div', { class: 'row gap-2', style: { margin: '12px 0' } }, couponInput, couponBtn);

    const isCod = paymentMethod === 'cod';
    payBtn = h('button', { class: 'btn btn-primary btn-block btn-lg', onclick: startPayment, style: { background: isCod ? 'var(--zuno-success)' : 'var(--primary-denim)' } }, isCod ? `Place order — ${money(total)} (COD)` : `Pay ${money(total)} securely`);

    const infoText = isCod
      ? h('p', { class: 'muted text-xs', style: { marginTop: '8px' } }, 'Cash on Delivery — pay when delivered. Order will appear instantly in admin dashboard.')
      : h('p', { class: 'muted text-xs' }, 'Secured by Razorpay. We never store your card details.');

    box.append(couponRow, infoText, payBtn);
    replaceIn(right, box, 'summary');
  }

  async function applyCoupon() {
    const code = couponInput ? couponInput.value.trim() : '';
    if (!code) { toast('Enter a coupon code', 'warning'); return; }
    try {
      const r = await api.post('/coupons/validate', { code, module, subtotal: cart.subtotal });
      if (r.valid) { coupon = r; toast('Coupon applied: ' + code, 'success'); } else { coupon = null; toast(r.message || 'Invalid coupon', 'error'); }
      renderSummary();
    } catch (e) { toast(e.message, 'error'); }
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
    payBtn.disabled = true;
    payBtn.textContent = paymentMethod === 'cod' ? 'Placing order…' : 'Opening payment…';

    if (paymentMethod === 'cod') {
      try {
        const order = await api.post('/orders', { module, addressId: selectedAddress, couponCode: coupon ? coupon.code : undefined, customerNotes: customerNotes || undefined, paymentMethod: 'cod' });
        await refreshCart();
        showConfirmation(order, 'cod');
      } catch (err) {
        toast(err.message, 'error'); payBtn.disabled = false; payBtn.textContent = `Place order — ${money(cartTotal())} (COD)`;
      }
      return;
    }

    // Online (Razorpay) flow
    const onPay = async (oid, pid, sig) => {
      try {
        let order = null;
        if (!oid) {
          order = await api.post('/orders', { module, addressId: selectedAddress, couponCode: coupon ? coupon.code : undefined, customerNotes: customerNotes || undefined, paymentMethod: 'online' });
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
        const order = await api.post('/orders', { module, addressId: selectedAddress, couponCode: coupon ? coupon.code : undefined, customerNotes: customerNotes || undefined, paymentMethod: 'online' });
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
      showConfirmation(order, 'online');
    } catch (err) {
      toast('Payment could not be verified: ' + err.message, 'error');
      payBtn.disabled = false; payBtn.textContent = 'Pay securely';
    }
  }

  function showConfirmation(order, method) {
    root.innerHTML = '';
    const isCod = method === 'cod';
    root.append(h('div', { class: 'container-narrow section center' },
      h('div', { class: 'em-ic', style: { background: 'var(--zuno-success-50)', color: 'var(--zuno-success)', fontSize: '40px', width: '88px', height: '88px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' } }, '✓'),
      h('h1', {}, isCod ? 'Order placed — COD' : 'Payment successful'),
      h('p', { class: 'muted' }, isCod ? `Order ${order.orderNumber} confirmed. Cash on Delivery — will appear in admin dashboard immediately.` : `Order ${order.orderNumber} is confirmed and being prepared.`),
      h('p', { class: 'muted text-sm', style: { marginTop: '8px' } }, isCod ? 'You will pay when the order is delivered.' : 'Razorpay payment verified securely.'),
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
