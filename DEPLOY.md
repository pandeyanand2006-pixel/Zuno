# ZUNO — Deploy to Render / Vercel

ZUNO is a **single Node + SQLite + vanilla SPA** app. You have two deploy choices.

---

## A) EASIEST — Full-stack on Render (1 service, 1 click) ⭐ Recommended

`Express` serves `public/` + `/api` together. No split needed.

**1. Push to GitHub** (already done):
```bash
git push origin main
```

**2. Render Blueprint (IaC):**
- Go to https://dashboard.render.com → **New → Blueprint** → Connect `Zuno` repo
- Render reads `render.yaml` and creates **Web Service `zuno`** (free tier)
- Build: `npm install` — Start: `npm start` — Health: `/api/health`
- Disk: 1GB at `/data` → `DB_PATH=/data/ZUNO.db` (SQLite persists across deploys)

**3. Env vars (Render Dashboard → Service → Environment):**
| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | auto-generated (or set a long random) |
| `JWT_EXPIRES_IN` | `7d` |
| `DB_PATH` | `/data/ZUNO.db` |
| `FRONTEND_URL` | `https://zuno.onrender.com` (your Render URL) |
| `PORT` | `10000` (Render injects — keep) |
| `RAZORPAY_KEY_ID` | (optional — leave blank = test mode) |
| `RAZORPAY_KEY_SECRET` |  |
| `RAZORPAY_WEBHOOK_SECRET` |  |
| `GOOGLE_CLIENT_ID` |  |

**4. Seed (first deploy only):**
Render → Shell:
```bash
npm run seed   # 11 tees, 238 variants, 3 coupons — skips if data exists
```

**5. Open:** `https://zuno.onrender.com` → `#/admin` with `admin@zuno.app / Admin@1234`

> SQLite lives on Render Disk. Without disk, data resets each deploy — `render.yaml` already adds it.

---

## B) SPLIT — Backend on Render, Frontend on Vercel

Use if you want **frontend on Vercel** (global CDN) + **backend on Render**.

### B1 — Backend (Render Web Service)
Same as above, but set:
```
FRONTEND_URL=https://your-frontend.vercel.app,https://*.vercel.app
DB_PATH=/data/ZUNO.db
```
Copy the Render backend URL: `https://zuno-api.onrender.com`

### B2 — Frontend (Vercel Static)
- Import same GitHub repo into https://vercel.com → **New Project** → select `Zuno`
- **Build settings:** Framework = Other, Build Command = `echo "static"`, Output Directory = `public`
- **Environment:** Add `ZUNO_API_BASE`? Instead, inject at runtime:
  In Vercel → Settings → Environment Variables — OR — edit `public/index.html` head:
  ```html
  <script>window.ZUNO_API_BASE="https://zuno-api.onrender.com"</script>
  ```
  `public/assets/js/api.js` reads `window.ZUNO_API_BASE` or `localStorage.ZUNO_API_BASE` before falling back to `/api`.
- Deploy — Vercel serves `public/` as static, API calls go to Render.

### B3 — Full Vercel (serverless + static) — experimental
`vercel.json` + `api/index.js` are provided. Vercel will:
- `builds: server/index.js → @vercel/node` for `/api/*`
- `builds: public/** → @vercel/static` for frontend
- **Note:** SQLite on Vercel serverless is **ephemeral** (`/tmp` only). Data resets every cold start. Use only for demo; for production use Render disk or switch `DB_PATH` to Turso/Neon Postgres.

```bash
vercel --prod
# env on Vercel dashboard: JWT_SECRET, RAZORPAY_*, GOOGLE_CLIENT_ID
```

---

## Frontend / Backend layout

```
Zuno/
├── server/           ← BACKEND (Node + Express + SQLite)
│   ├── config/env.js  PORT, JWT, DB_PATH, FRONTEND_URL, Razorpay
│   ├── config/db.js    SQLite via node:sqlite, path = DB_PATH
│   ├── routes/*.routes.js   /api/auth, /products, /cart, /orders, /admin ...
│   ├── services/*.service.js
│   └── index.js        app.listen(PORT)
├── public/           ← FRONTEND (vanilla ES-module SPA, no build)
│   ├── index.html
│   ├── assets/css/   tokens, base, components, layout — Denim #2B4C7E
│   └── assets/js/    app, router, api, store, pages/*, components
├── api/index.js      ← Vercel serverless wrapper (imports server/app.js)
├── render.yaml       ← Render Blueprint (single-service + optional split)
├── vercel.json       ← Vercel routes (api + static)
└── package.json      ← type: module, start: node server/index.js
```

**No build step** — frontend is static `public/`. Backend serves it via `express.static(public)` in `server/app.js:88`.

---

## Local vs Prod env

| Env | Frontend | Backend | DB |
|-----|----------|---------|----|
| Local | `http://localhost:4000` (served by Express) | `http://localhost:4000/api` | `./data/ZUNO.db` |
| Render single | `https://zuno.onrender.com/` | `https://zuno.onrender.com/api` | `/data/ZUNO.db` (disk) |
| Split | `https://*.vercel.app` | `https://zuno-api.onrender.com/api` | `/data/ZUNO.db` |

---

## Checklist before prod

- [ ] Set `JWT_SECRET` to 32+ random chars (Render Generate Value)
- [ ] Set `FRONTEND_URL` to your actual frontend origin(s), comma-separated
- [ ] If real payments: set `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`
- [ ] If Google login: set `GOOGLE_CLIENT_ID`
- [ ] `npm run seed` once (or mount existing `data/ZUNO.db`)
- [ ] Test: `/api/health` → `healthy`, login as admin, place test order with coupon `ZUNO100`

---

## Troubleshooting

**Data resets after deploy** → Disk not attached. Check Render → Service → Disks, `DB_PATH=/data/ZUNO.db`.

**CORS error from Vercel frontend** → Add frontend origin to `FRONTEND_URL` (comma-separated, supports `*.vercel.app` wildcard).

**Images lazy intervention** → Chrome message, not error; hero first slide is `eager`.

**401 on /api/auth/login** → Wrong password — expected; UI shows inline error. Try `demo@zuno.app / Demo@1234`.
