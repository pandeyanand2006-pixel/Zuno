# ZUNO — Deploy to Render + Vercel (Production + Local)

> Architecture: **Vercel (frontend) → Render (backend) → DB (SQLite disk OR Mongo Atlas)**. Also supports single-service Render (frontend+backend together).

```
         VERCEL (static SPA)
              |
              |  window.ZUNO_API_BASE -> https://zuno-ydl3.onrender.com/api
              v
          RENDER (Express + /api)  ----->  /data/ZUNO.db (disk) or Mongo Atlas
              |
              +--> serves public/ fallback (for /api/health checks)
```

---

## 1) Local development

```bash
npm install
cp .env.example .env   # set JWT_SECRET, leave MONGODB_URI blank for SQLite
npm start              # http://localhost:4000  (API + frontend same-origin)
npm run seed           # first run only; idempotent admin+roles ensured on every boot
```

- **Local frontend+local backend (default):** `http://localhost:4000` → `/api` (same-origin)
- **Local frontend+Render backend:** `localStorage.setItem('ZUNO_API_BASE','https://zuno-ydl3.onrender.com/api')` + reload → `http://localhost:4000` now hits Render. To go back: `localStorage.setItem('ZUNO_API_BASE','')` + reload.
- **Admin:** `http://localhost:4000/admin` or `http://localhost:4000/#/admin` → `/#/admin/login`

`public/assets/js/api.js` resolves `localStorage > window.ZUNO_API_BASE > /api` and normalizes trailing `/api` (no double `//api`).

---

## 2) Production: Render backend

Render reads `render.yaml` (Blueprint). Push to GitHub auto-deploys.

**Service:** `zuno` (Web, Node, `npm install` → `npm start`, health `/api/health`)

**Required env vars (Render Dashboard → Service → Environment):**

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Enables Prod CORS + hides dev OTP |
| `PORT` | `10000` | Render injects; app reads `process.env.PORT` |
| `JWT_SECRET` | long random 32+ | Generate Value (persisted, not regenerated each deploy) |
| `JWT_EXPIRES_IN` | `7d` | |
| `DB_PATH` | `/data/ZUNO.db` | With disk (Starter). Free tier falls back to `data/ZUNO.db` (ephemeral) |
| `FRONTEND_URL` | `https://*.vercel.app` | Or exact `https://your-zuno.vercel.app,https://*.vercel.app` |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/zuno?retryWrites=true` | **Recommended for free tier** – persistent even without disk |
| `RAZORPAY_KEY_ID` … | optional | Blank = test mode (dev HMAC) |
| `GOOGLE_CLIENT_ID` | optional | |

**Disk (persistent SQLite):** Starter plan only. `render.yaml` disk commented for free tier. To enable:
```yaml
disk:
  name: zuno-data
  mountPath: /data
  sizeGB: 1
```
Then `DB_PATH=/data/ZUNO.db` persists. On free tier without disk, `server/config/db.js:ensureDbDir` falls back to `data/ZUNO.db` and logs fallback; data resets on deploy → use **Mongo Atlas** for persistence.

**Idempotent admin seed:** `server/index.js` on every boot ensures roles + admin `admin@zuno.app / 9999999999 / Admin@1234` (bcrypt) exist in **both SQLite and Mongo** without deleting products/orders. `server/seed/seed.js` now creates admin before early-return on catalogue. No need to delete DB.

**Health:** `GET https://zuno-ydl3.onrender.com/api/health` → `{success:true, data:{status:'healthy'}}`

---

## 3) Production: Vercel frontend

**Import repo into Vercel:** New Project → select `Zuno` → Framework = Other, no build command, Output = `public`.

`vercel.json` is now **frontend-only** (no `@vercel/node` serverless). It only rewrites `/*` → `/index.html` for SPA.

**Configure API URL:** Edit `public/index.html:24` head:
```html
<script>window.ZUNO_API_BASE="https://zuno-ydl3.onrender.com/api"</script>
```
Commit + push, or set via Vercel env injection at build (static needs head edit). `public/assets/js/api.js` will use it.

**Do not confuse:** `FRONTEND_URL` (Render env) = Vercel URL. `window.ZUNO_API_BASE` (Vercel frontend) = Render URL. They are opposite.

