# Plainer

AI-powered collaborative workspace with a Drive-like file system, real-time chat, and an AI agent that can read/write/organize your files.

## Tech Stack

**Backend:** Python 3.11, FastAPI, SQLAlchemy (async), PostgreSQL, Redis, Alembic migrations
**Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, TanStack React Query, TipTap
**AI:** Anthropic Claude API with tool-use agent
**File Storage:** Local filesystem (dev) or S3 (production)

## Project Structure

```
plainer-code/
├── backend/
│   ├── app/
│   │   ├── agent/          # AI agent (system prompt, tools, orchestration)
│   │   ├── api/            # FastAPI route handlers
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (files, chat, sharing)
│   │   ├── storage/        # Storage backends (local, S3)
│   │   ├── websocket/      # WebSocket connection manager
│   │   ├── config.py       # Settings via env vars
│   │   ├── database.py     # Async engine + session
│   │   ├── dependencies.py # FastAPI dependency injection
│   │   └── main.py         # App entrypoint + WebSocket handler
│   ├── alembic/            # Database migrations
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── alembic.ini
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios client + API functions
│   │   ├── components/     # React components (drive, chat, auth)
│   │   ├── hooks/          # Custom hooks (WebSocket, auth)
│   │   ├── lib/            # Types, utilities
│   │   └── stores/         # Zustand state stores
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml      # Local dev infrastructure
└── .env.example
```

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for PostgreSQL and Redis)

### 1. Start Database & Redis

```bash
docker compose up postgres redis -d
```

This starts:
- PostgreSQL on port **5433** (mapped from container 5432)
- Redis on port **6380** (mapped from container 6379)

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Copy env file and configure
cp ../.env.example .env
# Edit .env if needed (defaults work with docker compose)

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

The backend runs on `http://localhost:8000`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` requests to the backend.

### Environment Variables

See `.env.example` for all available variables. Key ones:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://plainer:plainer_dev@localhost:5433/plainer` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6380` | Redis connection |
| `JWT_SECRET_KEY` | `change-me-to-a-random-secret-key` | JWT signing key (change in production) |
| `STORAGE_BACKEND` | `local` | `local` or `s3` |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | JSON array of allowed origins |
| `VITE_API_URL` | _(empty, uses localhost:8000)_ | Backend URL for frontend (set in production) |

## Database Migrations

```bash
cd backend

# Apply all migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "description of change"

# Rollback one migration
alembic downgrade -1
```

## Production Deployment (Railway)

The app is deployed on [Railway](https://railway.app) as separate services in a single project.

### Services

| Service | Type | Description |
|---|---|---|
| **backend-v2** | Docker (from `backend/Dockerfile`) | FastAPI API + WebSocket server |
| **frontend-v2** | Railpack (auto-detected Node.js) | Static SPA served by Caddy |
| **Postgres** | Railway managed | PostgreSQL database |
| **Redis** | Railway managed | Redis cache |

### How It Works

- **Backend** uses the `Dockerfile` in `backend/`. On startup it runs `alembic upgrade head` then starts uvicorn on `$PORT`.
- **Frontend** is auto-detected as a Node.js app by Railpack. It runs `npm run build` (which does `tsc -b && vite build`) and serves the `dist/` folder via Caddy.
- Both services are deployed via `railway up` from their respective directories.

### Deploying Changes

**First-time setup** (already done):

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to the project
railway link
# Select: plainer-code → production
```

**Deploy backend:**

```bash
cd backend
railway up --service backend-v2 --ci
```

**Deploy frontend:**

```bash
cd frontend
railway up --service frontend-v2 --ci
```

**Deploy both at once (from project root):**

```bash
cd backend && railway up --service backend-v2 --detach && cd ../frontend && railway up --service frontend-v2 --detach
```

### Required Environment Variables on Railway

**backend-v2:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://...(from Railway Postgres)` |
| `REDIS_URL` | `redis://...(from Railway Redis)` |
| `JWT_SECRET_KEY` | A random secret string |
| `CORS_ORIGINS` | `["https://your-frontend.up.railway.app"]` |
| `STORAGE_BACKEND` | `s3` |
| `S3_BUCKET_NAME` | Your S3 bucket name |
| `S3_ACCESS_KEY_ID` | Your AWS access key |
| `S3_SECRET_ACCESS_KEY` | Your AWS secret key |

**frontend-v2:**

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend.up.railway.app` |

### Setting Variables via CLI

```bash
railway variable set KEY=VALUE --service backend-v2
railway variable set VITE_API_URL=https://backend-v2-production-96a1.up.railway.app --service frontend-v2
```

### Checking Status

```bash
# All services
railway service status --all

# Logs
railway service logs --service backend-v2 --latest -n 50
railway service logs --service frontend-v2 --latest -n 50

# Build logs
railway service logs --service backend-v2 --build --latest -n 100
```

### Notes

- The `DATABASE_URL` on Railway uses `postgresql://` — the backend's `config.py` auto-converts it to `postgresql+asyncpg://` for async SQLAlchemy.
- `CORS_ORIGINS` must be a valid JSON array string (e.g. `["https://example.com"]`).
- The backend's Dockerfile uses `${PORT:-8000}` so Railway can assign its own port.
- After changing env vars, redeploy with `railway redeploy --service <name> --yes` or re-run `railway up`.
