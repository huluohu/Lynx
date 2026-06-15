<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ loading ? '策略详情' : (strategy.name || '策略详情') }}</h1>
      <div v-if="!loading" class="page-actions hide-on-mobile">
        <button class="btn" @click="runBacktestAction" :disabled="backtesting">{{ backtesting ? '回测中...' : '📊 回测' }}</button>
        <button class="btn" @click="runStressTestAction" :disabled="stressTesting">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6"/><path d="M10 9h4"/><path d="M8 3v3.5a1 1 0 0 0 .3.7l5.4 5.4a4 4 0 1 1-5.66 5.66l-5.4-5.4A1 1 0 0 1 2 12.16V3h6"/><path d="M14 3v3.5a1 1 0 0 1-.3.7l-.7.7"/></svg>
          {{ stressTesting ? '测试中...' : '压力测试' }}
        </button>
        <button class="btn" @click="showAIRegenerate = true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> AI 重新生成</button>
        <button class="btn btn-primary" @click="generatePlan" :disabled="generating">{{ generating ? '生成中...' : '生成计划' }}</button>
        <router-link :to="`/strategies/${route.params.id}/edit`" class="btn">编辑</router-link>
        <button class="btn btn-danger" @click="showDeleteConfirm = true">删除</button>
      </div>
      <button v-if="!loading" class="btn btn-icon show-on-mobile" @click="showActions = !showActions" title="操作">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>

    <div v-if="loading">
      <div class="card skeleton-card" v-for="i in 3" :key="i">
        <div class="skeleton skeleton-text" style="width:140px;margin-bottom:16px"></div>
        <div class="skeleton skeleton-text" style="width:100%"></div>
        <div class="skeleton skeleton-text short" style="margin-top:10px"></div>
      </div>
    </div>

    <template v-else>
      <!-- Mobile action sheet -->
      <div v-if="showActions" class="action-sheet-overlay" @click="showActions = false"></div>
      <transition name="slide-up">
        <div v-if="showActions" class="action-sheet">
          <div class="action-sheet-item" @click="runBacktestAction(); showActions = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 14 3-3 3 2 4-5"/></svg>
            {{ backtesting ? '回测中...' : '运行回测' }}
          </div>
          <div class="action-sheet-item" @click="runStressTestAction(); showActions = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6"/><path d="M10 9h4"/><path d="M8 3v3.5a1 1 0 0 0 .3.7l5.4 5.4a4 4 0 1 1-5.66 5.66l-5.4-5.4A1 1 0 0 1 2 12.16V3h6"/><path d="M14 3v3.5a1 1 0 0 1-.3.7l-.7.7"/></svg>
            {{ stressTesting ? '压力测试中...' : '运行压力测试' }}
          </div>
          <div class="action-sheet-item" @click="showAIRegenerate = true; showActions = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
            AI 重新生成
          </div>
          <div class="action-sheet-item" @click="generatePlan(); showActions = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
            生成计划
          </div>
          <router-link :to="`/strategies/${route.params.id}/edit`" class="action-sheet-item" @click="showActions = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            编辑策略
          </router-link>
          <div class="action-sheet-item danger" @click="showDeleteConfirm = true; showActions = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            删除策略
          </div>
          <div class="action-sheet-cancel" @click="showActions = false">取消</div>
        </div>
      </transition>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title">📋 策略信息</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">类型</span><span class="badge badge-buy">{{ typeLabel(strategy.type) }}</span></div>
          <div class="info-row"><span class="info-label">关联资产</span><span>{{ strategy.asset_name || '-' }} {{ strategy.symbol }}</span></div>
          <div class="info-row"><span class="info-label">状态</span><span class="badge" :class="strategy.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ statusLabel(strategy.status) }}</span></div>
          <div class="info-row" v-if="strategy.description"><span class="info-label">描述</span><span style="color:var(--text-dim)">{{ strategy.description }}</span></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title">⚙️ 参数</div>
        <div class="info-list" v-if="parsedParams">
          <template v-if="strategy.type === 'recovery'">
            <div class="info-row"><span class="info-label">预算</span><span>¥{{ parsedParams.budget }}</span></div>
            <div v-if="parsedParams.buy_lines?.length" style="margin-top:8px">
              <span class="info-label" style="display:block;margin-bottom:4px">补仓线</span>
              <div v-for="(l,i) in parsedParams.buy_lines" :key="'b'+i" class="line-tag buy">≤ ¥{{ l.price }} → 买入 ¥{{ l.amount }}</div>
            </div>
            <div v-if="parsedParams.sell_lines?.length" style="margin-top:8px">
              <span class="info-label" style="display:block;margin-bottom:4px">减仓线</span>
              <div v-for="(l,i) in parsedParams.sell_lines" :key="'s'+i" class="line-tag sell">≥ ¥{{ l.price }} → 卖出 ¥{{ l.amount }}</div>
            </div>
          </template>
          <template v-else>
            <div v-for="(v, k) in parsedParams" :key="k" class="info-row">
              <span class="info-label">{{ k }}</span><span>{{ v }}</span>
            </div>
          </template>
        </div>
      </div>

      <div class="card">
        <div class="section-title">📋 操盘计划 ({{ plans.length }} 步)</div>
        <div v-if="generating" style="text-align:center;padding:24px"><span class="spinner"></span> 生成中...</div>

        <table v-else-if="plans.length" class="hide-mobile">
          <thead><tr><th>#</th><th>触发条件</th><th>价位</th><th>操作</th><th>数量</th><th>金额</th><th>补后均价</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="p in plans" :key="p.id">
              <td>{{ p.seq }}</td>
              <td style="font-size:12px;color:var(--text-dim)">{{ triggerLabel(p.trigger_type) }}</td>
              <td style="font-weight:600">{{ p.trigger_value }}</td>
              <td><span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? '买入' : '卖出' }}</span></td>
              <td>{{ p.quantity ? p.quantity.toFixed(4) : '-' }}</td>
              <td>{{ p.amount ? '¥'+Math.round(p.amount) : '-' }}</td>
              <td>{{ p.new_avg_cost ? '¥'+p.new_avg_cost : '-' }}</td>
              <td><span class="badge" :class="planStatusBadge(p.status)">{{ planStatusLabel(p.status) }}</span></td>
            </tr>
          </tbody>
        </table>

        <div v-if="plans.length" class="show-mobile plan-cards">
          <div v-for="p in plans" :key="p.id" class="plan-card">
            <div class="plan-card-header">
              <span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? '买入' : '卖出' }}</span>
              <span class="badge" :class="planStatusBadge(p.status)">{{ planStatusLabel(p.status) }}</span>
            </div>
            <div class="plan-card-body">
              <div class="plan-card-price">{{ triggerLabel(p.trigger_type) }} <b>{{ p.trigger_value }}</b></div>
              <div class="plan-card-meta">
                <span v-if="p.quantity">数量: {{ p.quantity.toFixed(4) }}</span>
                <span v-if="p.amount">金额: ¥{{ Math.round(p.amount) }}</span>
                <span v-if="p.new_avg_cost">均价: ¥{{ p.new_avg_cost }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty" style="padding:24px"><p>点击"生成计划"来创建执行步骤</p></div>
      </div>

      <div class="card">
        <div class="section-title">📊 回测结果</div>
        <div v-if="backtestLoading" class="backtest-loading">
          <div class="stat-card" v-for="i in 5" :key="i">
            <div class="skeleton skeleton-text short"></div>
            <div class="skeleton skeleton-price" style="height:24px;width:90px;margin-top:10px"></div>
          </div>
        </div>
        <template v-else-if="latestBacktest">
          <div class="backtest-meta">
            <span>区间：{{ fmtDate(latestBacktest.start_date) }} → {{ fmtDate(latestBacktest.end_date) }}</span>
            <span>已保存 {{ backtestResults.length }} 次结果</span>
          </div>
          <div class="backtest-stats">
            <div class="stat-card">
              <div class="stat-label">总收益率</div>
              <div class="stat-value" :class="latestBacktest.total_return_pct >= 0 ? 'pnl positive' : 'pnl negative'">{{ fmtSignedPct(latestBacktest.total_return_pct) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">最大回撤</div>
              <div class="stat-value pnl negative">{{ fmtPct(latestBacktest.max_drawdown_pct) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">胜率</div>
              <div class="stat-value">{{ fmtPct(latestBacktest.win_rate) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">交易次数</div>
              <div class="stat-value">{{ latestBacktest.total_trades || 0 }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">夏普比率</div>
              <div class="stat-value">{{ fmtNumber(latestBacktest.sharpe_ratio) }}</div>
            </div>
          </div>

          <div class="info-list" style="margin-top:16px">
            <div class="info-row"><span class="info-label">初始资金</span><span>¥{{ fmtMoney(latestBacktest.initial_investment) }}</span></div>
            <div class="info-row"><span class="info-label">最终价值</span><span>¥{{ fmtMoney(latestBacktest.final_value) }}</span></div>
            <div class="info-row"><span class="info-label">最近执行</span><span>{{ fmtDateTime(latestBacktest.created_at) }}</span></div>
          </div>

          <details class="trade-log" :open="!!latestBacktest.details?.length">
            <summary>执行明细 ({{ latestBacktest.details?.length || 0 }})</summary>
            <div v-if="latestBacktest.details?.length" class="trade-log-list">
              <div v-for="(item, index) in latestBacktest.details" :key="`${item.plan_id}-${index}`" class="trade-log-item">
                <div class="trade-log-top">
                  <span class="badge" :class="item.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ item.action === 'buy' ? '买入' : '卖出' }}</span>
                  <span class="trade-log-time">{{ fmtDateTime(item.executed_at) }}</span>
                </div>
                <div class="trade-log-body">
                  <span>触发价 {{ fmtNumber(item.trigger_value) }}</span>
                  <span>成交价 {{ fmtNumber(item.price) }}</span>
                  <span>数量 {{ fmtNumber(item.quantity, 4) }}</span>
                  <span>金额 ¥{{ fmtMoney(item.amount) }}</span>
                  <span v-if="item.pnl !== undefined" :class="item.pnl >= 0 ? 'pnl positive' : 'pnl negative'">盈亏 {{ item.pnl >= 0 ? '+' : '-' }}¥{{ fmtMoney(Math.abs(item.pnl)) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty" style="padding:16px 0 0">暂无成交记录</div>
          </details>
        </template>
        <div v-else class="empty" style="padding:24px">
          <p>暂无回测结果，点击上方“📊 回测”开始分析。</p>
        </div>
      </div>

      <div class="card">
        <div class="section-title">🧪 压力测试</div>
        <div v-if="stressLoading" class="stress-grid">
          <div class="stress-card" v-for="i in 6" :key="i">
            <div class="skeleton skeleton-text" style="width:90px;margin-bottom:12px"></div>
            <div class="skeleton skeleton-text" style="width:100%;margin-bottom:8px"></div>
            <div class="skeleton skeleton-text short" style="margin-bottom:8px"></div>
            <div class="skeleton skeleton-text short"></div>
          </div>
        </div>
        <div v-else-if="stressResults.length" class="stress-grid">
          <div v-for="item in stressResults" :key="item.scenario_name" class="stress-card" :class="stressCardClass(item.return_pct)">
            <div class="stress-head">
              <div class="stress-title">{{ scenarioLabel(item) }}</div>
              <span class="badge" :class="Number(item.return_pct) >= 0 ? 'badge-buy' : 'badge-sell'">{{ fmtSignedPct(item.return_pct) }}</span>
            </div>
            <div class="stress-stats">
              <div class="stress-stat">
                <span class="stress-label">预期收益</span>
                <b :class="Number(item.return_pct) >= 0 ? 'pnl positive' : 'pnl negative'">{{ fmtSignedPct(item.return_pct) }}</b>
              </div>
              <div class="stress-stat">
                <span class="stress-label">最大回撤</span>
                <b class="pnl negative">{{ fmtPct(item.max_drawdown_pct) }}</b>
              </div>
              <div class="stress-stat">
                <span class="stress-label">触发计划数</span>
                <b>{{ item.plans_triggered || 0 }}</b>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty" style="padding:24px">
          <p>点击上方“压力测试”模拟极端行情下的策略表现。</p>
        </div>
      </div>
    </template>

    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="删除策略"
      :message="`确定要删除策略「${strategy.name || ''}」吗？相关的操盘计划也会被删除。`"
      confirm-text="删除"
      :loading="deleting"
      @confirm="doDelete"
    />

    <AppDrawer v-model="showAIRegenerate" title="✨ AI 重新生成策略">
      <AIStrategyGenerator :preset-asset-id="strategy.asset_id" :existing-strategy-id="strategy.id" @done="onAIRegenDone" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import AppDrawer from '../components/AppDrawer.vue'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loading = ref(true)
const strategy = ref({})
const plans = ref([])
const backtestResults = ref([])
const stressResults = ref([])
const generating = ref(false)
const backtesting = ref(false)
const stressTesting = ref(false)
const backtestLoading = ref(false)
const stressLoading = ref(false)
const showDeleteConfirm = ref(false)
const showActions = ref(false)
const showAIRegenerate = ref(false)
const deleting = ref(false)

const parsedParams = computed(() => {
  try { return JSON.parse(strategy.value.parameters || '{}') } catch { return null }
})
const latestBacktest = computed(() => backtestResults.value[0] || null)

function safeParse(value, fallback) {
  try { return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback) } catch { return fallback }
}
function normalizeBacktest(row) {
  return { ...row, details: Array.isArray(row?.details) ? row.details : safeParse(row?.details, []) }
}

async function loadData() {
  loading.value = true
  try {
    const [res, pres, bres] = await Promise.all([
      api(`/api/strategies/${route.params.id}`),
      api(`/api/plans?strategy_id=${route.params.id}`),
      api(`/api/strategies/${route.params.id}/backtest-results`),
    ])
    const json = await res.json()
    const pjson = await pres.json()
    const bjson = await bres.json()
    if (json.data) strategy.value = json.data
    plans.value = pjson.data || []
    backtestResults.value = (bjson.data || []).map(normalizeBacktest)
    stressResults.value = []
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function generatePlan() {
  generating.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/generate-plan`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      plans.value = json.data || []
      backtestResults.value = []
      stressResults.value = []
      toast.success('计划已生成')
    } else toast.error('生成失败: ' + json.error)
  } catch (e) {
    toast.error(e.message)
  }
  generating.value = false
}

async function runBacktestAction() {
  backtesting.value = true
  backtestLoading.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/backtest`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      const result = normalizeBacktest(json.data)
      backtestResults.value = [result, ...backtestResults.value.filter(item => item.id !== result.id)]
      toast.success('回测完成')
    } else {
      toast.error(json.error || '回测失败')
    }
  } catch (e) {
    toast.error(e.message)
  }
  backtesting.value = false
  backtestLoading.value = false
}

async function runStressTestAction() {
  stressTesting.value = true
  stressLoading.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/stress-test`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      stressResults.value = json.data || []
      toast.success('压力测试完成')
    } else {
      toast.error(json.error || '压力测试失败')
    }
  } catch (e) {
    toast.error(e.message)
  }
  stressTesting.value = false
  stressLoading.value = false
}

async function doDelete() {
  deleting.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      toast.success('策略已删除')
      router.push('/strategies')
    } else toast.error(json.error || '删除失败')
  } catch (e) {
    toast.error(e.message)
  }
  deleting.value = false
  showDeleteConfirm.value = false
}

function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏', trend:'趋势', rebalance:'再平衡' }[t] || t }
function statusLabel(s) { return { draft:'草稿', active:'活跃', paused:'暂停', closed:'关闭' }[s] || s }
function triggerLabel(t) { return { price_above:'价格 ≥', price_below:'价格 ≤', time:'时间' }[t] || t }
function planStatusLabel(s) { return { pending:'等待', triggered:'⚡触发', executed:'已执行', cancelled:'取消' }[s] || s }
function planStatusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }
function fmtNumber(n, digits = 2) { return Number.isFinite(Number(n)) ? Number(n).toFixed(digits) : '-' }
function fmtMoney(n) { return Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString() : '-' }
function fmtPct(n) { return Number.isFinite(Number(n)) ? `${Number(n).toFixed(2)}%` : '-' }
function fmtSignedPct(n) { return Number.isFinite(Number(n)) ? `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(2)}%` : '-' }
function scenarioLabel(item) {
  return item?.scenario_label || ({ crash_30:'暴跌 30%', crash_50:'暴跌 50%', slow_bleed:'阴跌 20%', sideways:'震荡行情', recovery_v:'V 型反弹', bull_run:'牛市上涨' }[item?.scenario_name] || item?.scenario_name || '-')
}
function stressCardClass(value) {
  const pct = Number(value)
  if (!Number.isFinite(pct)) return 'neutral'
  return pct > 0 ? 'positive' : (pct < 0 ? 'negative' : 'neutral')
}
function fmtDate(value) { return value ? String(value).slice(0, 10) : '-' }
function fmtDateTime(value) { return value ? String(value).slice(0, 16).replace('T', ' ') : '-' }

function onAIRegenDone() {
  showAIRegenerate.value = false
  toast.success('策略已更新')
  loadData()
}

onMounted(loadData)
</script>

<style scoped>
.page-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hide-on-mobile { display: flex; gap: 8px; flex-wrap: wrap; }
.show-on-mobile { display: none; }
.info-list { font-size: 14px; }
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }

.line-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  margin: 2px 4px 2px 0;
}
.line-tag.buy { background: rgba(34,197,94,0.1); color: var(--green); }
.line-tag.sell { background: rgba(239,68,68,0.1); color: var(--red); }

.hide-mobile { display: table; }
.show-mobile { display: none !important; }

.plan-cards { flex-direction: column; gap: 8px; }
.plan-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}
.plan-card-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.plan-card-price { font-size: 14px; margin-bottom: 4px; }
.plan-card-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-dim); flex-wrap: wrap; }

.backtest-loading {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.backtest-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.backtest-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.trade-log {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.trade-log summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--text-dim);
}
.trade-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.trade-log-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
}
.trade-log-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.trade-log-time { font-size: 12px; color: var(--text-muted); }
.trade-log-body {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--text-dim);
}
.stress-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.stress-card {
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 12px;
  padding: 14px;
  background: var(--bg);
}
.stress-card.positive { border-left-color: var(--green); }
.stress-card.negative { border-left-color: var(--red); }
.stress-card.neutral { border-left-color: #f59e0b; }
.stress-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
.stress-title { font-size: 14px; font-weight: 700; }
.stress-stats {
  display: grid;
  gap: 8px;
}
.stress-stat {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.stress-label { color: var(--text-muted); }

@media (max-width: 900px) {
  .backtest-loading, .backtest-stats, .stress-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .hide-on-mobile { display: none !important; }
  .show-on-mobile { display: flex !important; }
  .backtest-loading, .backtest-stats, .stress-grid { grid-template-columns: 1fr; }
  .trade-log-top, .backtest-meta, .info-row, .stress-head, .stress-stat { align-items: flex-start; }
}
</style>