---

## 4) Admin authentication flow

```
Vercel /admin → #/admin/login → POST https://zuno-ydl3.onrender.com/api/auth/login
  → server/services/auth.service.js:login verifies bcrypt → signToken({sub:id, role})
  → frontend Store stores JWT (localStorage ZUNO_token)
  → #/admin → GET /api/admin/dashboard with Authorization: Bearer <JWT>
  → server/middleware/auth.js verifies JWT + requireRole('ADMIN') → 200 or 401/403
```

- Unauthenticated → 401
- Authenticated non-admin → 403
- Admin → 200 (real DB data, no mocks)

**Credentials:** `admin@zuno.app` / `Admin@1234` (also `9999999999`). Seeded idempotently; password verified via `bcryptjs.compare`.

---

## 5) Frontend / Backend layout

```
Zuno/
├── server/config/env.js  PORT, JWT, DB_PATH, FRONTEND_URL, MONGODB_URI
├── server/config/db.js    SQLite via node:sqlite, path = DB_PATH (ensureDbDir)
├── server/routes/*.routes.js  /api/auth, /products, /cart, /orders, /admin
├── server/services/       auth, product, cart, order (validated status workflow)
├── server/index.js        idempotent roles+admin for SQLite+Mongo, auto-seed catalogue
├── public/index.html      window.ZUNO_API_BASE (Vercel→Render)
├── public/assets/js/api.js  resolveApiBase() with localStorage override
├── render.yaml            single-service + disk comment
└── vercel.json            static only, SPA rewrite
```

---

## 6) Local vs Prod matrix

| Env | Frontend | Backend | DB |
|-----|----------|---------|----|
| Local | `http://localhost:4000` | `http://localhost:4000/api` | `./data/ZUNO.db` |
| Local→Render | `http://localhost:4000` (localStorage Render) | `https://zuno-ydl3.onrender.com/api` | Render DB (SQLite/Mongo) |
| Render single | `https://zuno-ydl3.onrender.com/` | same `/api` | `/data/ZUNO.db` or Mongo |
| Vercel split | `https://*.vercel.app` | `https://zuno-ydl3.onrender.com/api` | Render DB |

Switch local: `localStorage.setItem('ZUNO_API_BASE','')` → local, else Render.

---

## 7) Checklist before prod

- [ ] `JWT_SECRET` set (not dev default)
- [ ] `FRONTEND_URL` includes exact Vercel origin(s)
- [ ] `DB_PATH=/data/ZUNO.db` (with disk) OR `MONGODB_URI` set (free tier)
- [ ] `/api/health` → healthy
- [ ] Admin login `admin@zuno.app / Admin@1234` → 200 JWT `role ADMIN`
- [ ] `/api/admin/dashboard` with admin JWT → 200, with customer JWT → 403
- [ ] Place test order `ZUNO100` coupon, verify appears in admin

## 8) Troubleshooting

**401 Invalid email/mobile or password on Render:**
- Render Mongo active but admin not seeded → fixed: `server/index.js` now seeds Mongo admin on every boot without data loss. Redeploy Render after pulling latest commit. Check Render logs: `Admin user admin@zuno.app already present (Mongo) — OK` or `Seeded admin (Mongo) — created`.
- Free tier SQLite ephemeral + no Mongo → DB empty after deploy → admin missing until seed. Either set `MONGODB_URI` (persistent) or upgrade to disk. Also `npm run seed` once via Render Shell is ephemeral; idempotent boot seed is preferred.
- Wrong `JWT_SECRET` not cause login 401 (only token verification after).

**CORS error from Vercel:** Add exact origin to `FRONTEND_URL` comma-separated; ensure Render redeployed; check `GET /api/health` includes `access-control-allow-origin`.

**Data resets after deploy (free tier):** Disk not attached → use Mongo or upgrade. `DB_PATH=/data/ZUNO.db` without disk falls back, log shows `[db] using fallback`.

**Images lazy intervention:** Chrome message, not error; hero is `eager`.

**Verify:** `curl https://zuno-ydl3.onrender.com/api/health` then `curl -X POST .../api/auth/login -d '{"identifier":"admin@zuno.app","password":"Admin@1234"}'`.
