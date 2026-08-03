# HA Fitness — Development Plan

A simple gym management system for member admissions, packages, payments, renewals, and expiry alerts.

**Tech stack:** Python (backend) + React (frontend)  
**Theme:** Dark purple & white · Responsive (sidebar desktop / bottom nav mobile)  
**Auth:** Single admin — `admin` / `admin123`

---

## Product summary


| Area      | Behavior                                                                                |
| --------- | --------------------------------------------------------------------------------------- |
| Admission | Collect full name, contact, CNIC, email, address, package                               |
| Packages  | Predefined: 1 / 3 / 6 / 12 months (admin sets prices)                                   |
| Payment   | Status: **Paid** · **Unpaid** · **Partial** (based on amount received vs package price) |
| Expiry    | Alert when package end date is reached; prompt renewal                                  |
| Renewal   | Same or different package; reset/extend dates; update payment                           |


---

## Default credentials


| Field    | Value      |
| -------- | ---------- |
| Username | `admin`    |
| Password | `admin123` |


> Change this after first production deploy. Store hashed passwords only.

---

## UI / UX conventions

- **Colors:** Dark purple primary (`#4A148C` / `#6A1B9A` range), white surfaces, light purple accents
- **Desktop:** Fixed left sidebar (Dashboard, Members, Packages, Payments, Alerts, Settings)
- **Mobile:** Bottom tab bar (same main destinations)
- **Style:** Simple, clean, readable forms and tables — no clutter

---

## Phase 0 — Project setup

**Goal:** Runnable empty app with shared theme and auth shell.

### Backend (Python)

- [x] Create project (`FastAPI` or Flask recommended)
- [x] Virtual env, `requirements.txt`
- [x] SQLite for v1 (easy); Postgres later if needed
- [x] CORS for React dev server
- [x] Health check route `GET /api/health`

### Frontend (React)

- [x] Vite + React + TypeScript (or JS)
- [x] Router, layout shell (sidebar + mobile footbar)
- [x] Dark purple / white CSS variables and base components (Button, Input, Card, Table)
- [x] Responsive breakpoints

### Deliverable

- App opens, shows login page + empty layout after login stub.

---

## Phase 1 — Authentication

**Goal:** Only the admin can use the system.

### Backend

