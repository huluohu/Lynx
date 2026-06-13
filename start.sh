#!/bin/bash
echo "📊 启动投资盯盘系统..."
cd "$(dirname "$0")"

# 启动后端
node server/index.js &
SERVER_PID=$!
echo "后端启动 (PID: $SERVER_PID)"

# 启动前端
cd client
npx vite --host 0.0.0.0 &
VITE_PID=$!
cd ..

echo ""
echo "✅ 服务启动中..."
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:3456"
echo ""
echo "按 Ctrl+C 停止"

trap "kill $SERVER_PID $VITE_PID 2>/dev/null; exit" INT TERM
wait
