#!/bin/bash
echo "📊 启动投资盯盘系统..."
cd "$(dirname "$0")"
BACKEND_PORT="${PORT:-3456}"

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
cd client
npx vite --host 0.0.0.0 &
VITE_PID=$!
cd ..

echo ""
echo "✅ 服务启动中..."
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:${BACKEND_PORT}"
echo ""
echo "按 Ctrl+C 停止"

trap "[ -n \"$SERVER_PID\" ] && kill $SERVER_PID 2>/dev/null; kill $VITE_PID 2>/dev/null; exit" INT TERM
wait
