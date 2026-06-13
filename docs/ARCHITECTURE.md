# 投资盯盘 · 扭亏计划系统

> 本地 Web 仪表盘，实时追踪黄金 + 比特币组合持仓，辅助执行扭亏操作计划。

---

## 一、背景与目标

### 1.1 持仓现状

| 资产 | 持仓 | 成本 | 当前（6/13） | 浮亏 |
|------|------|------|-------------|------|
| 黄金 | 30g | ¥1,127.65/g | ¥920/g | -18.4% |
| BTC | 0.0216 枚 | $100,500 | $64,000 | -36.2% |
| **合计** | — | ¥48,508 | ¥36,967 | **-¥11,541 (-23.9%)** |

### 1.2 破局策略

核心思路：**用一种资产的波动给另一种资产补血**，不各管各的。

1. **优先补 BTC** —— 弹性大，补仓降本效果显著
2. **反弹卖 BTC 转买黄金** —— BTC 如果先反弹，减仓利润全部注入黄金
3. **黄金等 880 以下一次补** —— 省着用预算，等低位

### 1.3 系统定位

- **展示层**：随时打开看全景，不用等微信消息
- **不是交易系统**：不做自动下单、不上链、不做 VPN 代理，纯查询+展示
- **与监控脚本互补**：monitor_gold.py / monitor_btc.py 走心跳自动推微信，本系统给人工盯着用

---

## 二、技术方案

### 2.1 选型逻辑

| 环节 | 方案 | 理由 |
|------|------|------|
| 前端框架 | Vue 3 (Composition API) | 轻量、组件化、不引入状态管理 |
| 构建工具 | Vite 5 | 秒启、HMR、内置代理 |
| 后端 | Node.js 原生 `http` 模块 | **零外部依赖**，不装 Express/Koa |
| 样式 | 纯 CSS Variables | 不引入 Tailwind，深色主题手写 |
| 数据源 | neodata + CoinGecko | 两个免费 API，不要 key |

**零依赖设计**：后端只依赖 Node.js 标准库（`http`, `https`, `fs`, `path`），省去 npm install 步骤。

### 2.2 项目结构

```
invest-compass/
├── start.sh                    # 一键启动（前端 + 后端）
├── price_cache.json            # 价格缓存（周末/API 故障时用）
├── package.json                # concurrently 启动脚本（备用）
├── server/
│   └── index.js                # 后端全部逻辑（路由、查询、缓存、生产静态文件）
└── client/
    ├── index.html
    ├── vite.config.js          # 开发代理 /api → localhost:3456
    └── src/
        ├── main.js             # Vue 入口
        ├── App.vue             # 主面板（总览 + 计划表 + 铁律）
        ├── style.css           # 全局样式（深色主题）
        └── components/
            ├── GoldCard.vue    # 黄金持仓卡片
            └── BTCCard.vue     # BTC 持仓卡片
```

### 2.3 端口架构

```
浏览器 → localhost:5173 (Vite Dev Server)
                │
                ├─ /api/* ──→ localhost:3456 (Node 后端)
                │                 │
                │                 ├─ neodata proxy (金价)
                │                 └─ api.coingecko.com (BTC)
                │
                └─ /*.vue/.js → Vite 编译 + HMR
```

- **开发模式**：Vite 代理 API 到后端，热更新前端代码
- **生产模式**：`npx vite build` → Node 后端直接 serve 静态 `dist/` 目录

### 2.4 数据流

```
                   ┌─────────────────────────────┐
                   │        Node Server           │
                   │                              │
   GET /api/prices │ fetchGold() ──→ neodata 代理  │
        ──────────→│                              │────→ JSON
                   │ fetchBTC()  ──→ CoinGecko     │
                   │                              │
   GET /api/plan   │ 静态数据（持仓 + 8步计划）      │
        ──────────→│                              │────→ JSON
                   └─────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │   Vue App.vue   │
                   │                 │
                   │ ├─ GoldCard     │  实时价格
                   │ ├─ BTCCard      │  浮亏浮盈
                   │ ├─ 总览         │  总投入/市值/收益率
                   │ └─ 计划表       │  8步 + 触发检测
                   └─────────────────┘
```

每分钟自动 `fetch('/api/prices')` + `fetch('/api/plan')` 刷新。

---

## 三、API 设计

