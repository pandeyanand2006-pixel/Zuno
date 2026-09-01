# Zuno — One app for everyday life

> An original, production-shaped **Indian super app**. Shop, groceries, food, home services and
> secure payments, brought together in a single, trustworthy experience — built from scratch with a
> clean modular architecture.

Zuno is **not** a clone of any existing product. It has its own brand, design language, navigation and
component system. The complexity (commerce, grocery, food, services, payments, orders, admin) lives
inside the architecture; the user only ever sees **one app**.

---

## Tech stack

| Layer | Choice | Why |
|------|--------|-----|
| Backend | **Node.js + Express** (modular REST API) | Familiar, fast, production-ready |
| Database | **SQLite via `node:sqlite`** (built-in, zero native build) | Real relational DB, no external server, runs anywhere |
| Auth | **JWT** + **bcrypt** hashing, RBAC | Secure, stateless, role-aware |
| Payments | **Razorpay** (SDK + signature verification) | India-first UPI/cards/net-banking |
| Frontend | **Vanilla ES-module SPA** (no build step) | Runs anywhere, no toolchain, fully custom design system |
| Validation | **Zod** on the server (never trust the client) | Single source of truth for rules |

---

## Architecture

```
                 ZUNO (super app)
        ┌────────────┬────────────┬────────────┐
     COMMERCE     SERVICES      PAYMENTS     IDENTITY
      Shop        Home/Salon     Razorpay      User account
      Grocery      Repairs        Verify        Personalization
      Food         Booking        Refunds       (AI-ready)
        │            │              │
        └────────────┴──────────────┘
              Unified cart · Orders · Notifications · Admin
```

### Modules
- **Shop** — products, categories, brands, search, cart, wishlist, coupons.
- **Grocery** — reuses the same commerce engine with its own catalogue/UX.
- **Food** — restaurants, menus, food cart, secure checkout.
- **Services** — providers, bookings (date/time/address), payment.
- **Payments** — unified Razorpay layer; server verifies every signature.
- **Orders** — one order engine for all modules, with lifecycle + tracking.
- **Admin** — users, products, orders, payments, analytics (RBAC-protected).

### Database entities
`users, roles, addresses, categories, brands, sellers, products, carts, cart_items,
wishlists, orders, order_items, payments, refunds, coupons, reviews, notifications,
restaurants, menu_items, service_providers, services, bookings, audit_logs` — all indexed.

### API
Consistent envelope: `{ success, data, message }`.
`/api/auth /users /products /categories /cart /wishlist /orders /payments /restaurants
/services /coupons /notifications /admin` plus `/api/health` and `/api/webhooks/razorpay`.

---

## Security

- Passwords hashed with **bcrypt** (never stored in plain text).
- **JWT** auth + role-based access control (`USER, ADMIN, SELLER, RESTAURANT, SERVICE_PROVIDER, DELIVERY_PARTNER`).
- **Prices, discounts and item prices are resolved server-side** — the client can never set what it pays.
- **Razorpay payments are verified by recomputing the HMAC signature** on the server. The frontend is
  never trusted to declare a payment successful.
- Rate limiting, secure headers (Helmet), centralized validation, audit logging.
- `.env` is never committed (see `.env.example`).

> In development without Razorpay keys, the app runs in **TEST MODE**: it still performs a real
> HMAC signature round-trip (order_id | payment_id) — it just uses a dev secret instead of Razorpay's.
> This is clearly flagged in logs and must not be used in production.

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   edit .env and set JWT_SECRET + (for real payments) RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET

# 3. Seed demo data (categories, products, restaurants, services, coupons, admin user)
npm run seed

# 4. Start the server (serves API + the frontend at http://localhost:4000)
npm start
```

Open **http://localhost:4000/**.

### Demo accounts
- Admin: `admin@zuno.app` / `Admin@1234`
- Any user you register (Indian mobile + password, min 8 chars).

### Run tests
```bash
npm test
```

---

## Razorpay setup (production)
1. Create a Razorpay account and copy the **Key ID** and **Key Secret** into `.env`.
2. In the Razorpay dashboard, add a webhook to `https://<your-domain>/api/webhooks/razorpay` with the
   **Webhook Secret** set as `RAZORPAY_WEBHOOK_SECRET`.
3. Restart. The app automatically switches out of TEST MODE and opens the real Razorpay Checkout.

---

## Project structure
```
server/
  config/      env, db (schema)
  middleware/  auth (JWT + RBAC), validate, error
  utils/       response, jwt, password, id, logger
  validators/  zod request schemas
  services/    auth, user, product, order, (pricing + coupons)
  controllers/ auth, user, product, order, payment
  routes/       REST routers per domain
  integrations/razorpay/   SDK + signature verification + webhook
  seed/        demo data
  test/        integration tests
public/
  index.html
  assets/css/  tokens, base, components, layout (design system)
  assets/js/   app, router, api, store, ui, components, pages/*
```

---

## What works end-to-end today (verified)
- Register / login / logout, JWT auth, role gating.
- Browse shop & grocery, search, product detail, add to cart, wishlist.
- **Checkout → Razorpay order → server-side signature verification → order `PAID`** (with idempotency).
- Food: restaurant menus → food cart → custom secure order → paid.
- Services: provider → booking → secure payment → booking `PAID`.
- Orders history + detail + status timeline + cancel.
- Admin dashboard: analytics, orders, products, users, payments.
- Notifications, profile, addresses, theme toggle, responsive desktop/mobile UI.

## Demo accounts (seeded)
- Admin: `admin@zuno.app` / `Admin@1234`
- Customer: register any mobile + password, or use OTP login.
- Seller: `seller@zuno.app` / `Seller@1234` → Seller dashboard (`#/seller`)
- Restaurant: `restaurant@zuno.app` / `Restro@1234` → Restaurant dashboard (`#/restaurant-admin`)
- Service provider: `provider@zuno.app` / `Provider@1234` → Provider dashboard (`#/provider-admin`)

## Partner dashboards (built)
Role-gated management UIs, each wired to RBAC-protected APIs:
- **Seller**: manage shop/grocery products (create/edit/deactivate), view orders containing their SKUs, revenue + top-SKU analytics.
- **Restaurant**: manage menu items, view food orders for their restaurant.
- **Service provider**: manage services, view & update booking status.
APIs: `/api/seller/*`, `/api/restaurant-admin/*`, `/api/provider-admin/*` (all require the matching role).

## Auth: OTP & Google (built)
- **OTP login**: `POST /api/auth/otp/request` generates + stores a 10-min OTP; `POST /api/auth/otp/verify` issues a JWT. In dev the OTP is returned in the response (would be SMS-delivered in production).
- **Google login**: `POST /api/auth/google` verifies the `id_token` server-side via Google's `tokeninfo` endpoint (checks `aud`/`iss`/`exp`). The login screen renders the real "Continue with Google" button when `GOOGLE_CLIENT_ID` is set in `.env`.

## Payments
Razorpay **TEST MODE** is used when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are blank (simulated payments with a genuine HMAC signature round-trip — never faked success). Set both keys in `.env` to automatically switch the checkout to the live Razorpay Checkout — no frontend change required.

## Roadmap (designed-for, not yet built)
AI discovery layer, real-time driver tracking, multi-language, email/SMS gateways (OTP currently dev-returned; wire `SMTP_*` to email real OTPs).
