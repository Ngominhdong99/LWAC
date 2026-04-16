# ---------- Stage 1: Build ----------
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# ---------- Stage 2: Runtime ----------
FROM alpine:3.23.4

WORKDIR /dist
COPY --from=builder /app/dist .

CMD ["sh", "-c", "mkdir -p /usr/share/nginx/html && cp -r /dist/. /usr/share/nginx/html/"]