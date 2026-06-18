<template>
  <PullRefreshView :onRefresh="refreshPage">
    <div>
      <div class="page-header">
        <h1 class="page-title">{{ t('strategyList.title') }}</h1>
        <div class="page-header-right desktop-only">
          <div class="page-header-actions page-actions">
            <button v-if="drafts.length" class="btn btn-draft btn-inline-icon" @click="showDrafts = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
                <path d="M9 3h6v4H9z" />
                <path d="M9 12h6" />
                <path d="M9 16h4" />
              </svg>
              <span>{{ t('strategyList.drafts') }}</span>
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
              <span>{{ t('strategyList.compare') }}</span>
            </router-link>
            <button class="btn btn-primary" @click="showAI = true">{{ t('strategyList.aiGenerate') }}</button>
            <button class="btn" @click="showCreateDrawer = true">+ {{ t('strategyList.create') }}</button>
          </div>
        </div>
      </div>

    <div class="card" v-if="strategies.length">
      <table class="hide-mobile">
        <thead><tr><th>{{ t('strategyList.name') }}</th><th>{{ t('strategyList.relatedAssets') }}</th><th>{{ t('strategyList.type') }}</th><th>{{ t('strategyList.status') }}</th><th>{{ t('strategyList.createdAt') }}</th></tr></thead>
        <tbody>
          <tr v-for="s in strategies" :key="s.id" style="cursor:pointer" @click="openDetail(s)">
            <td style="font-weight:600">{{ s.name }}</td>
            <td>{{ assetDisplay(s) }}</td>
            <td><span class="badge badge-buy">{{ typeLabel(s.type) }}</span></td>
            <td><span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span></td>
            <td style="color:var(--text-muted)">{{ fmtDate(s.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile strategy-cards">
        <SwipeActionItem v-for="s in strategies" :key="s.id" :actionWidth="148">
          <div class="strategy-card" @click="openDetail(s)">
            <div class="strategy-card-header">
              <span style="font-weight:600">{{ s.name }}</span>
              <span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span>
            </div>
            <div class="strategy-card-body">
              <span>{{ assetDisplay(s) }}</span>
              <span class="badge badge-buy">{{ typeLabel(s.type) }}</span>
              <span style="color:var(--text-muted);font-size:12px">{{ fmtDate(s.created_at) }}</span>
            </div>
          </div>
          <template #actions>
            <router-link class="swipe-action-btn" :to="`/strategies/${s.id}/edit`">
              {{ t('strategyList.edit') }}
            </router-link>
            <button class="swipe-action-btn danger" @click="deleteStrategy(s)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              {{ t('common.delete') }}
            </button>
          </template>
        </SwipeActionItem>
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
      <div class="empty-icon"><AppIcon name="strategies" size="34" /></div><p>{{ t('strategyList.emptyPrefix') }}<a href="#" @click.prevent="showCreateDrawer = true">{{ t('strategyList.createOne') }}</a> {{ t('strategyList.emptyMiddle') }} <a href="#" @click.prevent="showAI = true">{{ t('strategyList.aiGenerateLink') }}</a></p>
    </div>

    <!-- Create Drawer -->
    <AppDrawer v-model="showCreateDrawer" :title="t('strategyForm.createTitle')" width="860px" mobileHeight="fullscreen">
      <StrategyForm v-if="showCreateDrawer" embedded @saved="onStrategyCreated" @cancel="showCreateDrawer = false" />
    </AppDrawer>

    <!-- AI Drawer -->
    <AppDrawer v-model="showAI" :title="t('strategyList.aiDrawerTitle')">
      <AIStrategyGenerator @done="onAIDone" @generated="onAIGenerated" />
    </AppDrawer>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetailDrawer" :title="detailStrategy?.name || t('strategyList.detailTitle')" mobileHeight="fixed">
      <div v-if="detailStrategy" class="detail-drawer-content">
        <!-- Tabs: 详情 / 生成历史 -->
        <div class="drawer-tabs">
          <button class="drawer-tab" :class="{ active: detailTab === 'info' }" @click="detailTab = 'info'">{{ t('strategyList.info') }}</button>
          <button class="drawer-tab" :class="{ active: detailTab === 'history' }" @click="detailTab = 'history'; loadGenerationHistory()">{{ t('strategyList.generationHistory') }}</button>
        </div>

        <template v-if="detailTab === 'info'">
          <div class="detail-section">
            <div class="detail-row"><span>{{ t('strategyList.type') }}</span><span class="badge badge-buy">{{ typeLabel(detailStrategy.type) }}</span></div>
            <div class="detail-row"><span>{{ t('strategyList.relatedAssets') }}</span><span>{{ assetDisplay(detailStrategy) }}</span></div>
            <div class="detail-row"><span>{{ t('strategyList.status') }}</span><span class="badge" :class="statusBadge(detailStrategy.status)">{{ statusLabel(detailStrategy.status) }}</span></div>
            <div class="detail-row"><span>{{ t('strategyList.createdAt') }}</span><span style="color:var(--text-dim)">{{ fmtDate(detailStrategy.created_at) }}</span></div>
            <div class="detail-row" v-if="detailStrategy.description"><span>{{ t('strategyList.description') }}</span><span style="color:var(--text-dim);font-size:13px">{{ detailStrategy.description }}</span></div>
          </div>

          <div v-if="detailPlans.length" class="detail-section">
            <div class="detail-section-title">{{ t('strategyList.plansTitle', { count: detailPlans.length }) }}</div>
            <div v-for="p in detailPlans" :key="p.id" class="plan-mini">
              <span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'" style="font-size:11px">{{ p.action==='buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span>
              <span>{{ triggerLabel(p.trigger_type) }} {{ p.trigger_value }}</span>
              <span v-if="p.amount" style="color:var(--text-dim)">{{ money(p.amount, p.asset_currency) }}</span>
              <span class="badge" :class="planStatusBadge(p.status)" style="font-size:10px;margin-left:auto">{{ planStatusLabel(p.status) }}</span>
            </div>
          </div>
          <div v-else class="detail-section" style="padding:12px 14px;color:var(--text-dim);font-size:13px">
            {{ t('strategyList.noPlans') }}
          </div>

          <div class="detail-actions">
            <router-link :to="`/strategies/${detailStrategy.id}`" class="btn btn-primary" style="flex:1;text-align:center" @click="showDetailDrawer = false">{{ t('strategyList.viewFullDetail') }}</router-link>
            <router-link :to="`/strategies/${detailStrategy.id}/edit`" class="btn" style="flex:1;text-align:center" @click="showDetailDrawer = false">{{ t('strategyList.edit') }}</router-link>
          </div>
        </template>

        <!-- Generation History Tab -->
        <template v-if="detailTab === 'history'">
          <div v-if="generationHistory.length === 0" class="detail-section" style="padding:16px 14px;color:var(--text-dim);font-size:13px;text-align:center">
            {{ t('strategyList.noGenerationHistory') }}
          </div>
          <div v-else class="history-list">
            <div v-for="h in generationHistory" :key="h.id" class="history-item" @click="viewHistoryDetail(h)">
              <div class="history-item-header">
                <span class="history-name">{{ h.strategy_name || t('strategyList.generatedStrategy') }}</span>
                <span class="badge" :class="h.status === 'adopted' ? 'badge-buy' : h.status === 'discarded' ? 'badge-sell' : 'badge-pending'">
                  {{ historyStatusLabel(h.status) }}
                </span>
              </div>
              <div class="history-item-meta">
                <span>{{ goalLabel(h.goal) }} · {{ riskLabel(h.risk_level) }}</span>
                <span>{{ fmtDateTime(h.created_at) }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </AppDrawer>

    <!-- Drafts Drawer -->
    <AppDrawer v-model="showDrafts" :title="t('strategyList.draftsTitle')">
      <div class="drafts-list">
        <div v-for="d in drafts" :key="d.id" class="draft-item">
          <div class="draft-item-header">
            <span class="draft-name">{{ d.strategy_name || t('strategyList.unnamedStrategy') }}</span>
            <span style="font-size:11px;color:var(--text-dim)">{{ fmtDateTime(d.created_at) }}</span>
          </div>
          <div class="draft-item-meta">
            <span>{{ goalLabel(d.goal) }} · {{ money(d.budget, BASE_BUDGET_CURRENCY) }} · {{ riskLabel(d.risk_level) }}</span>
            <span v-if="d.elapsed_ms">{{ (d.elapsed_ms / 1000).toFixed(1) }}s</span>
          </div>
          <div class="draft-item-actions">
            <button class="btn btn-primary btn-sm" @click="adoptDraft(d)">{{ t('strategyList.adopt') }}</button>
            <button class="btn btn-sm" @click="viewDraftDetail(d)">{{ t('strategyList.view') }}</button>
            <button class="btn btn-sm btn-danger" @click="discardDraft(d)">{{ t('strategyList.discard') }}</button>
          </div>
        </div>
        <div v-if="!drafts.length" style="text-align:center;color:var(--text-dim);padding:20px">
          {{ t('strategyList.noDrafts') }}
        </div>
      </div>
    </AppDrawer>

    <!-- History Detail Drawer -->
    <AppDrawer v-model="showHistoryDetail" :title="historyDetail?.strategy_name || t('strategyList.historyDetailTitle')">
      <div v-if="historyDetail" class="detail-drawer-content">
        <div class="detail-section">
          <div class="detail-row"><span>{{ t('strategyList.goal') }}</span><span>{{ goalLabel(historyDetail.goal) }}</span></div>
          <div class="detail-row"><span>{{ t('strategyList.risk') }}</span><span>{{ riskLabel(historyDetail.risk_level) }}</span></div>
          <div class="detail-row"><span>{{ t('strategyList.budget') }}</span><span>{{ money(historyDetail.budget, BASE_BUDGET_CURRENCY) }}</span></div>
          <div class="detail-row"><span>{{ t('strategyList.model') }}</span><span style="color:var(--text-dim)">{{ historyDetail.model }}</span></div>
          <div class="detail-row"><span>{{ t('strategyList.elapsed') }}</span><span style="color:var(--text-dim)">{{ (historyDetail.elapsed_ms / 1000).toFixed(1) }}s</span></div>
        </div>
        <div v-if="historyDetail.reasoning" class="detail-section" style="padding:12px 14px">
          <div class="detail-section-title" style="padding:0 0 6px 0">{{ t('strategyList.reasoning') }}</div>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin:0">{{ historyDetail.reasoning }}</p>
        </div>
        <div v-if="historyDetail.analysis?.market_assessment" class="detail-section" style="padding:12px 14px">
          <div class="detail-section-title" style="padding:0 0 6px 0">{{ t('strategyList.marketAssessment') }}</div>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin:0">{{ historyDetail.analysis.market_assessment }}</p>
        </div>
      </div>
    </AppDrawer>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { useConfirm } from '../utils/confirm.js'
import { formatCurrencyAmount } from '../utils/currency.js'
import { formatDate, formatDateTime } from '../utils/formatters.js'
import AppDrawer from '../components/AppDrawer.vue'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'
import StrategyForm from './StrategyForm.vue'
import PullRefreshView from '../components/PullRefreshView.vue'
import SwipeActionItem from '../components/SwipeActionItem.vue'
import AppIcon from '../components/AppIcon.vue'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'

const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const strategies = ref([])
const drafts = ref([])
const loading = ref(true)
const showAI = ref(false)
const showCreateDrawer = ref(false)
const showDrafts = ref(false)
const showDetailDrawer = ref(false)
const showHistoryDetail = ref(false)
const detailStrategy = ref(null)
const detailPlans = ref([])
const detailTab = ref('info')
const generationHistory = ref([])
const historyDetail = ref(null)
const mobilePageActions = useMobilePageActions()
const BASE_BUDGET_CURRENCY = 'CNY'

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

async function refreshPage() {
  await Promise.all([loadData(), loadDrafts()])
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
    const res = await api(`/api/strategies/generation-logs?strategy_id=${detailStrategy.value.id}`)
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
      toast.success(t('strategyList.adoptedSuccess'))
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
      toast.success(t('strategyList.discardedSuccess'))
      loadDrafts()
    } else {
      toast.error(json.error)
    }
  } catch (e) { toast.error(e.message) }
}

function onAIDone() { showAI.value = false; loadData(); loadDrafts() }
function onAIGenerated() { loadDrafts() }
function onStrategyCreated() { showCreateDrawer.value = false; loadData() }

async function deleteStrategy(s) {
  const ok = await confirm({
    title: t('strategyList.deleteTitle'),
    message: t('strategyList.deleteMessage', { name: s.name }),
    confirmText: t('common.delete'),
    icon: 'delete',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await api(`/api/strategies/${s.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    toast.success(t('strategyList.deleted'))
    loadData()
  } catch (e) {
    toast.error(e.message || t('history.deleteFailed'))
  }
}
function fmtDate(value) { return formatDate(value) }
function fmtDateTime(value) { return formatDateTime(value, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function goalLabel(goal) { return goal ? t(`strategyCompare.goals.${goal}`) : '-' }
function riskLabel(level) { return level ? t(`strategyCompare.risks.${level}`) : '-' }
function historyStatusLabel(status) { return status ? t(`strategyList.historyStatuses.${status}`) : '-' }
function typeLabel(type) { return type ? t(`strategyCompare.strategyTypes.${type}`) : '-' }
function statusLabel(status) { return status ? t(`strategyList.statuses.${status}`) : status }
function statusBadge(s) { return { draft:'badge-pending', active:'badge-buy', paused:'badge-pending', closed:'badge-sell' }[s] || '' }
function triggerLabel(type) { return { price_above:'≥', price_below:'≤', time:t('strategyCompare.triggerTime') }[type] || type }
function planStatusLabel(status) { return status ? t(`strategyList.planStatuses.${status}`) : status }
function planStatusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }
function money(value, currency) { return formatCurrencyAmount(value, currency, { maximumFractionDigits: 0 }) }
function assetDisplay(s) {
  if (s.assets && s.assets.length > 1) {
    return s.assets.map(a => a.name).join('、')
  }
  return s.asset_name || '-'
}

watchEffect(() => {
  mobilePageActions.setActions([
    drafts.value.length ? {
      key: 'drafts',
      label: `${t('strategyList.drafts')} (${drafts.value.length})`,
      onSelect: () => { showDrafts.value = true },
    } : null,
    {
      key: 'compare',
      label: t('strategyList.compare'),
      to: '/strategies/compare',
    },
    {
      key: 'ai-generate',
      label: t('strategyList.aiGenerateStrategy'),
      onSelect: () => { showAI.value = true },
    },
    {
      key: 'create',
      label: t('strategyList.create'),
      onSelect: () => { showCreateDrawer.value = true },
    },
  ])
})

onUnmounted(() => {
  mobilePageActions.clearActions()
})

onMounted(refreshPage)
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

/* Swipe action button */
.swipe-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1 0 74px;
  min-width: 74px;
  height: 100%;
  padding: 0 8px;
  border: none;
  border-left: 1px solid var(--swipe-action-divider);
  background: var(--swipe-action-bg);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: var(--swipe-action-text);
  font-family: inherit;
  text-decoration: none;
}
.swipe-action-btn.danger {
  background: var(--swipe-action-danger-bg);
  color: var(--swipe-action-danger-text);
}

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .page-actions .btn { font-size: 13px; padding: 6px 10px; }
  .strategy-card-body { flex-wrap: wrap; gap: 6px; }
  .detail-actions { flex-wrap: wrap; gap: 8px; }
  .detail-actions .btn { flex: 1; min-width: 0; text-align: center; }
  .plan-mini { flex-wrap: wrap; gap: 6px; }
  .draft-item-actions { flex-wrap: wrap; }
  .draft-item-actions .btn { min-height: 36px; padding: 8px 12px; }
}
</style>
