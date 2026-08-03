# HA Fitness

Gym management app — Python (FastAPI) + React (Vite).

## Quick start

### Backend

```bash
cd backend
py -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/api/health

Admin is seeded on startup: `admin` / `admin123`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5180

Vite proxies `/api` to the backend on port 8000.

## Default packages

Seeded on first run and editable on the Packages screen:

| Plan | Price |
| --- | --- |
| 1 Month | Rs 3,000 |
| 3 Months | Rs 8,000 |
| 6 Months | Rs 15,000 |
| 12 Months | Rs 28,000 |

## Phases

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md).
