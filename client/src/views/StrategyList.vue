<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">策略管理</h1>
      <div class="page-actions">
        <button v-if="drafts.length" class="btn btn-draft btn-inline-icon" @click="showDrafts = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
            <path d="M9 3h6v4H9z" />
            <path d="M9 12h6" />
            <path d="M9 16h4" />
          </svg>
          <span>草稿</span>
          <span class="draft-badge">{{ drafts.length }}</span>
        </button>
        <router-link to="/strategies/compare" class="btn btn-inline-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 6h7" />
            <path d="M4 12h10" />
            <path d="M4 18h7" />
            <path d="M15 6l2-2 2 2" />
            <path d="M17 4v8" />
            <path d="M17 20v-8" />
            <path d="M15 18l2 2 2-2" />
          </svg>
          <span>AI 对比方案</span>
        </router-link>
        <button class="btn btn-primary" @click="showAI = true">AI 生成</button>
        <router-link to="/strategies/create" class="btn">+ 创建</router-link>
      </div>
    </div>

    <div class="card" v-if="strategies.length">
      <table class="hide-mobile">
        <thead><tr><th>名称</th><th>关联资产</th><th>类型</th><th>状态</th><th>创建时间</th></tr></thead>
        <tbody>
          <tr v-for="s in strategies" :key="s.id" style="cursor:pointer" @click="openDetail(s)">
            <td style="font-weight:600">{{ s.name }}</td>
            <td>{{ assetDisplay(s) }}</td>
            <td><span class="badge badge-buy">{{ typeLabel(s.type) }}</span></td>
            <td><span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span></td>
            <td style="color:var(--text-muted)">{{ s.created_at?.slice(0,10) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile strategy-cards">
        <div v-for="s in strategies" :key="s.id" class="strategy-card" @click="openDetail(s)">
          <div class="strategy-card-header">
            <span style="font-weight:600">{{ s.name }}</span>
            <span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span>
          </div>
          <div class="strategy-card-body">
            <span>{{ assetDisplay(s) }}</span>
            <span class="badge badge-buy">{{ typeLabel(s.type) }}</span>
            <span style="color:var(--text-muted);font-size:12px">{{ s.created_at?.slice(0,10) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="loading" class="card">
      <div class="skeleton-card" style="margin-bottom:8px" v-for="i in 3" :key="i">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="skeleton skeleton-text" style="width:120px"></div>
          <div class="skeleton skeleton-text short"></div>
          <div class="skeleton skeleton-badge" style="margin-left:auto"></div>
        </div>
      </div>
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">🎯</div><p>还没有策略，<router-link to="/strategies/create">创建一个</router-link> 或使用 <a href="#" @click.prevent="showAI = true">AI 生成</a></p>
    </div>

    <!-- AI Drawer -->
    <AppDrawer v-model="showAI" title="AI 生成策略">
      <AIStrategyGenerator @done="onAIDone" />
    </AppDrawer>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetailDrawer" :title="detailStrategy?.name || '策略详情'">
      <div v-if="detailStrategy" class="detail-drawer-content">
        <!-- Tabs: 详情 / 生成历史 -->
        <div class="drawer-tabs">
          <button class="drawer-tab" :class="{ active: detailTab === 'info' }" @click="detailTab = 'info'">详情</button>
          <button class="drawer-tab" :class="{ active: detailTab === 'history' }" @click="detailTab = 'history'; loadGenerationHistory()">生成历史</button>
        </div>

        <template v-if="detailTab === 'info'">
          <div class="detail-section">
            <div class="detail-row"><span>类型</span><span class="badge badge-buy">{{ typeLabel(detailStrategy.type) }}</span></div>
            <div class="detail-row"><span>关联资产</span><span>{{ assetDisplay(detailStrategy) }}</span></div>
            <div class="detail-row"><span>状态</span><span class="badge" :class="statusBadge(detailStrategy.status)">{{ statusLabel(detailStrategy.status) }}</span></div>
            <div class="detail-row"><span>创建时间</span><span style="color:var(--text-dim)">{{ detailStrategy.created_at?.slice(0,10) }}</span></div>
            <div class="detail-row" v-if="detailStrategy.description"><span>描述</span><span style="color:var(--text-dim);font-size:13px">{{ detailStrategy.description }}</span></div>
          </div>

          <div v-if="detailPlans.length" class="detail-section">
            <div class="detail-section-title">操盘计划 ({{ detailPlans.length }} 步)</div>
            <div v-for="p in detailPlans" :key="p.id" class="plan-mini">
              <span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'" style="font-size:11px">{{ p.action==='buy'?'买':'卖' }}</span>
              <span>{{ triggerLabel(p.trigger_type) }} {{ p.trigger_value }}</span>
              <span v-if="p.amount" style="color:var(--text-dim)">¥{{ Math.round(p.amount) }}</span>
              <span class="badge" :class="planStatusBadge(p.status)" style="font-size:10px;margin-left:auto">{{ planStatusLabel(p.status) }}</span>
            </div>
          </div>
          <div v-else class="detail-section" style="padding:12px 14px;color:var(--text-dim);font-size:13px">
            暂无操盘计划
          </div>

          <div class="detail-actions">
            <router-link :to="`/strategies/${detailStrategy.id}`" class="btn btn-primary" style="flex:1;text-align:center" @click="showDetailDrawer = false">查看完整详情</router-link>
            <router-link :to="`/strategies/${detailStrategy.id}/edit`" class="btn" style="flex:1;text-align:center" @click="showDetailDrawer = false">编辑</router-link>
          </div>
        </template>

        <!-- Generation History Tab -->
        <template v-if="detailTab === 'history'">
          <div v-if="generationHistory.length === 0" class="detail-section" style="padding:16px 14px;color:var(--text-dim);font-size:13px;text-align:center">
            暂无生成历史
          </div>
          <div v-else class="history-list">
            <div v-for="h in generationHistory" :key="h.id" class="history-item" @click="viewHistoryDetail(h)">
              <div class="history-item-header">
                <span class="history-name">{{ h.strategy_name || '策略生成' }}</span>
                <span class="badge" :class="h.status === 'adopted' ? 'badge-buy' : h.status === 'discarded' ? 'badge-sell' : 'badge-pending'">
                  {{ { draft: '草稿', adopted: '已采用', discarded: '已丢弃' }[h.status] || h.status }}
                </span>
              </div>
              <div class="history-item-meta">
                <span>{{ h.goal }} · {{ h.risk_level }}</span>
                <span>{{ h.created_at?.slice(0, 16).replace('T', ' ') }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </AppDrawer>

    <!-- Drafts Drawer -->
    <AppDrawer v-model="showDrafts" title="AI 策略草稿">
      <div class="drafts-list">
        <div v-for="d in drafts" :key="d.id" class="draft-item">
          <div class="draft-item-header">
            <span class="draft-name">{{ d.strategy_name || '未命名策略' }}</span>
            <span style="font-size:11px;color:var(--text-dim)">{{ d.created_at?.slice(0, 16).replace('T', ' ') }}</span>
          </div>
          <div class="draft-item-meta">
            <span>{{ d.goal }} · ¥{{ d.budget }} · {{ d.risk_level }}</span>
            <span v-if="d.elapsed_ms">{{ (d.elapsed_ms / 1000).toFixed(1) }}s</span>
          </div>
          <div class="draft-item-actions">
            <button class="btn btn-primary btn-sm" @click="adoptDraft(d)">采用</button>
            <button class="btn btn-sm" @click="viewDraftDetail(d)">查看</button>
            <button class="btn btn-sm btn-danger" @click="discardDraft(d)">丢弃</button>
          </div>
        </div>
        <div v-if="!drafts.length" style="text-align:center;color:var(--text-dim);padding:20px">
          暂无草稿
        </div>
      </div>
    </AppDrawer>

    <!-- History Detail Drawer -->
    <AppDrawer v-model="showHistoryDetail" :title="historyDetail?.strategy_name || '生成详情'">
      <div v-if="historyDetail" class="detail-drawer-content">
        <div class="detail-section">
          <div class="detail-row"><span>目标</span><span>{{ historyDetail.goal }}</span></div>
          <div class="detail-row"><span>风险</span><span>{{ historyDetail.risk_level }}</span></div>
          <div class="detail-row"><span>预算</span><span>¥{{ historyDetail.budget }}</span></div>
          <div class="detail-row"><span>模型</span><span style="color:var(--text-dim)">{{ historyDetail.model }}</span></div>
          <div class="detail-row"><span>耗时</span><span style="color:var(--text-dim)">{{ (historyDetail.elapsed_ms / 1000).toFixed(1) }}s</span></div>
        </div>
        <div v-if="historyDetail.reasoning" class="detail-section" style="padding:12px 14px">
          <div class="detail-section-title" style="padding:0 0 6px 0">💡 决策逻辑</div>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin:0">{{ historyDetail.reasoning }}</p>
        </div>
        <div v-if="historyDetail.analysis?.market_assessment" class="detail-section" style="padding:12px 14px">
          <div class="detail-section-title" style="padding:0 0 6px 0">📊 市场评估</div>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin:0">{{ historyDetail.analysis.market_assessment }}</p>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import AppDrawer from '../components/AppDrawer.vue'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'

const toast = useToast()
const strategies = ref([])
const drafts = ref([])
const loading = ref(true)
const showAI = ref(false)
const showDrafts = ref(false)
const showDetailDrawer = ref(false)
const showHistoryDetail = ref(false)
const detailStrategy = ref(null)
const detailPlans = ref([])
const detailTab = ref('info')
const generationHistory = ref([])
const historyDetail = ref(null)

async function loadData() {
  try {
    const res = await api('/api/strategies')
    const json = await res.json()
    strategies.value = json.data || []
  } finally {
    loading.value = false
  }
}

async function loadDrafts() {
  try {
    const res = await api('/api/strategies/drafts')
    const json = await res.json()
    drafts.value = json.data || []
  } catch { drafts.value = [] }
}

async function openDetail(s) {
  detailStrategy.value = s
  detailPlans.value = []
  detailTab.value = 'info'
  showDetailDrawer.value = true
  try {
    const res = await api(`/api/plans?strategy_id=${s.id}`)
    const json = await res.json()
    detailPlans.value = (json.data || []).slice(0, 5)
  } catch {}
}

async function loadGenerationHistory() {
  if (!detailStrategy.value) return
  try {
    const res = await api(`/api/strategies/generation-logs?asset_id=${detailStrategy.value.asset_id || ''}`)
    const json = await res.json()
    generationHistory.value = json.data || []
  } catch { generationHistory.value = [] }
}

async function viewHistoryDetail(h) {
  try {
    const res = await api(`/api/strategies/generation-logs/${h.id}`)
    const json = await res.json()
    if (json.success) {
      historyDetail.value = { ...json.data, strategy_name: h.strategy_name }
      showHistoryDetail.value = true
    }
  } catch {}
}

async function viewDraftDetail(d) {
  try {
    const res = await api(`/api/strategies/generation-logs/${d.id}`)
    const json = await res.json()
    if (json.success) {
      historyDetail.value = { ...json.data, strategy_name: d.strategy_name }
      showHistoryDetail.value = true
    }
  } catch {}
}

async function adoptDraft(d) {
  try {
    const res = await api(`/api/strategies/drafts/${d.id}/adopt`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      toast.success('策略已采用')
      loadData()
      loadDrafts()
    } else {
      toast.error(json.error)
    }
  } catch (e) { toast.error(e.message) }
}

async function discardDraft(d) {
  try {
    const res = await api(`/api/strategies/drafts/${d.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      toast.success('草稿已丢弃')
      loadDrafts()
    } else {
      toast.error(json.error)
    }
  } catch (e) { toast.error(e.message) }
}

function onAIDone() { showAI.value = false; loadData(); loadDrafts() }
function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏', trend:'趋势', rebalance:'再平衡' }[t] || t }
function statusLabel(s) { return { draft:'草稿', active:'活跃', paused:'暂停', closed:'关闭' }[s] || s }
function statusBadge(s) { return { draft:'badge-pending', active:'badge-buy', paused:'badge-pending', closed:'badge-sell' }[s] || '' }
function triggerLabel(t) { return { price_above:'≥', price_below:'≤', time:'时间' }[t] || t }
function planStatusLabel(s) { return { pending:'等待', triggered:'触发', executed:'已执行', cancelled:'取消' }[s] || s }
function planStatusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }
function assetDisplay(s) {
  if (s.assets && s.assets.length > 1) {
    return s.assets.map(a => a.name).join('、')
  }
  return s.asset_name || '-'
}
onMounted(() => { loadData(); loadDrafts() })
</script>

<style scoped>
.hide-mobile { display: table; }
.show-mobile { display: none !important; }
.btn-inline-icon { display: inline-flex; align-items: center; gap: 6px; }
.btn-inline-icon svg { width: 14px; height: 14px; flex-shrink: 0; }
.strategy-cards { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.strategy-card { display: block; border: 1px solid var(--border); border-radius: 8px; padding: 12px; cursor: pointer; color: var(--text); transition: background 0.15s; }
.strategy-card:hover { background: var(--bg-hover); }
.strategy-card:active { background: var(--bg-hover); }
.strategy-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.strategy-card-body { display: flex; align-items: center; gap: 10px; font-size: 13px; }

.detail-drawer-content { display: flex; flex-direction: column; gap: 16px; }
.detail-section { background: var(--bg); border-radius: 10px; padding: 4px 0; }
.detail-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); padding: 8px 14px 4px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 14px; }
.plan-mini { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; }
.detail-actions { display: flex; gap: 10px; margin-top: 8px; }

/* Draft button */
.btn-draft { position: relative; }
.draft-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; border-radius: 9px;
  background: var(--primary); color: #fff; font-size: 11px;
  margin-left: 4px; padding: 0 4px;
}

/* Drawer Tabs */
.drawer-tabs {
  display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 4px;
}
.drawer-tab {
  flex: 1; padding: 10px; text-align: center; font-size: 13px; font-weight: 500;
  background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--text-dim); cursor: pointer; transition: all 0.2s;
}
.drawer-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

/* History list */
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
  cursor: pointer; transition: background 0.15s;
}
.history-item:hover { background: var(--bg-hover); }
.history-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.history-name { font-weight: 600; font-size: 13px; }
.history-item-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-dim); }

/* Drafts */
.drafts-list { display: flex; flex-direction: column; gap: 12px; }
.draft-item {
  border: 1px solid var(--border); border-radius: 8px; padding: 12px;
}
.draft-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.draft-name { font-weight: 600; font-size: 14px; }
.draft-item-meta { font-size: 12px; color: var(--text-dim); margin-bottom: 8px; display: flex; justify-content: space-between; }
.draft-item-actions { display: flex; gap: 8px; }
.btn-sm { font-size: 12px; padding: 4px 10px; }
.btn-danger { color: var(--red); border-color: rgba(239,68,68,0.3); }
.btn-danger:hover { background: rgba(239,68,68,0.1); }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .page-actions .btn { font-size: 13px; padding: 6px 10px; }
}
</style>
