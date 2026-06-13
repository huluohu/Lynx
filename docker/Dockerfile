# Stage 1: Build frontend
FROM node:22-alpine AS builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Production image
FROM node:22-alpine
WORKDIR /app

# healthcheck 依赖
RUN apk add --no-cache curl

# 后端依赖
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
    TZ=Asia/Shanghai \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_OPTIONS="--max-old-space-size=512"

# 数据目录（volume 挂载）
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
