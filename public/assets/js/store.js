import { toast } from './ui.js';

const TOKEN_KEY = 'zuno_token';
const THEME_KEY = 'zuno_theme';
const GUEST_KEY = 'zuno_guest_cart';

const listeners = new Set();

export const Store = {
  _token: localStorage.getItem(TOKEN_KEY) || null,
  _user: null,
  _cart: null,
  _config: null,
  _wishlist: new Set(),
  _guest: JSON.parse(localStorage.getItem(GUEST_KEY) || '[]'),

  setConfig(c) { this._config = c; },
  getConfig() { return this._config; },
  // True when no real Razorpay keys are configured (demo/test mode).
  isRazorpayTestMode() { return !this._config || this._config.razorpayTestMode !== false; },

  // ---- Wishlist ----
  setWishlist(ids) { this._wishlist = new Set((ids || []).map(Number)); this.emit(); },
  isWished(id) { return this._wishlist.has(Number(id)); },
  async loadWishlist() {
    if (!this.isAuthed()) { this._wishlist = new Set(); this.emit(); return; }
    try {
      const { api } = await import('./api.js');
      const { items } = await api.get('/wishlist');
      this._wishlist = new Set((items || []).map((i) => i.productId));
      this.emit();
    } catch { this._wishlist = new Set(); }
  },
  async toggleWish(id) {
    if (!this.isAuthed()) { toast('Please sign in to save items', 'warning'); location.hash = '#/login'; return; }
    const idn = Number(id);
    try {
      const { api } = await import('./api.js');
      if (this.isWished(idn)) {
        await api.del('/wishlist/' + idn);
        this._wishlist.delete(idn);
        toast('Removed from wishlist', 'success');
      } else {
        await api.post('/wishlist', { productId: idn });
        this._wishlist.add(idn);
        toast('Saved to wishlist', 'success');
      }
      this.emit();
    } catch (e) { toast(e.message, 'error'); }
  },

  getToken() { return this._token; },
  setToken(t) { this._token = t; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); this.emit(); },
  getUser() { return this._user; },
  setUser(u) { this._user = u; this.emit(); },
  isAuthed() { return !!this._token; },

  async loadMe() {
    if (!this._token) return null;
    try {
      const { user } = await (await import('./api.js')).api.get('/auth/me');
      this._user = user;
      this.emit();
      return user;
    } catch {
      this.setToken(null); this._user = null;
      return null;
    }
  },

  setCart(c) { this._cart = c; this.emit(); },
  getCart() { return this._cart; },
  cartCount() {
    if (this._token) {
      const c = this._cart;
      if (!c) return this.guestCount();
      return (c.shop?.count || 0) + (c.grocery?.count || 0) + (c.food?.count || 0);
    }
    return this.guestCount();
  },

  // ---- Guest cart (localStorage) ----
  getGuest() { return this._guest; },
  guestCount() { return this._guest.reduce((a, b) => a + (b.quantity || 0), 0); },
  saveGuest() { localStorage.setItem(GUEST_KEY, JSON.stringify(this._guest)); this.emit(); },
  addGuestItem(item) {
    const qty = item.quantity || 1;
    const ex = this._guest.find((i) => i.productId === item.productId);
    if (ex) ex.quantity = Math.min(20, ex.quantity + qty);
    else this._guest.push({ productId: item.productId, name: item.name, price: item.price, mrp: item.mrp, slug: item.slug, image: item.image || null, module: item.module || 'shop', quantity: qty });
    this.saveGuest();
  },
  setGuestQty(productId, qty) {
    const it = this._guest.find((i) => i.productId === productId);
    if (!it) return;
    if (qty <= 0) this._guest = this._guest.filter((i) => i.productId !== productId);
    else it.quantity = Math.max(1, Math.min(20, Math.floor(qty) || 1));
    this.saveGuest();
  },
  removeGuestItem(productId) {
    this._guest = this._guest.filter((i) => i.productId !== productId);
    this.saveGuest();
  },
  clearGuest() { this._guest = []; this.saveGuest(); },
  async mergeGuestToServer() {
    if (!this._guest.length) return;
    const { api } = await import('./api.js');
    for (const it of this._guest) {
      try { await api.post('/cart/items?module=' + (it.module || 'shop'), { productId: it.productId, quantity: it.quantity }); } catch { /* ignore */ }
    }
    this.clearGuest();
    try { this.setCart(await api.get('/cart/summary')); } catch { /* ignore */ }
  },


  toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    this.emit();
  },

  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach((fn) => fn(this)); },
};

// restore theme
const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
