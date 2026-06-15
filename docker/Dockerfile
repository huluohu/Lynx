# Stage 1: Build frontend
FROM node:22-slim AS frontend-builder
ARG APP_VERSION=dev
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && VITE_APP_VERSION=${APP_VERSION} npm run build

# Stage 2: Production image (Debian slim: glibc, better-sqlite3 预编译二进制可直接用)
FROM node:22-slim
WORKDIR /app

ARG APP_VERSION=dev

ENV TZ=Asia/Shanghai \
    NODE_ENV=production \
    PORT=3456 \
    DB_PATH=/app/data/lynx.db \
    APP_VERSION=${APP_VERSION} \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_OPTIONS="--max-old-space-size=512"

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tini tzdata && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /app/data

# 后端依赖（预编译二进制，无需编译工具）
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY --from=frontend-builder /app/client/dist ./client/dist
COPY migrations/ ./migrations/

EXPOSE 3456

VOLUME ["/app/data"]

ENTRYPOINT ["tini", "--"]
CMD ["node", "server/index.js"]
