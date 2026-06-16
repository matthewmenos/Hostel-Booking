# HostelHub Ghana — University Hostel Booking & Management Platform

A multi-tenant platform for booking and managing university hostels across Ghana
(KNUST, Legon, UCC, …). Built with **Django + DRF** (backend) and **React + Vite +
Tailwind** (frontend, installable as a **PWA**).

## Architecture

**Dual-SQLite, multi-tenant data model:**

| Database | File | Holds |
|----------|------|-------|
| Global (`default`) | `backend/data/global_system.db` | Users, hostel/tenant metadata, the consolidated **booking ledger**, payments |
| Per-tenant | `backend/data/db_store/tenant_<slug>.db` | A single hostel's rooms, bed spaces, announcements |

- **High-concurrency data** (bookings, payments) lives in the **global** DB — the
  single authoritative store — so the hot path never races on per-tenant files.
- **Per-tenant `.db` files** are created/registered **at runtime** by
  [`backend/tenants/tenant_manager.py`](backend/tenants/tenant_manager.py),
  routed by [`backend/tenants/routers.py`](backend/tenants/routers.py), and resolved
  per request from the `X-Tenant-Slug` header by
  [`backend/tenants/middleware.py`](backend/tenants/middleware.py).
- **Cloudflare R2** (S3-compatible) stores media and the durable copies of tenant
  `.db` files. **Without R2 credentials the app falls back to local disk** — it runs
  out of the box. Add credentials to `backend/.env` to enable R2.

### Tenant DB lifecycle (per request)
1. Middleware reads `X-Tenant-Slug` → `ensure_tenant_db(slug)`: acquire per-tenant
   lock, ensure a local file exists (pull from R2 or init fresh), register the
   connection, **auto-migrate** the tenant schema on first creation.
2. The view reads/writes tenant models (routed to the tenant file).
3. On response: if modified, the `.db` is **synced back to R2**; the lock is released.

> Concurrency note: the per-tenant lock makes tenant-file writes safe within one
> server process. It is not cross-process safe — acceptable here because
> bookings/payments live in the global DB, not tenant files.

## Running locally

### Backend
```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
python manage.py migrate
python manage.py createsuperuser          # optional, for /admin
python manage.py runserver                # http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api -> :8000)
npm run build && npm run preview   # production build + PWA service worker
```

## Key API endpoints
- `POST /api/auth/register/`, `POST /api/auth/token/`, `GET /api/auth/me/`
- `GET  /api/hostels/?campus=KNUST&min_price=&max_price=` — discovery
- `POST /api/hostels/` — manager creates a listing
- `POST /api/book/` — booking pipeline (reserves a bed + ledger + payment)
- `GET  /api/bookings/` — a student's bookings
- `GET/POST /api/tenant/rooms|beds|announcements/` — tenant-scoped (needs `X-Tenant-Slug`)

## Project layout
```
backend/   Django project (config/), apps: accounts, global_app, tenants, core
frontend/  React + Vite app (src/pages, src/api, src/context, src/pwa)
```
