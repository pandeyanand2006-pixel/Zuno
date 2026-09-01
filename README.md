# ZUNO — Modern Everyday Clothing

> A premium, minimal clothing brand. T-shirts, shirts and a live **Custom Studio** to create your own tee — built as a production-shaped fashion e-commerce experience.

Zuno is a focused **clothing brand**, not a marketplace. Every page feels like Zuno — from the editorial homepage to the product detail, bag, checkout and the interactive Custom Studio.

---

## Brand

**ZUNO** — Wear your attitude.

- Modern, minimal, premium, youthful, confident
- Black / White / Off-white / Charcoal / Soft gray — subtle, editorial, not loud
- Large typography, whitespace, editorial layouts, smooth animations
- Custom Studio is the hero feature: “Make it yours.”

---

## Tech stack

| Layer | Choice | Why |
|------|--------|-----|
| Backend | **Node.js + Express** (modular REST API) | Familiar, fast, production-ready |
| Database | **SQLite via `node:sqlite`** | Real relational DB, no external server |
| Auth | **JWT + bcrypt**, RBAC, OTP + Google | Secure, stateless |
| Payments | **Razorpay** (HMAC verification) | India-first, server-verified |
| Frontend | **Vanilla ES-module SPA** (no build) | Fully custom, fast, no toolchain |
| Validation | **Zod** | Single source of truth |

---

## Architecture

```
              ZUNO — Clothing
     ┌─────────────┬──────────────┬──────────────┐
   CATALOGUE   CUSTOM STUDIO    COMMERCE     IDENTITY
   T-Shirts    Text / Image     Bag          User
   Shirts      Front / Back     Wishlist     Addresses
   New Arrivals Color/Size/Fit  Checkout     Orders
   Collections Print Area       Razorpay     My Designs
```

### Modules

- **Shop** — T-shirts (Oversized, Regular, Graphic, Plain, Polo, Premium Cotton) and Shirts (Casual, Printed, Overshirt, Solid, Relaxed, Formal). Filters: category, size, color, fit, collection, price, sort.
- **Custom Studio** (`#/customize`) — interactive 2D designer: color, size, fit, front/back, add text (font, size, color, bold/italic, rotate, scale, drag), upload image (PNG/JPG/WEBP, drag/resize/rotate/delete), print-area guide, preview, save design, add custom tee to bag.
- **Bag / Wishlist** — variant-aware (color/size), custom design previews, edit design, move to bag.
- **Product Detail** — gallery, brand Zuno, price/MRP/discount, color swatches, size selector, fit, size guide modal, fabric & care, quantity, Add to bag, Wishlist.
- **Checkout** — address, order summary, delivery, Razorpay (server HMAC verification), confirmation.
- **Orders** — statuses `PAYMENT_PENDING → PAID → CONFIRMED → PRINTING → PACKED → SHIPPED → DELIVERED`; custom orders show design preview.
- **My Designs** (`#/profile/designs`) — saved custom tees: preview, edit, duplicate, add to bag, delete.
- **Admin** (`#/admin`) — Overview, Products (clothing CRUD + variants), Orders, **Custom Orders** (design preview, status: PRINTING/PACKED…), Customers.

### Database

`users, roles, addresses, categories, brands, sellers, products, product_variants, custom_designs, carts, cart_items (variant_data, customization_data, custom_price), wishlists, orders, order_items (customization_data, variant_data), payments, coupons, reviews, notifications` — plus legacy `restaurants, menu_items, service_providers, services, bookings` retained for backward compat but hidden from the storefront.

### API

`{ success, data, message }` envelope.

```
/api/auth /users /products /categories /cart /wishlist /orders /payments
/api/custom-designs /api/custom-designs/:id/cart
/api/cart/custom  (custom tee to bag)
/api/admin/*  (clothing admin)
/api/health /api/config
```

---

## Getting started

```bash
npm install
cp .env.example .env
# edit .env: JWT_SECRET + (for real payments) RAZORPAY_KEY_ID/SECRET, GOOGLE_CLIENT_ID, SMTP_*
npm run seed   # creates clothing catalogue (15 tees/shirts, 238 variants, 3 coupons)
npm start      # serves API + frontend at http://localhost:4000
```

Open **http://localhost:4000/**.

### Demo accounts (seeded)

- Admin: `admin@zuno.app` / `Admin@1234` → `#/admin`
- Customer: register any Indian mobile + password (8+ chars) or use OTP / Google
- Seller (legacy, hidden): `seller@zuno.app` / `Seller@1234`

### Test

```bash
npm test
```

---

## Custom Studio pricing (server-verified)

Base T-shirt price + front print ₹100 + back print ₹100 (if elements present). The frontend shows an estimate; the server recalculates on `POST /api/cart/custom` and on order creation. Never trust the client price.

Image upload: PNG/JPG/WEBP, ≤5MB, validated MIME + size, transparent PNG supported, drag/resize/rotate/delete, front/back layers.

---

## Admin

- **Products**: create T-shirts/shirts with colors, sizes, fit, fabric, collection, customizable, featured, stock (variants auto-created)
- **Custom Orders**: view customer, product, variant, front/back design, uploaded image, preview, update status (PRINTING → PACKED → SHIPPED …)

---

## Security

- bcrypt, JWT, RBAC, Helmet, rate limiting, Zod validation, audit logs
- **Razorpay HMAC** recomputed server-side (`order_id|payment_id`)
- Image MIME/size validation, no execution of uploads
- Env vars never committed (`.env.example` provided)

> **Test mode**: without Razorpay keys the app runs with a dev HMAC and a Razorpay-style demo sheet (no real charge). Set `RAZORPAY_KEY_ID/SECRET` in `.env` to enable the live checkout.

---

## Project structure

```
server/
  config/      env, db (schema + clothing tables)
  middleware/  auth, validate, error
  utils/       response, jwt, password, id, logger
  validators/  zod schemas (auth, custom)
  services/    auth, user, product, cart, order, partner
  controllers/ auth, user, product, order, payment, customDesign, cart
  routes/       REST routers (custom-designs, cart custom)
  integrations/razorpay/
  seed/        clothing catalogue
  test/        integration tests
public/
  index.html
  assets/css/  tokens (fashion palette), base, components, layout (editorial + custom studio)
  assets/js/   app, router, api, store, ui, components, pages/*
    pages/     home (fashion), shop (clothing filters), product (variant PDP), cart (fashion bag), wishlist, customize (studio), profile (My Designs), orders, admin (clothing)
```

---

## What works end-to-end (verified)

- Browse, filter (category/size/color/fit/collection), search (clothing), PDP with variants, wishlist (heart on cards + PDP), bag (variant + custom), checkout → Razorpay → PAID, orders with custom preview, My Designs (save/edit/add to bag), Custom Studio (color/size/fit, text/image, drag/resize/rotate, front/back, save, add to bag), admin (products, custom orders).

---

## Roadmap

AI discovery, real-time tracking, multi-language, email/SMS for OTP, 3D preview, variant image swaps.
