# Stage 1: Build frontend
FROM node:22-alpine AS builder
ARG APP_VERSION=dev
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && VITE_APP_VERSION=${APP_VERSION} npm run build

# Stage 2: Production image
FROM node:22-alpine
WORKDIR /app

ARG APP_VERSION=dev

# better-sqlite3 编译依赖 + healthcheck
RUN apk add --no-cache curl python3 make g++

# 后端依赖（在容器内编译 native 模块确保架构匹配）
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# 源码
COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY migrations/ ./migrations/

EXPOSE 3456

ENV NODE_ENV=production \
    PORT=3456 \
    DB_PATH=/app/data/invest.db \
    APP_VERSION=${APP_VERSION} \
    TZ=Asia/Shanghai \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_OPTIONS="--max-old-space-size=512"

# 数据目录（volume 挂载）
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
