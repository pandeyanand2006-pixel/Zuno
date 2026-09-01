// Zuno demo/seed data. Clearly DEVELOPMENT data — not production businesses.
import { db } from '../config/db.js';
import { initializeSchema } from '../config/db.js';
import { hashPassword } from '../utils/password.js';
import { slugify } from '../utils/id.js';
import { logger } from '../utils/logger.js';

function seed() {
  initializeSchema();
  if (db.prepare('SELECT COUNT(*) c FROM roles').get().c === 0) {
    const roles = ['USER', 'ADMIN', 'SELLER', 'RESTAURANT', 'SERVICE_PROVIDER', 'DELIVERY_PARTNER'];
    const ins = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    roles.forEach((r) => ins.run(r, r));
  }
  const count = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (count > 0) {
    logger.info('Seed skipped: data already present');
    return;
  }

  // ---------- Users ----------
  const roleId = (name) => db.prepare('SELECT id FROM roles WHERE name = ?').get(name).id;
  const adminRole = roleId('ADMIN');
  const sellerRole = roleId('SELLER');
  const restRole = roleId('RESTAURANT');
  const provRole = roleId('SERVICE_PROVIDER');
  const adminHash = bcryptHash('Admin@1234');
  db.prepare('INSERT OR IGNORE INTO users (name, email, mobile, password_hash, role_id, email_verified) VALUES (?, ?, ?, ?, ?, 1)')
    .run('Zuno Admin', 'admin@zuno.app', '9999999999', adminHash, adminRole);

  const mkUser = (name, email, mobile, pass, role) =>
    db.prepare('INSERT INTO users (name, email, mobile, password_hash, role_id) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, mobile, bcryptHash(pass), role).lastInsertRowid;

  const sellerUserId = mkUser('Maya Seller', 'seller@zuno.app', '9123000001', 'Seller@1234', sellerRole);
  const restUserId = mkUser('Chef Rohan', 'restaurant@zuno.app', '9123000002', 'Restro@1234', restRole);
  const provUserId = mkUser('Amit Services', 'provider@zuno.app', '9123000003', 'Provider@1234', provRole);

  // ---------- Categories ----------
  const cat = (module, name, parent = null, icon = '') => {
    const info = db.prepare('INSERT INTO categories (name, slug, parent_id, module, icon, position) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM categories WHERE module=?))')
      .run(name, slugify(name), parent, module, icon, module);
    return info.lastInsertRowid;
  };
  const shop = cat('shop', 'Electronics', null, '🔌');
  const phones = cat('shop', 'Smartphones', shop);
  const audio = cat('shop', 'Audio', shop);
  const laptops = cat('shop', 'Laptops', shop);
  const fashion = cat('shop', 'Fashion', null, '👕');
  const men = cat('shop', 'Men', fashion);
  const women = cat('shop', 'Women', fashion);
  const home = cat('shop', 'Home & Kitchen', null, '🏠');
  const beauty = cat('shop', 'Beauty', null, '💄');
  const veg = cat('grocery', 'Vegetables & Fruits', null, '🥦');
  const dairy = cat('grocery', 'Dairy & Eggs', null, '🥛');
  const snacks = cat('grocery', 'Snacks & Beverages', null, '🍪');
  const household = cat('grocery', 'Household', null, '🧺');
  const rNorth = cat('food', 'North Indian', null, '🍛');
  const rSouth = cat('food', 'South Indian', null, '🍽️');
  const rFast = cat('food', 'Fast Food', null, '🍔');
  const rChinese = cat('food', 'Chinese', null, '🥡');
  const sHome = cat('services', 'Home Services', null, '🔧');
  const sBeauty = cat('services', 'Beauty & Salon', null, '💇');
  const sRepairs = cat('services', 'Repairs', null, '🛠️');

  // ---------- Brands ----------
  const brand = (name) => db.prepare('INSERT INTO brands (name, slug) VALUES (?, ?)').run(name, slugify(name)).lastInsertRowid;
  const bAurora = brand('Aurora'); const bNova = brand('Nova'); const bZest = brand('Zest');
  const bHome = brand('Homely'); const bGlow = brand('Glow'); const bFresh = brand('FreshPick');

  // ---------- Seller ----------
  const sellerId = db.prepare("INSERT INTO sellers (name, slug, status, owner_user_id) VALUES (?, ?, 'verified', ?)").run('Zuno Mart', 'zuno-mart', sellerUserId).lastInsertRowid;

  // ---------- Shop products ----------
  const prod = (name, categoryId, brandId, price, mrp, stock, desc, specs) => {
    const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
    db.prepare(`INSERT INTO products (seller_id, category_id, brand_id, name, slug, description, price, mrp, stock, rating, rating_count, images, specs, module)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shop')`)
      .run(sellerId, categoryId, brandId, name, slug, desc, price, mrp, stock, (3.6 + Math.random() * 1.3).toFixed(1), Math.floor(20 + Math.random() * 400), JSON.stringify([]), JSON.stringify(specs || {}));
  };
  prod('Aurora Pixel 7 Pro', phones, bAurora, 54999, 69999, 40, 'Flagship smartphone with pro camera system.', { Display: '6.7" AMOLED', RAM: '12GB', Storage: '256GB' });
  prod('Aurora Pixel 7', phones, bAurora, 39999, 49999, 60, 'Everyday flagship with great battery.', { Display: '6.3" OLED', RAM: '8GB', Storage: '128GB' });
  prod('Aurora Pixel 7a', phones, bAurora, 24999, 29999, 75, 'Compact flagship with clean software.', { Display: '6.1" OLED', RAM: '8GB', Storage: '128GB' });
  prod('Nova Buds Pro', audio, bNova, 4999, 7999, 120, 'Active noise cancelling wireless earbuds.', { Battery: '32h', BT: '5.3' });
  prod('Nova Sound 500', audio, bNova, 2499, 3499, 90, 'Over-ear wireless headphones.', { Battery: '40h' });
  prod('Nova Boom 300', audio, bNova, 1499, 1999, 150, 'Portable Bluetooth speaker.', { Battery: '18h', BT: '5.2' });
  prod('Zest Book Air', laptops, bZest, 64999, 79999, 25, 'Thin and light laptop for creators.', { CPU: 'Octa-core', RAM: '16GB', SSD: '512GB' });
  prod('Zest Book Pro', laptops, bZest, 89999, 109999, 15, 'Powerful laptop for professionals.', { CPU: 'Deca-core', RAM: '32GB', SSD: '1TB' });
  prod('Homely Mixer Grinder', home, bHome, 2999, 3999, 80, '750W mixer grinder with 3 jars.', { Power: '750W' });
  prod('Homely Air Fryer', home, bHome, 4499, 5999, 60, '5L digital air fryer.', { Capacity: '5L' });
  prod('Glow Vitamin C Serum', beauty, bGlow, 599, 899, 200, 'Brightening face serum.', { Volume: '30ml' });
  prod('Men Classic Shirt', men, null, 799, 1299, 120, 'Cotton casual shirt.', { Fabric: '100% Cotton' });
  prod('Women Linen Dress', women, null, 1299, 1899, 90, 'Breathable summer dress.', { Fabric: 'Linen' });
  prod('Aurora Watch 2', phones, bAurora, 12999, 15999, 50, 'Smartwatch with SpO2 & GPS.', { Display: '1.8"', Battery: '10 days' });
  prod('Nova Power Bank 20K', audio, bNova, 1499, 1999, 100, '20000mAh fast-charging power bank.', { Capacity: '20000mAh' });
  prod('Zest Tab Lite', laptops, bZest, 18999, 22999, 30, '11" tablet for entertainment.', { RAM: '4GB', Storage: '64GB' });
  prod('Homely Induction Cooktop', home, bHome, 1799, 2499, 70, '1600W induction with touch panel.', { Power: '1600W' });
  prod('Glow Sunscreen SPF 50', beauty, bGlow, 349, 499, 220, 'Lightweight daily sunscreen.', { Volume: '50ml' });
  prod('Men Denim Jacket', men, null, 1499, 2199, 80, 'Classic blue denim jacket.', { Fabric: 'Denim' });
  prod('Women Heels', women, null, 999, 1499, 70, 'Comfort block-heel sandals.', { Type: 'Footwear' });
  prod('Aurora Earbuds Lite', audio, bAurora, 1299, 1999, 140, 'Compact TWS earbuds.', { Battery: '24h' });

  // ---------- Grocery ----------
  const gprod = (name, categoryId, price, mrp, stock, module = 'grocery') => {
    const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 5);
    db.prepare(`INSERT INTO products (category_id, name, slug, description, price, mrp, stock, rating, rating_count, images, module) VALUES (?, ?, ?, ?, ?, ?, ?, 4.2, 50, ?, ?)`)
      .run(categoryId, name, slug, name + ' fresh', price, mrp, stock, JSON.stringify([]), module);
  };
  gprod('Bananas (1 kg)', veg, 49, 60, 200);
  gprod('Tomatoes (500 g)', veg, 25, 30, 200);
  gprod('Apples Shimla (1 kg)', veg, 120, 150, 150);
  gprod('Spinach (250 g)', veg, 30, 40, 120);
  gprod('Amul Milk (500 ml)', dairy, 30, 32, 150);
  gprod('Eggs (6 pcs)', dairy, 42, 48, 180);
  gprod('Paneer (200 g)', dairy, 89, 99, 100);
  gprod('Lays Classic (90 g)', snacks, 20, 30, 300);
  gprod('Tata Tea (500 g)', snacks, 210, 240, 200);
  gprod('Cola (2 L)', snacks, 90, 110, 250);
  gprod('Surf Excel (1 kg)', household, 160, 199, 150);
  gprod('Floor Cleaner (1 L)', household, 110, 140, 140);
  gprod('Whole Wheat Bread', snacks, 45, 55, 200);
  gprod('Basmati Rice (1 kg)', veg, 140, 170, 160);
  gprod('Onions (1 kg)', veg, 35, 45, 180);
  gprod('Potatoes (1 kg)', veg, 30, 40, 180);
  gprod('Paneer (500 g)', dairy, 179, 199, 90);
  gprod('Butter (100 g)', dairy, 55, 65, 140);
  gprod('Orange Juice (1 L)', snacks, 110, 140, 120);
  gprod('Detergent (500 g)', household, 90, 120, 160);
  gprod('Dishwash Gel (750 ml)', household, 99, 130, 150);
  gprod('Green Tea (25 bags)', snacks, 150, 199, 130);

  // ---------- Restaurants ----------
  const rest = (name, cuisine, city, rating, fee, eta, owner = null) => {
    const info = db.prepare('INSERT INTO restaurants (name, slug, cuisine, city, rating, delivery_fee, eta_minutes, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, slugify(name), cuisine, city, rating, fee, eta, owner);
    return info.lastInsertRowid;
  };
  const r1 = rest('Saffron House', 'North Indian', 'Mumbai', 4.5, 29, 30, restUserId);
  const r2 = rest('Burger Junction', 'Fast Food', 'Mumbai', 4.2, 19, 25);
  const r3 = rest('South Treat', 'South Indian', 'Mumbai', 4.4, 25, 35);
  const r4 = rest('Wok & Roll', 'Chinese', 'Mumbai', 4.1, 35, 40);
  const r5 = rest('Pizza Studio', 'Fast Food', 'Mumbai', 4.3, 39, 30);
  const mi = (rid, category, name, desc, price) =>
    db.prepare('INSERT INTO menu_items (restaurant_id, category, name, description, price) VALUES (?, ?, ?, ?, ?)').run(rid, category, name, desc, price);
  mi(r1, 'Starters', 'Paneer Tikka', 'Grilled cottage cheese', 280);
  mi(r1, 'Main Course', 'Butter Chicken', 'Creamy tomato curry', 340);
  mi(r1, 'Breads', 'Butter Naan', 'Tandoori flatbread', 60);
  mi(r1, 'Desserts', 'Gulab Jamun', 'Warm sweet dumplings', 120);
  mi(r2, 'Burgers', 'Classic Cheeseburger', 'Beef patty, cheese', 199);
  mi(r2, 'Burgers', 'Veggie Burger', 'Crisp veg patty', 169);
  mi(r2, 'Sides', 'Fries', 'Crispy fries', 99);
  mi(r2, 'Beverages', 'Chocolate Shake', 'Thick milkshake', 129);
  mi(r3, 'Breakfast', 'Masala Dosa', 'Crispy dosa, sambar', 150);
  mi(r3, 'Main Course', 'Mini Meals', 'Rice, dal, veg, curd', 180);
  mi(r3, 'Beverages', 'Filter Coffee', 'South Indian coffee', 80);
  mi(r4, 'Starters', 'Chilli Paneer', 'Spicy indo-chinese', 240);
  mi(r4, 'Main Course', 'Veg Fried Rice', 'Wok tossed rice', 220);
  mi(r4, 'Main Course', 'Hakka Noodles', 'Soft noodles', 230);
  mi(r5, 'Pizza', 'Margherita', 'Classic tomato & cheese', 299);
  mi(r5, 'Pizza', 'Pepperoni', 'Spicy pepperoni', 399);
  mi(r5, 'Sides', 'Garlic Bread', 'Buttery garlic bread', 119);
  const r6 = rest('Chaat Junction', 'North Indian', 'Mumbai', 4.0, 15, 20);
  mi(r6, 'Snacks', 'Pani Puri', 'Six crispy puris', 80);
  mi(r6, 'Snacks', 'Samosa (2 pc)', 'Spiced potato fill', 70);
  mi(r6, 'Chaat', 'Dahi Puri', 'Sweet-sour delight', 90);
  const r7 = rest('The Curry House', 'North Indian', 'Mumbai', 4.3, 25, 35);
  mi(r7, 'Starters', 'Tandoori Chicken', 'Char-grilled', 360);
  mi(r7, 'Main Course', 'Dal Makhani', 'Slow-cooked lentils', 240);
  mi(r7, 'Breads', 'Tandoori Roti', 'Whole wheat', 40);

  // ---------- Service providers ----------
  const sp = (name, category, city, rating, owner = null) => {
    const info = db.prepare('INSERT INTO service_providers (name, slug, category, city, rating, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, slugify(name), category, city, rating, owner);
    return info.lastInsertRowid;
  };
  const sp1 = sp('QuickFix AC Care', 'Home Services', 'Mumbai', 4.6, provUserId);
  const sp2 = sp('Sparkle Salon', 'Beauty & Salon', 'Mumbai', 4.7);
  const sp3 = sp('Gadget Medic', 'Repairs', 'Mumbai', 4.4);
  const svc = (pid, name, category, price, dur) =>
    db.prepare('INSERT INTO services (provider_id, name, category, price, duration_minutes) VALUES (?, ?, ?, ?, ?)').run(pid, name, category, price, dur);
  svc(sp1, 'AC Service & Cleaning', 'Home Services', 499, 60);
  svc(sp1, 'AC Repair', 'Repairs', 299, 90);
  svc(sp1, 'Washing Machine Repair', 'Repairs', 349, 75);
  svc(sp2, 'Haircut & Styling', 'Beauty & Salon', 349, 45);
  svc(sp2, 'Facial Cleanup', 'Beauty & Salon', 699, 60);
  svc(sp2, 'Bridal Makeup', 'Beauty & Salon', 2999, 120);
  svc(sp3, 'Phone Screen Repair', 'Repairs', 999, 60);
  svc(sp3, 'Laptop Service', 'Repairs', 799, 90);
  const sp4 = sp('Urban Cleaning Co', 'Home Services', 'Mumbai', 4.5);
  svc(sp4, 'Deep Home Cleaning', 'Home Services', 1499, 180);
  svc(sp4, 'Sofa & Carpet Cleaning', 'Home Services', 899, 120);
  const sp5 = sp('Pamper Spa', 'Beauty & Salon', 'Mumbai', 4.8);
  svc(sp5, 'Full Body Massage', 'Beauty & Salon', 1299, 90);
  svc(sp5, 'Manicure & Pedicure', 'Beauty & Salon', 899, 75);

  // ---------- Coupons ----------
  db.prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, module, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .run('ZUNO100', 'flat', 10000, 0, null, null);
  db.prepare('INSERT INTO coupons (code, type, value, min_order, max_discount, module, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .run('SUPER15', 'percent', 15, 50000, 30000, null);

  logger.info('Seed complete. Demo data inserted.');
}

import bcrypt from 'bcryptjs';
function bcryptHash(p) { return bcrypt.hashSync(p, 12); }

seed();
