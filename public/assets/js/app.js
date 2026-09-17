import { h, mount } from './ui.js';
import { route, startRouter } from './router.js';
import { Store } from './store.js';
import { api } from './api.js';
import { topBar, bottomNav, footer, refreshCart } from './components.js';

import { Home } from './pages/home.js';
import { Login, Register, ForgotPassword, VerifyOtp, ResetPassword, VerifyEmail } from './pages/auth.js';
import { Shop, Grocery } from './pages/shop.js';
import { Product } from './pages/product.js';
import { Cart } from './pages/cart.js';
import { Checkout } from './pages/checkout.js';
import { Orders, OrderDetail } from './pages/orders.js';
import { Wishlist, Notifications } from './pages/wishlist.js';
import { Profile } from './pages/profile.js';
import { Restaurants, Restaurant, FoodCheckout } from './pages/food.js';
import { ServiceProviders, Provider } from './pages/services.js';
import { Search } from './pages/search.js';
import { SellerDashboard, RestaurantDashboard, ProviderDashboard } from './pages/partner.js';
import { Customize } from './pages/customize.js';
import { CustomListing } from './pages/custom.js';
import { About } from './pages/about.js';
import { Admin, AdminLogin, AdminDashboard, AdminOrders, AdminProducts, AdminInventory, AdminCustomers, AdminOrderDetail, AdminProfile, AdminPassword, AdminForgotPassword, AdminVerifyOtp, AdminResetPassword, AdminCustom } from './pages/admin.js';

// Register routes
route('/', Home);
route('/login', Login);
route('/register', Register);
route('/forgot-password', ForgotPassword);
route('/verify-otp', VerifyOtp);
route('/reset-password', ResetPassword);
route('/verify-email', VerifyEmail);
route('/shop', Shop);
route('/grocery', Grocery);
route('/product/:slug', Product);
route('/cart', Cart);
route('/checkout', Checkout);
route('/orders', Orders);
route('/orders/:id', OrderDetail);
route('/wishlist', Wishlist);
route('/notifications', Notifications);
route('/profile', Profile);
route('/profile/:tab', Profile);
route('/food', Restaurants);
route('/food/:slug', Restaurant);
route('/food/checkout', FoodCheckout);
route('/services', ServiceProviders);
route('/services/:slug', Provider);
route('/search', Search);
route('/custom', CustomListing);
route('/custom/:slug', Customize);
route('/customize', Customize);
route('/about', About);
route('/seller', SellerDashboard);
route('/restaurant-admin', RestaurantDashboard);
route('/provider-admin', ProviderDashboard);
// ── Admin Dashboard (protected) ──
route('/admin', AdminDashboard);
route('/admin/login', AdminLogin);
route('/admin/forgot-password', AdminForgotPassword);
route('/admin/verify-otp', AdminVerifyOtp);
route('/admin/reset-password', AdminResetPassword);
route('/admin/orders', AdminOrders);
route('/admin/orders/:id', AdminOrderDetail);
route('/admin/products', AdminProducts);
route('/admin/custom', AdminCustom);
route('/admin/inventory', AdminInventory);
route('/admin/customers', AdminCustomers);
route('/admin/profile', AdminProfile);
route('/admin/password', AdminPassword);
route('/admin/dashboard', AdminDashboard);
// Legacy super-app routes → redirect to shop
route('/grocery', () => { location.hash = '#/shop'; return h('div', { class: 'container section' }, 'Redirecting to shop…'); });
route('/food', () => { location.hash = '#/shop'; return h('div', { class: 'container section' }, 'Redirecting to shop…'); });
route('/food/:slug', () => { location.hash = '#/shop'; return h('div', { class: 'container section' }, 'Redirecting…'); });

// Shell
const app = document.getElementById('app');
const top = document.createElement('div');
const main = h('main', { id: 'main', tabindex: '-1' });
const bot = document.createElement('div');
const foot = footer();
app.append(top, main, bot, foot);

// Keep nav badges in sync without requiring a navigation — update counts in place.
Store.on(() => {
  try {
    const c = String(Store.cartCount() || '');
    const w = String(Store.wishlistCount ? Store.wishlistCount() : (Store._wishlist ? Store._wishlist.size : 0));
    // Update existing badges
    document.querySelectorAll('a[href="#/cart"] .cart-count, a[href="#/wishlist"] .cart-count').forEach(el => {
      const isWish = !!el.closest('a[href="#/wishlist"]');
      const val = isWish ? w : c;
      if (!val || val === '0') el.style.display = 'none';
      else { el.textContent = val; el.style.display = ''; }
    });
    // If badge should exist but doesn't, inject it
    const cartLink = document.querySelector('a[href="#/cart"].icon-btn, .bottom-nav a[href="#/cart"]');
    if (cartLink && Number(c) > 0 && !cartLink.querySelector('.cart-count')) {
      const b = document.createElement('span'); b.className = 'cart-count'; b.textContent = c; cartLink.append(b);
    }
    document.querySelectorAll('a[href="#/cart"].icon-btn').forEach(a => {
      if (Number(c) > 0 && !a.querySelector('.cart-count')) { const b=document.createElement('span'); b.className='cart-count'; b.textContent=c; a.append(b); }
    });
    const wishLink = document.querySelector('a[href="#/wishlist"].icon-btn');
    if (wishLink && Number(w) > 0 && !wishLink.querySelector('.cart-count')) {
      const b = document.createElement('span'); b.className = 'cart-count'; b.style.background='var(--primary-denim)'; b.textContent = w; wishLink.append(b);
    }
  } catch {}
});

// Wake Render before first product fetch — fire-and-forget health ping so first
// /products doesn't pay the 10-15s cold-start tax on zunoshopping.store.
try { fetch((window.ZUNO_API_BASE ? String(window.ZUNO_API_BASE).replace(/\/$/, '') + '/api' : '/api') + '/health', { cache: 'no-store', keepalive: true }).catch(()=>{}); } catch {}
// Start routing immediately so first paint is never blocked on the API.
// Auth/config/cart/wishlist hydrate in the background IN PARALLEL (not sequential)
// so homepage product fetch is never blocked on auth.
startRouter({ main, top, bottom: bot });
(async () => {
  const tasks = [];
  // Auth must resolve first to know user context, but don't block other fetches
  tasks.push(Store.loadMe().catch(() => null));
  tasks.push(api.get('/config').then(cfg => { if(cfg) Store.setConfig(cfg); }).catch(()=>null));
  // cart & wishlist depend on auth but we fire them concurrently; they self-guard via isAuthed()
  tasks.push(refreshCart().catch(()=>null));
  tasks.push(Store.loadWishlist().catch(()=>null));
  await Promise.allSettled(tasks);
})();
