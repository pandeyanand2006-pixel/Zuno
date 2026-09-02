import { h, mount } from './ui.js';
import { route, startRouter } from './router.js';
import { Store } from './store.js';
import { api } from './api.js';
import { topBar, bottomNav, footer, refreshCart } from './components.js';

import { Home } from './pages/home.js';
import { Login, Register } from './pages/auth.js';
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
import { Admin } from './pages/admin.js';
import { SellerDashboard, RestaurantDashboard, ProviderDashboard } from './pages/partner.js';
import { Customize } from './pages/customize.js';
import { About } from './pages/about.js';

// Register routes
route('/', Home);
route('/login', Login);
route('/register', Register);
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
route('/customize', Customize);
route('/about', About);
route('/admin', Admin);
route('/seller', SellerDashboard);
route('/restaurant-admin', RestaurantDashboard);
route('/provider-admin', ProviderDashboard);
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

// Theme toggle reflects in nav icon automatically via re-render.
Store.on(() => { /* re-render handled by router on navigation */ });

(async () => {
  await Store.loadMe().catch(() => {});
  const cfg = await api.get('/config').catch(() => null);
  if (cfg) Store.setConfig(cfg);
  await refreshCart().catch(() => {});
  await Store.loadWishlist().catch(() => {});
  startRouter({ main, top, bottom: bot });
})();