- [x] Users table (username, password hash, role)
- [x] Seed admin: `admin` / `admin123` (hash on seed)
- [x] `POST /api/auth/login` → JWT or session token
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`
- [x] Protect all member/package routes with auth middleware

### Frontend

- [x] Login screen (username + password)
- [x] Store token; redirect to dashboard
- [x] Logout in sidebar / profile
- [x] Redirect unauthenticated users to login

### Deliverable

- Login works with admin credentials; protected pages require auth.

---

## Phase 2 — Packages (predefined plans)

**Goal:** Admin defines membership packages and prices.

### Data model — `packages`


| Field           | Type     | Notes                     |
| --------------- | -------- | ------------------------- |
| id              | PK       |                           |
| name            | string   | e.g. "1 Month"            |
| duration_months | int      | 1, 3, 6, 12               |
| price           | decimal  | Amount for full package   |
| is_active       | bool     | Soft-disable unused plans |
| created_at      | datetime |                           |


### Seed packages

- [x] 1 Month — Rs 3,000
- [x] 3 Months — Rs 8,000
- [x] 6 Months — Rs 15,000
- [x] 12 Months — Rs 28,000

(Prices editable by admin on the Packages screen.)

### API

- [x] `GET /api/packages` (supports `?active_only=true`)
- [x] `POST /api/packages` (optional create)
- [x] `PUT /api/packages/:id` (edit name/price/active)
- [x] `DELETE /api/packages/:id` (or deactivate)
- [x] `POST /api/packages/:id/toggle` (activate / deactivate)

### Frontend

- [x] Packages list page
- [x] Edit price / activate-deactivate

### Deliverable

- Four plans visible; prices configurable.

---

## Phase 3 — Member admission

**Goal:** Register a member like Mustafa with personal details + package.

### Data model — `members`


| Field          | Type     | Notes                              |
| -------------- | -------- | ---------------------------------- |
| id             | PK       |                                    |
| full_name      | string   | Required                           |
| contact        | string   | Phone                              |
| cnic           | string   | Unique preferred                   |
| email          | string   | Optional or required as you prefer |
| address        | text     |                                    |
| package_id     | FK       | Current package                    |
| start_date     | date     | Admission / current period start   |
| end_date       | date     | Calculated from package duration   |
| payment_status | enum     | `paid` · `unpaid` · `partial`      |
| amount_due     | decimal  | Package price at admission         |
| amount_paid    | decimal  | Sum received for current period    |
| status         | enum     | `active` · `expired` · `inactive`  |
| created_at     | datetime |                                    |
| updated_at     | datetime |                                    |


### Payment status rules

```
if amount_paid <= 0          → unpaid
if amount_paid < amount_due  → partial
if amount_paid >= amount_due → paid
```

### API

- [x] `POST /api/members` — create admission
- [x] `GET /api/members` — list (search by name/contact/cnic)
- [x] `GET /api/members/:id` — detail
- [x] `PUT /api/members/:id` — edit profile fields
- [x] Auto-set `end_date` from `start_date` + package months

### Frontend

- [x] **New admission** form: name, contact, CNIC, email, address, package select, amount paid
- [x] Members list (search + filters: active / expired / payment status)
- [x] Member detail page

### Deliverable

- Mustafa can be admitted, package assigned, payment status computed, end date set.

---

## Add-on — Trainers, trainer packages & fee table

**Goal:** Manage coaching staff, trainer plan categories, and the gym fee rate card.

### Seeded trainer packages

| Category | 1 month | 2 months | 6 months |
| --- | ---: | ---: | ---: |
| Training Guidance | 2,500 | 6,000 | 11,000 |
| Group Training | 7,000 | 18,000 | 33,000 |
| Personal Training | 12,000 | 30,000 | 54,000 |

### Seeded fee table

Admission 2,500 · Monthly 2,500 · Gym + Treadmill 4,500 · Per Day Treadmill 500 · Training Guidance 2,500 · Group Train 7,000 · Personal Train 12,000

### Done

- [x] Fee table CRUD (`/fees`)
- [x] Trainers roster CRUD (`/trainers`)
- [x] Trainer packages by category (`/trainer-packages`)
- [x] Optional trainer package + trainer on member admission

---

## Phase 4 — Payments

**Goal:** Record money against a membership period; keep status accurate.

### Data model — `payments`


| Field       | Type     | Notes          |
| ----------- | -------- | -------------- |
| id          | PK       |                |
| member_id   | FK       |                |
| amount      | decimal  |                |
| note        | string   | Optional       |
| paid_at     | datetime |                |
| recorded_by | string   | Admin username |


### Logic

- [x] On payment create: add to `members.amount_paid`, recalculate `payment_status`
- [x] Show payment history on member detail
- [x] Also supports trainer package payments (`kind`: gym | trainer)

### API

- [x] `POST /api/members/:id/payments`
- [x] `GET /api/members/:id/payments`
- [x] `GET /api/payments` — recent payments (optional dashboard)

### Frontend

- [x] “Add payment” on member detail (for unpaid / partial)
- [x] Payment history table
- [x] Simple Payments page (recent activity)

### Deliverable

- Partial → Paid flow works when remaining balance is paid.

---

## Phase 5 — Expiry alerts & renewals

**Goal:** When due date ends, alert appears; member can renew or change package.

### Expiry detection

- [x] Job or on-request check: if `end_date < today` and status was `active` → mark `expired`
- [x] Alerts list: expired + expiring soon (e.g. within 7 days)

### Data model — `renewals` (or membership periods)

History table for gym renewals (package, dates, amounts, payment status).

### Renewal flow

1. Admin opens alert / member → **Renew**
2. Choose package (same or change: 1 / 3 / 6 / 12)
3. Enter amount paid now
4. System sets new `start_date`, `end_date`, resets amounts/status, sets member `active`
5. Clear or resolve related alert

### API

- [x] `GET /api/alerts` — expired + expiring soon
- [x] `POST /api/members/:id/renew` — body: package_id, amount_paid, start_date (optional)
- [x] `POST /api/alerts/sync` — refresh expired flags

### Frontend

- [x] Alerts page / badge count in sidebar & mobile bar
- [x] Renew modal/form (package + payment)
- [x] Dashboard widgets: expiring soon, unpaid, today’s admissions

### Deliverable

- Expired members show in alerts; Mustafa can renew 3 months or switch plan.

---

## Phase 6 — Dashboard & polish

**Goal:** Simple home screen and production-ready UX.

### Dashboard

- [x] Total active members
- [x] Unpaid / partial count
- [x] Expiring in 7 days
- [x] Expired awaiting renewal
- [x] Recent admissions

### UX polish

- [x] Empty states, loading, and error messages
- [x] Form validation (13-digit CNIC and 10–15 digit contact)
- [x] Confirm dialogs for destructive actions
- [x] Consistent dark purple / white theme across all pages
- [x] Mobile footbar + desktop sidebar parity
- [x] Printable / CSV export member list

### Deliverable

- Day-to-day gym desk workflow feels complete and easy.

---

## Phase 7 — Hardening (optional)

- [ ] Change default password on first login
- [ ] Backup SQLite / DB dump script
- [ ] HTTPS / deploy notes (e.g. Render + Vercel, or single VPS)
- [ ] Audit log (who admitted / renewed / took payment)
- [ ] SMS/email reminder stubs for expiry (future)

---

## Suggested folder structure

```
HA-gym/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── members.py
│   │       ├── packages.py
│   │       ├── payments.py
│   │       └── alerts.py
│   ├── requirements.txt
│   └── seed.py
├── frontend/
│   ├── src/
│   │   ├── components/   # Sidebar, Footbar, Layout, UI kit
│   │   ├── pages/        # Login, Dashboard, Members, Packages, ...
│   │   ├── api/
│   │   ├── theme/
│   │   └── App.tsx
│   └── package.json
├── DEVELOPMENT_PLAN.md
└── README.md
```

---

## Phase order (build sequence)

```
Phase 0  Setup
   ↓
Phase 1  Auth (admin / admin123)
   ↓
Phase 2  Packages
   ↓
Phase 3  Admission (Mustafa flow)
   ↓
Phase 4  Payments (paid / unpaid / partial)
   ↓
Phase 5  Alerts + Renew / change plan
   ↓
Phase 6  Dashboard + polish
   ↓
Phase 7  Hardening (optional)
```

---

## Acceptance checklist (end-to-end)

1. Admin logs in with `admin` / `admin123`
2. Packages 1/3/6/12 months exist with prices
3. New member: name, contact, CNIC, email, address, package, initial payment → correct status
4. Add remaining payment → status becomes Paid
5. After end date → member appears in Alerts as expired / renew suggested
6. Renew same or different package → new dates + payment status
7. UI works on phone (footbar) and desktop (sidebar), purple/white theme

---

## Notes for implementation

- Keep forms short — one screen for admission.
- Prefer clear labels over dense tables on mobile.
- Calculate `end_date` server-side so clients cannot cheat dates.
- Never store plain-text passwords.
- Start with SQLite so setup stays easy for a single-gym desk PC.

