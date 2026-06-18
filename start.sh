#!/bin/bash
echo "📊 启动Lynx..."
cd "$(dirname "$0")"
BACKEND_PORT="${BACKEND_PORT:-${PORT:-3456}}"
CLIENT_PORT="${CLIENT_PORT:-5173}"
export BACKEND_PORT
export CLIENT_PORT
export PORT="$BACKEND_PORT"

# 启动后端
SERVER_PID=""
if curl -fsS "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
  echo "后端已在运行，复用 http://localhost:${BACKEND_PORT}"
elif lsof -nP -iTCP:${BACKEND_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ 端口 ${BACKEND_PORT} 已被其他进程占用："
  lsof -nP -iTCP:${BACKEND_PORT} -sTCP:LISTEN
  echo "请停止该进程，或使用 PORT=其他端口 启动后端。"
  exit 1
else
  node server/index.js &
  SERVER_PID=$!
  echo "后端启动 (PID: $SERVER_PID)"
fi

# 启动前端
VITE_PID=""
if curl -fsS "http://localhost:${CLIENT_PORT}/" >/dev/null 2>&1; then
  echo "前端已在运行，复用 http://localhost:${CLIENT_PORT}"
elif lsof -nP -iTCP:${CLIENT_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ 端口 ${CLIENT_PORT} 已被其他进程占用："
  lsof -nP -iTCP:${CLIENT_PORT} -sTCP:LISTEN
  echo "请停止该进程，或使用 CLIENT_PORT=其他端口 启动前端。"
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  exit 1
else
  cd client
  npx vite --host 0.0.0.0 &
  VITE_PID=$!
  cd ..
  echo "前端启动 (PID: $VITE_PID)"
fi

echo ""
echo "✅ 服务启动中..."
echo "   前端: http://localhost:${CLIENT_PORT}"
echo "   后端: http://localhost:${BACKEND_PORT}"
echo ""
echo "按 Ctrl+C 停止"

trap '[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null; [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null; exit' INT TERM
wait
