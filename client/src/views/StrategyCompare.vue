<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('strategyCompare.title') }}</h1>
      <div class="page-header-right">
        <div class="page-header-actions">
          <router-link to="/strategies" class="btn">{{ t('strategyCompare.back') }}</router-link>
        </div>
      </div>
    </div>

    <div v-if="assetsLoading" class="card">
      <div class="skeleton-card" v-for="i in 4" :key="i" style="margin-bottom:10px">
        <div class="skeleton skeleton-text" style="width:120px;margin-bottom:10px"></div>
        <div class="skeleton skeleton-text" style="width:100%"></div>
      </div>
    </div>

    <template v-else>
      <div class="card">
        <div class="section-title">{{ t('strategyCompare.config') }}</div>

        <div class="form-group">
          <label class="form-label">{{ t('strategyForm.relatedAssets') }} *</label>
          <div class="asset-multi-select">
            <div v-for="a in assets" :key="a.id" class="asset-chip" :class="{ selected: selectedAssetIds.includes(a.id) }" @click="toggleAsset(a.id)">
              {{ a.icon }} {{ a.name }}
            </div>
          </div>
          <div v-if="selectedAssetIds.length" class="selected-count">{{ t('strategyCompare.selectedCount', { count: selectedAssetIds.length }) }}</div>
          <div v-if="selectedAssetIds.length" class="context-status" :class="{ loading: assetContextLoading, error: !!assetContextError, ready: assetContextReady }">
            <span v-if="assetContextLoading">{{ t('strategyCompare.contextLoading') }}</span>
            <span v-else-if="assetContextError">{{ assetContextError }}</span>
            <span v-else-if="assetContextReady">{{ t('strategyCompare.contextReady') }}</span>
            <button v-if="assetContextError && !assetContextLoading" class="btn btn-sm" type="button" @click="loadAssetInfo">{{ t('common.refresh') }}</button>
          </div>
        </div>

        <div v-if="holdingSummaries.length" class="holding-summary">
          <div v-for="s in holdingSummaries" :key="s.asset_id" class="holding-summary-item">
            <div class="summary-asset-name">{{ s.name }}</div>
            <div class="summary-row"><span>{{ t('strategyCompare.holdingQuantity') }}</span><b>{{ s.quantity }}</b></div>
            <div class="summary-row"><span>{{ t('strategyCompare.avgCost') }}</span><b>¥{{ fmt(s.avg_cost) }}</b></div>
            <div class="summary-row"><span>{{ t('strategyCompare.totalInvested') }}</span><b>¥{{ fmt(s.total_invested) }}</b></div>
            <div class="summary-row" v-if="s.pnl_pct !== null">
              <span>{{ t('strategyCompare.floatingPnl') }}</span>
              <b :class="s.pnl_pct >= 0 ? 'pnl positive' : 'pnl negative'">{{ s.pnl_pct >= 0 ? '+' : '' }}{{ s.pnl_pct }}%</b>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('strategyCompare.budget') }} (¥)</label>
            <input class="form-input" type="number" v-model="form.budget" placeholder="20000" inputmode="numeric" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('strategyCompare.goal') }}</label>
            <select class="form-select" v-model="form.goal">
              <option value="recovery">💉 {{ t('strategyCompare.goals.recovery') }}</option>
              <option value="growth">📈 {{ t('strategyCompare.goals.growth') }}</option>
              <option value="balanced">⚖️ {{ t('strategyCompare.goals.balanced') }}</option>
              <option value="trend">📊 {{ t('strategyCompare.goals.trend') }}</option>
              <option value="rebalance">⚖️ {{ t('strategyCompare.goals.rebalance') }}</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary" style="width:100%" @click="generateCompare" :disabled="!canGenerateCompare">
          {{ comparing ? t('strategyCompare.generating') : t('strategyCompare.generate') }}
        </button>
      </div>

      <div class="card">
        <div class="section-title">{{ t('strategyCompare.compare') }}</div>

        <div v-if="comparing" class="compare-grid">
          <div class="compare-card" v-for="i in 3" :key="i">
            <div class="skeleton skeleton-text" style="width:110px;margin-bottom:12px"></div>
            <div class="skeleton skeleton-badge" style="width:72px;margin-bottom:12px"></div>
            <div class="skeleton skeleton-text" style="width:100%;margin-bottom:8px"></div>
            <div class="skeleton skeleton-text short" style="margin-bottom:16px"></div>
            <div class="skeleton skeleton-text" v-for="j in 4" :key="j" style="width:100%;margin-bottom:8px"></div>
          </div>
        </div>

        <div v-else-if="compareResults.length" class="compare-grid">
          <div v-for="item in compareResults" :key="item.risk_level" class="compare-card" :class="{ recommended: item.risk_level === recommendedRiskLevel, failed: !item.success }">
            <div class="compare-card-head">
              <div>
                <div class="compare-title">{{ item.success ? (item.strategy?.name || item.label) : item.label }}</div>
                <div class="compare-badges">
                  <span class="badge" :class="riskBadge(item.risk_level)">{{ item.label }}</span>
                  <span v-if="item.risk_level === recommendedRiskLevel && item.success" class="badge badge-buy">{{ t('strategyCompare.recommended') }}</span>
                </div>
              </div>
              <div class="compare-risk">{{ riskLabel(item.risk_level) }}</div>
            </div>

            <div v-if="!item.success" class="alert" style="margin:0">{{ item.error || t('strategyCompare.generateFailed') }}</div>

            <template v-else>
              <p class="compare-description">{{ item.strategy?.description || t('strategyCompare.noDescription') }}</p>

              <div class="metric-grid">
                <div class="metric-box">
                  <div class="metric-label">{{ t('strategyCompare.riskLevel') }}</div>
                  <div class="metric-value">{{ riskLabel(item.risk_level) }}</div>
                </div>
                <div class="metric-box">
                  <div class="metric-label">{{ t('strategyCompare.budgetUsage') }}</div>
                  <div class="metric-value">¥{{ fmt(item.meta?.budget_usage) }}</div>
                </div>
                <div class="metric-box">
                  <div class="metric-label">{{ t('strategyCompare.planCount') }}</div>
                  <div class="metric-value">{{ item.meta?.plan_count || 0 }}</div>
                </div>
              </div>

              <div class="compare-section">
                <div class="compare-section-title">{{ t('strategyCompare.strategyInfo') }}</div>
                <div class="mini-row"><span>{{ t('strategyCompare.type') }}</span><span class="badge badge-buy">{{ typeLabel(item.strategy?.type) }}</span></div>
                <div class="mini-row"><span>{{ t('strategyCompare.goal') }}</span><span>{{ goalLabel(form.goal) }}</span></div>
                <div class="mini-row"><span>{{ t('strategyCompare.model') }}</span><span>{{ item.meta?.model || '-' }}</span></div>
              </div>

              <div v-if="item.reasoning" class="compare-section">
                <div class="compare-section-title">{{ t('strategyCompare.reasoning') }}</div>
                <p class="compare-text">{{ item.reasoning }}</p>
              </div>

              <div class="compare-section">
                <div class="compare-section-title">{{ t('strategyCompare.preview') }}</div>
                <div v-if="item.plans?.length" class="plan-preview-list">
                  <div v-for="plan in item.plans.slice(0, 5)" :key="`${item.risk_level}-${plan.seq}`" class="plan-preview-item">
                    <span class="badge" :class="plan.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ plan.action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span>
                    <span>{{ triggerLabel(plan.trigger_type) }} {{ plan.trigger_value }}</span>
                    <span style="margin-left:auto;color:var(--text-dim)">{{ plan.amount ? `¥${fmt(plan.amount)}` : (plan.quantity || '-') }}</span>
                  </div>
                </div>
                <div v-else class="empty-inline">{{ t('strategyCompare.noPlans') }}</div>
              </div>

              <button class="btn btn-primary" style="width:100%;margin-top:16px" @click="adoptStrategy(item)" :disabled="savingRiskLevel === item.risk_level">
                {{ savingRiskLevel === item.risk_level ? t('strategyCompare.saving') : t('strategyCompare.adopt') }}
              </button>
            </template>
          </div>
        </div>

        <div v-else class="empty" style="padding:20px 0">
          <p>{{ t('strategyCompare.empty') }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { formatNumber } from '../utils/formatters.js'

const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const assetsLoading = ref(true)
const comparing = ref(false)
const assets = ref([])
const holdingSummaries = ref([])
const selectedAssetIds = ref([])
const compareResults = ref([])
const recommendedRiskLevel = ref(null)
const savingRiskLevel = ref('')
const assetContextLoading = ref(false)
const assetContextReady = ref(false)
const assetContextError = ref('')
let assetContextRequestId = 0
const form = reactive({
  budget: 20000,
  goal: 'recovery',
})
const canGenerateCompare = computed(() => (
  !comparing.value &&
  selectedAssetIds.value.length > 0 &&
  assetContextReady.value &&
  !assetContextLoading.value &&
  !assetContextError.value
))

function fmt(n) {
  const value = Number(n)
  return Number.isFinite(value) ? formatNumber(Math.round(value)) : '0'
}
function riskLabel(level) { return t(`strategyCompare.risks.${level}`) }
function goalLabel(goal) { return t(`strategyCompare.goals.${goal}`) }
function typeLabel(type) { return type ? t(`strategyCompare.strategyTypes.${type}`) : '-' }
function triggerLabel(type) {
  return {
    price_above: t('aiStrategyGenerator.triggers.priceAbove'),
    price_below: t('aiStrategyGenerator.triggers.priceBelow'),
    time: t('strategyCompare.triggerTime'),
  }[type] || type
}
function riskBadge(level) { return { low: 'badge-buy', medium: 'badge-executed', high: 'badge-sell' }[level] || 'badge-pending' }

function toggleAsset(id) {
  const idx = selectedAssetIds.value.indexOf(id)
  if (idx >= 0) selectedAssetIds.value.splice(idx, 1)
  else selectedAssetIds.value.push(id)
  loadAssetInfo()
}

async function loadAssets() {
  assetsLoading.value = true
  try {
    const res = await api('/api/assets')
    const json = await res.json()
    assets.value = json.data || []
  } catch (e) {
    toast.error(e.message)
  } finally {
    assetsLoading.value = false
  }
}

async function loadAssetInfo() {
  const requestId = ++assetContextRequestId
  const selectedIds = [...selectedAssetIds.value]
  holdingSummaries.value = []
  assetContextError.value = ''
  assetContextReady.value = false
  if (!selectedIds.length) {
    assetContextLoading.value = false
    return
  }
  assetContextLoading.value = true
  const summaries = []
  const failedIds = []
  await Promise.all(selectedIds.map(async (assetId) => {
    try {
      const [assetRes, priceRes] = await Promise.all([
        api(`/api/assets/${assetId}`),
        api(`/api/market/prices/${assetId}`),
      ])
      const assetJson = await assetRes.json()
      const priceJson = await priceRes.json()
      if (assetJson.data) {
        const h = assetJson.data
        const asset = assets.value.find(a => a.id === assetId)
        const price = priceJson.data?.price
        const pnlPct = price && h.avg_cost ? ((price - h.avg_cost) / h.avg_cost * 100).toFixed(1) : null
        if (h.quantity) {
          summaries.push({
            asset_id: assetId,
            name: asset?.name || `Asset #${assetId}`,
            quantity: h.quantity,
            avg_cost: h.avg_cost,
            total_invested: h.total_invested,
            pnl_pct: pnlPct ? Number(pnlPct) : null,
          })
        }
      } else {
        failedIds.push(assetId)
      }
    } catch {
      failedIds.push(assetId)
    }
  }))
  if (requestId !== assetContextRequestId) return
  holdingSummaries.value = summaries
  assetContextLoading.value = false
  if (failedIds.length) {
    assetContextError.value = t('strategyCompare.contextLoadFailed', { count: failedIds.length })
    assetContextReady.value = false
  } else {
    assetContextReady.value = selectedIds.length > 0
  }
}

async function generateCompare() {
  if (!canGenerateCompare.value) return
  comparing.value = true
  compareResults.value = []
  recommendedRiskLevel.value = null
  try {
    const res = await api('/api/strategies/ai-compare', {
      method: 'POST',
      body: JSON.stringify({
        asset_ids: selectedAssetIds.value,
        budget: form.budget,
        goal: form.goal,
      }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('strategyCompare.generateFailed'))
    compareResults.value = json.data?.comparisons || []
    recommendedRiskLevel.value = json.data?.recommended_risk_level || null
    toast.success(t('strategyCompare.generated'))
  } catch (e) {
    toast.error(e.message)
  } finally {
    comparing.value = false
  }
}

async function adoptStrategy(item) {
  if (!item?.success) return
  savingRiskLevel.value = item.risk_level
  try {
    const res = await api('/api/strategies/ai-confirm', {
      method: 'POST',
      body: JSON.stringify({
        asset_ids: selectedAssetIds.value,
        strategy: item.strategy,
        plans: item.plans,
        generation_id: item.generation_id,
      }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('common.saveFailed'))
    toast.success(t('strategyCompare.saved'))
    router.push(`/strategies/${json.data.strategyId}`)
  } catch (e) {
    toast.error(e.message)
  } finally {
    savingRiskLevel.value = ''
  }
}

onMounted(loadAssets)
</script>

<style scoped>
.asset-multi-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.asset-chip {
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.asset-chip:hover { border-color: var(--primary); }
.asset-chip.selected {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.selected-count {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-dim);
}
.context-status {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.context-status.loading { color: var(--text-dim); }
.context-status.ready { color: var(--green); }
.context-status.error { color: var(--red); }
.holding-summary {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}
.holding-summary-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.holding-summary-item:last-child { border-bottom: none; }
.summary-asset-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--primary);
}
.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 13px;
}
.summary-row span:first-child { color: var(--text-dim); }
.compare-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.compare-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: var(--bg);
}
.compare-card.recommended { border-color: rgba(34, 197, 94, 0.55); box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.2); }
.compare-card.failed { border-color: rgba(239, 68, 68, 0.35); }
.compare-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.compare-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 6px;
}
.compare-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.compare-risk {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
.compare-description {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.7;
  min-height: 44px;
  margin-bottom: 14px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}
.metric-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: var(--bg-card);
}
.metric-label {
  color: var(--text-muted);
  font-size: 12px;
  margin-bottom: 4px;
}
.metric-value {
  font-size: 15px;
  font-weight: 700;
}
.compare-section {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-top: 12px;
}
.compare-section-title {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.compare-text {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.7;
}
.mini-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  padding: 4px 0;
}
.plan-preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.plan-preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
}
.empty-inline {
  font-size: 12px;
  color: var(--text-muted);
}
@media (max-width: 960px) {
  .compare-grid { grid-template-columns: 1fr; }
  .metric-grid { grid-template-columns: 1fr 1fr 1fr; }
}
@media (max-width: 768px) {
  .form-row { flex-direction: column; }
  .metric-grid { grid-template-columns: 1fr; }
  .compare-card-head, .mini-row, .summary-row { align-items: flex-start; }
}
</style>