### 3.1 GET `/api/prices`

```json
{
  "success": true,
  "data": {
    "gold": {
      "shanghai": 920,
      "london": 4239.9,
      "_cached": true
    },
    "btc": {
      "usd": 64062,
      "cny": 433700,
      "ch24": 1.01,
      "ch7d": 0
    },
    "profit": {
      "gold": { "pl": -6230, "pl_pct": -18.41 },
      "btc": { "pl": -5310, "pl_pct": -36.18 },
      "total_pl": -11541,
      "total_pl_pct": -23.79,
      "total_value": 36967,
      "total_cost": 48508
    },
    "isWeekend": true
  }
}
```

- `gold._cached: true` 表示金市休市，显示的是上次缓存价格
- `profit.*` 全部在后端计算完毕，前端不需要理财逻辑

### 3.2 GET `/api/plan`

```json
{
  "success": true,
  "holdings": {
    "gold": { "amount": 30, "cost_per": 1127.65, "total_cost": 33830 },
    "btc": { "amount": 0.0216, "cost_per_cny": 679543, ... }
  },
  "plan": [
    { "seq": 1, "asset": "BTC", "trigger": "$55,000", "action": "补仓", ... },
    ...
  ],
  "budget": 20000
}
```

- 持仓和计划写死在后端常量中
- 预算 20,000 元为当前用户可用资金
- 计划表不动态生成，需要策略调整时直接改后端 `PLAN` 数组

---

## 四、关键设计决策

### 4.1 金价缓存策略

```
isWeekend()?
  ├─ Yes + 有缓存 → 返回缓存（标记 _cached: true）
  └─ No
      └─ 查 neodata
          ├─ 成功 → 更新缓存 + 返回
          └─ 失败
              ├─ 有缓存 → 返回缓存
              └─ 无缓存 → null
```

- 周末判断基于 Asia/Shanghai 时区：周六/日全天、周五 15:00 后、周一 9:00 前视为休市
- neodata 通过 `localhost:{AUTH_GATEWAY_PORT}/proxy/api` 代理访问，需要 `Remote-URL` header 指向实际 API
- 失败不阻塞，有缓存用缓存，没缓存显示 `-`

### 4.2 CoinGecko 403 问题

CoinGecko 对无 User-Agent 的请求返回 403。后端在 `httpJson()` 中统一加 `User-Agent: InvestTracker/1.0`。

### 4.3 触发检测在前端

不在后端判断是否触发，而是前端拿到价格后实时计算：

```javascript
function getTriggerStatus(trigger, asset, type) {
  // 解析 "¥880" → 880, "$55,000" → 55000
  // 补仓: 当前价 ≤ 触发价 → 触发
  // 减仓: 当前价 ≥ 触发价 → 触发
}
```

触发后计划表对应行标红⚡，同时顶部显示 Banner 横幅。

### 4.4 风格设计

- 深色背景 (`#0a0e17`) + 卡片式布局
- 红色 = 亏损/卖出，绿色 = 盈利/买入（国际惯例）
- 价格大字体 (48px) 类似加密货币 APP 的行情展示
- 进度条直观展示浮亏/浮盈比例

---

## 五、启动方式

```bash
# 一键启动
bash ~/workspace/invest-compass/start.sh

# 访问
open http://localhost:5173
```

---

## 六、与监控脚本的关系

| | monitor_gold.py / monitor_btc.py | invest-compass |
|---|---|---|
| 运行方式 | heartbeat 后台自动 | 手动打开页面 |
| 推送渠道 | 微信消息 | Web 页面 |
| 频率 | ~30 分钟/次（心跳） | 1 分钟/次（页面内） |
| 触发提醒 | ✅ 推微信 | ✅ 页面高亮 |
| 全景视图 | ❌ 纯文本 | ✅ 卡片+表格 |

---

## 七、待定事项

- [ ] 用户首次使用反馈（UI 调整、数据展示方式）
- [ ] 策略调整时同步修改后端 `PLAN` 数组 + `HOLDINGS` + `BUDGET`
- [ ] 生产部署（`npx vite build` → Node serve dist，长期跑考虑 pm2）
- [ ] 多币种汇率（当前写死 6.77，后续可改为实时汇率 API）
- [ ] 盈亏历史记录（当前只显示实时，不存历史）
