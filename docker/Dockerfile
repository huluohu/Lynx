# 构建阶段 - 编译前端 + 安装后端依赖
FROM node:24-slim AS builder

ARG APP_VERSION=dev
WORKDIR /app

# 前端依赖 & 构建
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && VITE_APP_VERSION=${APP_VERSION} npm run build

# 后端依赖
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# 运行时阶段
FROM node:24-slim

ENV TZ=Asia/Shanghai \
    NODE_ENV=production

ARG APP_VERSION=dev

RUN set -eux; \
    apt-get update && \
    apt-get install -y --no-install-recommends curl tini tzdata && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /app/data

WORKDIR /app

# 后端代码
COPY server/ ./server/

# 从 builder 复制 node_modules，避免被本机源码目录覆盖
COPY --from=builder /app/server/node_modules ./server/node_modules

# 前端构建产物
COPY --from=builder /app/client/dist ./client/dist

# 数据库迁移
COPY migrations/ ./migrations/

EXPOSE 3456

ENV PORT=3456 \
    DB_PATH=/app/data/lynx.db \
    APP_VERSION=${APP_VERSION} \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_OPTIONS="--max-old-space-size=512"

VOLUME ["/app/data"]

ENTRYPOINT ["tini", "--"]
CMD ["node", "server/index.js"]
