#!/bin/bash
# 投资追踪 - 微信通知推送
# 此脚本检查待推送通知，通过 openclaw message send 发送到微信
# 用法: bash notify_wechat.sh

API_BASE="http://localhost:3456/api"
WECHAT_TARGET="o9cq80xbTzBA4ECsNax0SJPEB8MM@im.wechat"

# 从环境变量或设置获取 JWT（如果有缓存的话）
JWT_CACHE="/tmp/lynx-invest-jwt"

# 登录
get_token() {
  local resp=$(curl -sf -X POST "$API_BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${AUTH_USERNAME:-admin}\",\"password\":\"${AUTH_PASSWORD:-admin123}\"}" 2>/dev/null)
  if [ -n "$resp" ]; then
    echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null
  fi
}

TOKEN=$(cat "$JWT_CACHE" 2>/dev/null) || true
# 验证 token 是否有效
VALID=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_BASE/assets" 2>/dev/null | head -1)
if [ -z "$VALID" ]; then
  TOKEN=$(get_token)
  if [ -n "$TOKEN" ]; then
    echo "$TOKEN" > "$JWT_CACHE"
  fi
fi

if [ -z "$TOKEN" ]; then
  echo "❌ 无法获取 JWT"
  exit 1
fi

# 获取待推送的微信通知
RESP=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_BASE/notifications/send-wechat" 2>/dev/null)
if [ -z "$RESP" ]; then
  exit 0
fi

MESSAGE=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null)

if [ "$COUNT" = "0" ] || [ -z "$MESSAGE" ]; then
  exit 0
fi

# 通过 openclaw CLI 发送
echo "$MESSAGE" | python3 -c "
import sys, subprocess
msg = sys.stdin.read()
result = subprocess.run(['openclaw', 'message', 'send', '--channel', 'openclaw-weixin', '--target', '$WECHAT_TARGET', '--message', msg], capture_output=True, text=True)
print(result.stdout)
" 2>/dev/null

echo "✅ 发送 $COUNT 条通知"