# LWAC

LWAC is a full-stack learning platform built around lessons, quizzes, vocabulary practice, coaching, chat, uploads, rewards, and student progress tracking. The repository contains a React frontend, a FastAPI backend, and local/deployment infrastructure for running the application in development and containerized environments.

## Overview

The platform appears to support an English-learning workflow for students, teachers, and coaches. The backend exposes API endpoints for core learning flows, while the frontend provides separate pages for dashboards, lesson management, practice, testing, chat, and reward experiences.

Main product areas in this repository:

- Lessons and lesson management
- Daily quiz and general quiz flows
- Vocabulary study
- Chat and coach chat
- Speaking, writing, reading, and listening test pages
- Upload handling
- Results and reward tracking
- Student and teacher management views

## Tech Stack

- Frontend: React 18, Vite, React Router, Zustand
- Styling/UI: CSS, Tailwind CSS, Radix UI, Lucide icons
- Backend: FastAPI, Uvicorn, Pydantic
- Database: PostgreSQL in Docker, SQLite fallback/default in some local paths
- ORM and migrations: SQLAlchemy, Alembic
- AI/LLM integration: Google GenAI client
- Infra: Docker Compose, Nginx, Render config

## Repository Structure

```text
LWAC/
├── backend/                FastAPI application, models, services, tests, Alembic
├── frontend/               React + Vite frontend
├── static/                 Generated/static assets at repo root
├── docker-compose.yaml     Local multi-service setup
├── render.yaml             Render deployment configuration
└── README.md               Project overview and setup guide
```

Important backend areas:

- `backend/main.py`: FastAPI entrypoint
- `backend/apps/`: route modules grouped by domain
- `backend/models/`: SQLAlchemy models
- `backend/repositories/`: data access layer
- `backend/services/`: service-level logic
- `backend/alembic/`: migration config and versions
- `backend/tests/`: test suite

Important frontend areas:

- `frontend/src/pages/`: app screens
- `frontend/src/components/`: reusable UI pieces
- `frontend/src/contexts/`: shared state/context
- `frontend/src/api.js`: API client entrypoint

## Core Features

Based on the current codebase, LWAC includes these major modules:

- User management
- Lesson creation and lesson delivery
- Quiz and daily quiz APIs
- Vocabulary APIs and study UI
- Chat and coach flows
- Upload endpoints
- Result tracking
- Reward management
- Static asset serving for generated files

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 18+ and npm
- Docker and Docker Compose if you want the containerized stack

### Backend setup

From [backend](/Users/user/Work/LWAC/backend):

```bash
uv sync
uv run uvicorn main:app --reload
```

If you are not using `uv`, install dependencies from [backend/pyproject.toml](/Users/user/Work/LWAC/backend/pyproject.toml) with your preferred Python environment manager and then run Uvicorn manually.

Default backend URL:

- `http://localhost:8000`

Health/root response:

- `GET /` returns a welcome message

### Frontend setup

From [frontend](/Users/user/Work/LWAC/frontend):

```bash
npm install
npm run dev
```

Default frontend URL:

- `http://localhost:5173`

### Environment variables

Backend settings are defined in [backend/core/config.py](/Users/user/Work/LWAC/backend/core/config.py). The main variables currently used are:

- `DATABASE_URL`
- `SECRET_KEY`
- `GEMINI_API_KEY`
- `ENVIRONMENT`

Frontend builds may also need:

- `VITE_API_URL`

The repository already includes [.env.example](/Users/user/Work/LWAC/.env.example), which should be used as the starting point for local configuration when available.

## Docker Setup

The root [docker-compose.yaml](/Users/user/Work/LWAC/docker-compose.yaml) defines these services:

- `backend`: FastAPI app on port `8000`
- `nginx`: reverse proxy on port `80` by default
- `db`: PostgreSQL 17
- `db_migrate`: Alembic migration runner
- `adminer`: database UI on port `5050`

Run the stack from the repository root:

```bash
docker compose up --build
```

Notes:

- The backend container mounts [backend](/Users/user/Work/LWAC/backend) into `/app`
- Static backend files are stored in a Docker volume
- Database credentials default to local development values unless overridden

## Database and Migrations

Alembic configuration lives in:

- [backend/alembic.ini](/Users/user/Work/LWAC/backend/alembic.ini)
- [backend/alembic](/Users/user/Work/LWAC/backend/alembic)

To run migrations locally from [backend](/Users/user/Work/LWAC/backend):

```bash
uv run alembic upgrade head
```

The Docker workflow already includes a `db_migrate` service to apply migrations before the backend starts.

## Backend Notes

- The API entrypoint is [backend/main.py](/Users/user/Work/LWAC/backend/main.py)
- Static files are served from `backend/static` at `/static`
- CORS is currently configured permissively with `allow_origins=["*"]`
- Domain routers are split across `apps/chat`, `apps/coach`, `apps/dailyquiz`, `apps/lesson`, `apps/quiz`, `apps/result`, `apps/reward`, `apps/upload`, `apps/user`, and `apps/vocab`

## Frontend Notes

The frontend currently contains screens for:

- Dashboard and hub views
- Login
- Lesson builder and lesson manager
- Practice list
- Vocab
- Daily quiz
- Reading, writing, listening, and speaking test pages
- Coach dashboard and coach chat
- Student management and reward views

This suggests the UI covers both learner and instructor/coach workflows.

## Testing and Development Commands

Backend test files live under [backend/tests](/Users/user/Work/LWAC/backend/tests).

Useful commands:

```bash
# backend
cd backend
uv run pytest

# frontend
cd frontend
npm run lint
npm run build
```

There is also a helper script at [backend/test_all_endpoints.sh](/Users/user/Work/LWAC/backend/test_all_endpoints.sh).

## Deployment Notes

The repository includes [render.yaml](/Users/user/Work/LWAC/render.yaml) for Render deployment and Nginx config under [backend/nginx/nginx.conf](/Users/user/Work/LWAC/backend/nginx/nginx.conf).

There are signs of in-progress infrastructure changes in the repo:

- Some deployment files still reference older backend paths
- The backend README is currently empty
- The frontend README is still the default Vite template

Treat the current deployment config as a starting point that should be verified against the latest backend layout before production use.

## Development Guidance

- Keep secrets in local env files, not in git
- Use the root [`.gitignore`](/Users/user/Work/LWAC/.gitignore) for local-only artifacts
- Prefer migrations over manual schema drift
- Verify Render and Docker commands against the current module layout before release

## Current State

This codebase is already organized around clear backend domains and a fairly broad frontend surface area, but some project documentation and deployment references still need consolidation. This README is intended to provide a single repo-level entry point while those gaps are cleaned up.
