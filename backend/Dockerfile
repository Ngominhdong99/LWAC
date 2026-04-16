# ---------- Stage 1: Builder ----------
FROM python:3.13-alpine AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apk add --no-cache \
    build-base \
    libffi-dev \
    postgresql-dev

ENV UV_PROJECT_ENVIRONMENT=/usr/local

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN uv sync --frozen --no-dev --no-editable

RUN apk del build-base postgresql-dev libffi-dev \
    && rm -rf /root/.cache /tmp/*

# ---------- Stage 2: Runtime ----------
FROM python:3.13-alpine

WORKDIR /app

RUN apk add --no-cache \
    libpq \
    libffi

COPY --from=builder /usr/local /usr/local
COPY --from=builder /app /app
