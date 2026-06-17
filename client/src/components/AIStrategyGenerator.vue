<template>
  <div class="ai-gen">
    <div v-if="step === 'config'">
      <div class="form-group">
        <label class="form-label">{{ t('strategyCompare.selectAssets') }} *</label>
        <div class="asset-multi-select">
          <div
            v-for="a in assets"
            :key="a.id"
            class="asset-chip"
            :class="{ selected: selectedAssetIds.includes(a.id) }"
            @click="toggleAsset(a.id)"
          >
            {{ a.icon }} {{ a.name }}
          </div>
        </div>
        <div v-if="selectedAssetIds.length > 0" class="selected-count">
          {{ t('strategyCompare.selectedCount', { count: selectedAssetIds.length }) }}
        </div>
        <div v-if="selectedAssetIds.length > 0" class="context-status" :class="{ loading: assetContextLoading, error: !!assetContextError, ready: assetContextReady }">
          <span v-if="assetContextLoading">{{ t('aiStrategyGenerator.contextLoading') }}</span>
          <span v-else-if="assetContextError">{{ assetContextError }}</span>
          <span v-else-if="assetContextReady">{{ t('aiStrategyGenerator.contextReady') }}</span>
          <button v-if="assetContextError && !assetContextLoading" class="btn btn-sm" type="button" @click="loadAssetInfo">{{ t('common.refresh') }}</button>
        </div>
      </div>

      <div v-if="holdingSummaries.length > 0" class="holding-summary">
        <div v-for="s in holdingSummaries" :key="s.asset_id" class="holding-summary-item">
          <div class="summary-asset-name">{{ s.name }}</div>
          <div class="summary-row"><span>{{ t('strategyCompare.holdingQuantity') }}</span><b>{{ s.quantity }}</b></div>
          <div class="summary-row"><span>{{ t('strategyCompare.avgCost') }}</span><b>{{ money(s.avg_cost, s.currency) }}</b></div>
          <div class="summary-row"><span>{{ t('strategyCompare.totalInvested') }}</span><b>{{ money(s.total_invested, s.currency) }}</b></div>
          <div class="summary-row" v-if="s.pnl_pct !== null">
            <span>{{ t('strategyCompare.floatingPnl') }}</span>
            <b :class="s.pnl_pct >= 0 ? 'pnl positive' : 'pnl negative'">{{ formatPercent(s.pnl_pct, 1, true) }}</b>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">{{ baseCurrencyFieldLabel(t('strategyCompare.budget')) }}</label>
        <input class="form-input" type="number" v-model="form.budget" placeholder="20000" inputmode="numeric" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ t('strategyCompare.goal') }}</label>
          <select class="form-select" v-model="form.goal">
            <option value="recovery">{{ t('strategyCompare.goals.recovery') }}</option>
            <option value="growth">{{ t('strategyCompare.goals.growth') }}</option>
            <option value="balanced">{{ t('strategyCompare.goals.balanced') }}</option>
            <option value="trend">{{ t('strategyCompare.goals.trend') }}</option>
            <option value="rebalance">{{ t('strategyCompare.goals.rebalance') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('strategyCompare.riskLevel') }}</label>
          <select class="form-select" v-model="form.risk_level">
            <option value="low">{{ t('strategyCompare.risks.low') }}</option>
            <option value="medium">{{ t('strategyCompare.risks.medium') }}</option>
            <option value="high">{{ t('strategyCompare.risks.high') }}</option>
          </select>
        </div>
      </div>

      <button class="btn btn-primary" style="width:100%;margin-top:12px" @click="generate" :disabled="!canGenerate">
        {{ generating ? t('aiStrategyGenerator.generating') : t('aiStrategyGenerator.generate') }}
      </button>

      <div v-if="error" class="gen-error">{{ error }}</div>
    </div>

    <div v-if="step === 'preview'">
      <!-- Quality & Observability Banner -->
      <div class="agent-quality-banner" v-if="evalResult || dataQualityScore != null || result.used_fallback_analysis || result.used_fallback_strategy">
        <div class="quality-row">
          <div v-if="evalResult" class="quality-item">
            <span class="quality-label">{{ t('aiStrategyGenerator.evalScore') }}</span>
            <span class="quality-score" :style="{ color: qualityGradeColor(evalResult.grade) }">
              {{ Math.round((evalResult.score || 0) * 100) }}<small>/100</small>
            </span>
            <span class="quality-grade" :style="{ background: qualityGradeColor(evalResult.grade) + '20', color: qualityGradeColor(evalResult.grade) }">
              {{ t('aiStrategyGenerator.evalGrade') }} {{ evalResult.grade }} · {{ t(`aiStrategyGenerator.grades.${evalResult.grade}`) }}
            </span>
          </div>
          <div v-if="dataQualityScore != null" class="quality-item">
            <span class="quality-label">{{ t('aiStrategyGenerator.dataQuality') }}</span>
            <div class="dq-bar-track small">
              <div class="dq-bar-fill" :style="{ width: (dataQualityScore * 100) + '%', background: dataQualityColor(dataQualityScore) }"></div>
            </div>
            <span class="dq-value" :style="{ color: dataQualityColor(dataQualityScore) }">{{ Math.round(dataQualityScore * 100) }}%</span>
          </div>
          <button v-if="evalResult" class="btn-link" @click="showQualityDetails = !showQualityDetails">
            {{ t('aiStrategyGenerator.qualityDetails') }} <AppIcon :name="showQualityDetails ? 'chevron-down' : 'chevron-right'" size="14" />
          </button>
        </div>

        <!-- Fallback analysis warning -->
        <div v-if="result.used_fallback_analysis" class="agent-warning">
          {{ t('aiStrategyGenerator.fallbackAnalysis') }}
        </div>
        <div v-if="result.used_fallback_strategy" class="agent-warning">
          {{ t('aiStrategyGenerator.fallbackStrategy') }}
        </div>

        <!-- Data quality low warning -->
        <div v-if="dataQualityScore != null && dataQualityScore < 0.4" class="agent-warning">
          <AppIcon name="warning" size="14" /> {{ t('aiStrategyGenerator.dataQualityLow') }}
        </div>

        <!-- Quality check details (collapsible) -->
        <div v-if="showQualityDetails && evalResult?.checks" class="quality-checks">
          <div v-for="c in evalResult.checks" :key="c.name" class="quality-check-row">
            <span class="check-icon" :class="c.passed ? 'passed' : 'failed'"><AppIcon :name="c.passed ? 'check' : 'x'" size="14" /></span>
            <span class="check-name">{{ c.name.replace(/_/g, ' ') }}</span>
            <span v-if="c.detail" class="check-detail">{{ c.detail }}</span>
          </div>
        </div>

        <!-- Consistency warnings (collapsible) -->
        <div v-if="result.consistency_warnings?.length" class="agent-warnings-section">
          <div class="warnings-header clickable" @click="showConsistencyWarnings = !showConsistencyWarnings">
            {{ t('aiStrategyGenerator.consistencyWarnings') }} ({{ result.consistency_warnings.length }})
            <AppIcon :name="showConsistencyWarnings ? 'chevron-down' : 'chevron-right'" size="14" />
          </div>
          <div v-if="showConsistencyWarnings" class="warnings-list">
            <div v-for="(w, i) in result.consistency_warnings" :key="i" class="warning-item"><AppIcon name="warning" size="14" /> {{ w }}</div>
          </div>
        </div>

        <!-- Fix log -->
        <div v-if="result.fix_log?.length" class="fix-log">
          <span class="fix-log-label"><AppIcon name="tool" size="14" /> {{ t('aiStrategyGenerator.fixLog') }}:</span>
          {{ result.fix_log.join(' · ') }}
        </div>

        <!-- Trace info -->
        <div v-if="result._meta?.trace_id" class="trace-info">
          <span class="trace-label">{{ t('aiStrategyGenerator.traceId') }}: #{{ result._meta.trace_id }}</span>
          <span class="trace-elapsed" v-if="result._meta?.elapsed_ms">{{ (result._meta.elapsed_ms / 1000).toFixed(1) }}s</span>
        </div>
      </div>
      <div v-if="result.analysis" class="preview-section analysis-section">
        <div class="section-title clickable" @click="showAnalysis = !showAnalysis">
          {{ t('aiStrategyGenerator.analysisReport') }}
          <AppIcon class="toggle-icon" :name="showAnalysis ? 'chevron-down' : 'chevron-right'" size="14" />
          <span v-if="result.analysis.confidence_level" class="confidence-badge">
            {{ t('aiStrategyGenerator.confidence', { value: formatRounded(result.analysis.confidence_level * 100) }) }}
          </span>
        </div>
        <div v-if="showAnalysis" class="analysis-content">
          <div class="analysis-item">
            <div class="analysis-label">{{ t('aiStrategyGenerator.marketAssessment') }}</div>
            <p>{{ result.analysis.market_assessment }}</p>
          </div>
          <div v-if="result.analysis.macro_outlook" class="analysis-item">
            <div class="analysis-label">{{ t('aiStrategyGenerator.macroOutlook') }}</div>
            <p>{{ result.analysis.macro_outlook }}</p>
          </div>
          <div v-if="result.analysis.portfolio_diagnosis" class="analysis-item">
            <div class="analysis-label">{{ t('aiStrategyGenerator.portfolioDiagnosis') }}</div>
            <p>{{ result.analysis.portfolio_diagnosis }}</p>
          </div>
          <div v-for="aa in (result.analysis.asset_analyses || [])" :key="aa.asset_name" class="analysis-item">
            <div class="analysis-label">{{ aa.asset_name }}</div>
            <div class="analysis-trend">
              <div v-if="aa.trend?.short_term"><b>{{ t('aiStrategyGenerator.shortTerm') }}:</b> {{ aa.trend.short_term }}</div>
              <div v-if="aa.trend?.medium_term"><b>{{ t('aiStrategyGenerator.mediumTerm') }}:</b> {{ aa.trend.medium_term }}</div>
              <div v-if="aa.trend?.key_support_levels?.length"><b>{{ t('aiStrategyGenerator.supportLevels') }}:</b> {{ aa.trend.key_support_levels.join(', ') }}</div>
              <div v-if="aa.trend?.key_resistance_levels?.length"><b>{{ t('aiStrategyGenerator.resistanceLevels') }}:</b> {{ aa.trend.key_resistance_levels.join(', ') }}</div>
            </div>
            <div v-if="aa.risk_factors?.length" class="analysis-list">
              <span class="list-label">{{ t('aiStrategyGenerator.riskFactors') }}:</span> {{ aa.risk_factors.join('；') }}
            </div>
            <div v-if="aa.opportunities?.length" class="analysis-list">
              <span class="list-label">{{ t('aiStrategyGenerator.opportunities') }}:</span> {{ aa.opportunities.join('；') }}
            </div>
          </div>
          <div v-if="result.analysis.data_limitations" class="analysis-item disclaimer">
            <div class="analysis-label">{{ t('aiStrategyGenerator.dataLimitations') }}</div>
            <p>{{ result.analysis.data_limitations }}</p>
          </div>
        </div>
      </div>

      <div class="preview-section">
        <div class="section-title">{{ t('aiStrategyGenerator.strategySuggestion') }}</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">{{ t('aiStrategyGenerator.name') }}</span><span>{{ result.strategy.name }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('strategyCompare.type') }}</span><span class="badge badge-buy">{{ typeLabel(result.strategy.type) }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('aiStrategyGenerator.description') }}</span><span style="color:var(--text-dim)">{{ result.strategy.description }}</span></div>
          <div class="info-row" v-if="selectedAssetIds.length > 1"><span class="info-label">{{ t('aiStrategyGenerator.portfolio') }}</span><span>{{ selectedAssetNames }}</span></div>
        </div>
      </div>

      <div v-if="result.reasoning" class="preview-section">
        <div class="section-title">{{ t('aiStrategyGenerator.reasoning') }}</div>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.6">{{ result.reasoning }}</p>
      </div>

      <div v-if="result.risk_management" class="preview-section">
        <div class="section-title">{{ t('aiStrategyGenerator.riskManagement') }}</div>
        <div class="risk-info">
          <div v-if="result.risk_management.max_loss_tolerance"><b>{{ t('aiStrategyGenerator.maxLossTolerance') }}:</b> {{ result.risk_management.max_loss_tolerance }}</div>
          <div v-if="result.risk_management.position_sizing_logic"><b>{{ t('aiStrategyGenerator.positionSizingLogic') }}:</b> {{ result.risk_management.position_sizing_logic }}</div>
          <div v-if="result.risk_management.stop_loss_triggers?.length">
            <b>{{ t('aiStrategyGenerator.stopLossTriggers') }}:</b>
            <ul><li v-for="(triggerText, i) in result.risk_management.stop_loss_triggers" :key="i">{{ triggerText }}</li></ul>
          </div>
        </div>
      </div>

      <div v-if="result.execution_notes" class="preview-section">
        <div class="section-title">{{ t('aiStrategyGenerator.executionNotes') }}</div>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.6">{{ result.execution_notes }}</p>
      </div>

      <div class="preview-section">
        <div class="section-title">{{ t('aiStrategyGenerator.planTitle', { count: editablePlans.length }) }}
          <span class="budget-usage">{{ t('aiStrategyGenerator.budgetUsageWithValue', { value: totalBudgetUsed }) }}</span>
        </div>
        <div class="plan-preview-list">
          <div v-for="(p, idx) in editablePlans" :key="p.seq" class="plan-preview-item" :class="{ editing: editingPlanIdx === idx }">
            <div class="plan-preview-header">
              <span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span>
              <template v-if="editingPlanIdx === idx">
                <select v-model="p.trigger_type" class="inline-select">
                  <option value="price_below">{{ t('aiStrategyGenerator.triggers.priceBelow') }}</option>
                  <option value="price_above">{{ t('aiStrategyGenerator.triggers.priceAbove') }}</option>
                  <option value="time">{{ t('aiStrategyGenerator.triggers.time') }}</option>
                </select>
                <input type="number" v-model.number="p.trigger_value" class="inline-input" style="width:80px" />
              </template>
              <template v-else>
                <span style="font-weight:600">{{ triggerLabel(p.trigger_type) }} {{ p.trigger_value }}</span>
              </template>
              <span v-if="selectedAssetIds.length > 1 && p.asset_id" class="plan-asset-tag">{{ getAssetName(p.asset_id) }}</span>
              <div class="plan-actions">
                <button class="plan-action-btn" @click="editingPlanIdx = editingPlanIdx === idx ? -1 : idx" :title="editingPlanIdx === idx ? t('aiStrategyGenerator.done') : t('aiStrategyGenerator.edit')">
                  <AppIcon :name="editingPlanIdx === idx ? 'check' : 'edit'" size="14" />
                </button>
                <button class="plan-action-btn del" @click="removePlan(idx)" :title="t('aiStrategyGenerator.delete')"><AppIcon name="x" size="14" /></button>
              </div>
            </div>
            <div class="plan-preview-meta">
              <template v-if="editingPlanIdx === idx">
                <label>{{ t('aiStrategyGenerator.amount') }}: <input type="number" v-model.number="p.amount" class="inline-input" style="width:70px" /></label>
                <label>{{ t('aiStrategyGenerator.quantity') }}: <input type="number" v-model.number="p.quantity" class="inline-input" style="width:70px" step="0.0001" /></label>
              </template>
              <template v-else>
                <span v-if="p.amount">{{ planMoney(p.amount, p.asset_id) }}</span>
                <span v-if="p.quantity">{{ formatFixed(p.quantity, 4) }}</span>
                <span v-if="p.new_avg_cost">{{ t('aiStrategyGenerator.averageCostArrow', { value: planMoney(p.new_avg_cost, p.asset_id) }) }}</span>
              </template>
            </div>
            <div v-if="p.rationale && editingPlanIdx !== idx" class="plan-rationale"><AppIcon name="pin" size="13" /> {{ p.rationale }}</div>
            <div v-else-if="p.notes && editingPlanIdx !== idx" style="font-size:11px;color:var(--text-muted);margin-top:2px">{{ p.notes }}</div>
          </div>
        </div>
      </div>

      <div class="preview-section regenerate-section">
        <div class="section-title clickable" @click="showRegenerate = !showRegenerate">
          {{ t('aiStrategyGenerator.regenerateTitle') }}
          <AppIcon class="toggle-icon" :name="showRegenerate ? 'chevron-down' : 'chevron-right'" size="14" />
          <span v-if="regenerateCount > 0" class="regen-count">{{ t('aiStrategyGenerator.iterationCount', { count: regenerateCount }) }}</span>
        </div>
        <div v-if="showRegenerate" class="regenerate-form">
          <textarea
            v-model="userFeedback"
            class="form-input feedback-input"
            :placeholder="t('aiStrategyGenerator.regeneratePlaceholder')"
            rows="3"
          ></textarea>
          <button class="btn btn-secondary" style="width:100%;margin-top:8px" @click="regenerate" :disabled="generating || !userFeedback.trim()">
            {{ t('aiStrategyGenerator.regenerateAction') }}
          </button>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-primary" style="flex:1" @click="confirmSave" :disabled="saving">
          {{ saving ? t('strategyCompare.saving') : t('aiStrategyGenerator.confirmAdopt') }}
        </button>
        <button class="btn" @click="generate" :disabled="generating">{{ t('aiStrategyGenerator.regenerateAgain') }}</button>
        <button class="btn" @click="step = 'config'">{{ t('aiStrategyGenerator.changeParams') }}</button>
      </div>
    </div>

    <!-- Agent Progress Overlay — teleported above drawer, cannot be accidentally dismissed -->
    <AgentProgressOverlay
      :visible="showProgressOverlay"
      :steps="agentSteps"
      :error="error"
      :data-quality-score="dataQualityScore"
      :eval-score="evalResult?.score ?? null"
      :grade="evalResult?.grade ?? null"
      :can-resume="!!currentTraceId"
      :result-ready="step === 'preview' && !!result"
      @close="closeProgressOverlay"
      @cancel="cancelGenerate"
      @resume="resumeGenerate"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useConfirm } from '../utils/confirm.js'
import { useToast } from '../utils/toast.js'
import { currencyInputLabel, formatCurrencyAmount } from '../utils/currency.js'
import { formatNumber } from '../utils/formatters.js'
import AgentProgressOverlay from './AgentProgressOverlay.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  presetAssetId: { type: [Number, String], default: null },
  presetAssetIds: { type: Array, default: () => [] },
  presetBudget: { type: [Number, String], default: null },
  presetGoal: { type: String, default: '' },
  presetRiskLevel: { type: String, default: '' },
  existingStrategyId: { type: [Number, String], default: null },
})
const emit = defineEmits(['done', 'generated'])

const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const assets = ref([])
const holdingSummaries = ref([])
const selectedAssetIds = ref([])
const step = ref('config')
const generating = ref(false)
const saving = ref(false)
const error = ref('')
const result = ref(null)
const showAnalysis = ref(false)
const showRegenerate = ref(false)
const editingPlanIdx = ref(-1)
const editablePlans = ref([])
const generationId = ref(null)
const regenerateCount = ref(0)
const userFeedback = ref('')
const form = reactive({
  budget: 20000,
  goal: 'recovery',
  risk_level: 'medium',
})
const BASE_BUDGET_CURRENCY = 'CNY'

let _abortController = null

const agentSteps = ref([
  { id: 'precheck', status: 'pending', detail: '' },
  { id: 'collecting', status: 'pending', detail: '' },
  { id: 'analyzing', status: 'pending', detail: '' },
  { id: 'validating', status: 'pending', detail: '' },
  { id: 'generating', status: 'pending', detail: '' },
  { id: 'postvalidating', status: 'pending', detail: '' },
  { id: 'evaluating', status: 'pending', detail: '' },
])

const dataQualityScore = ref(null)
const evalResult = ref(null)
const traceInfo = ref(null)
const currentTraceId = ref(null)
const progressDetail = reactive({})
const showQualityDetails = ref(false)
const showTraceInfo = ref(false)
const showConsistencyWarnings = ref(false)
const showProgressOverlay = ref(false)
const assetContextLoading = ref(false)
const assetContextReady = ref(false)
const assetContextError = ref('')
let assetContextRequestId = 0

const selectedAssetNames = computed(() => {
  return selectedAssetIds.value
    .map(id => assets.value.find(a => a.id === id))
    .filter(Boolean)
    .map(a => a.name)
    .join(t('aiStrategyGenerator.assetNameSeparator'))
})

const totalBudgetUsed = computed(() => {
  const total = editablePlans.value
    .filter(p => p.action === 'buy' && p.amount)
    .reduce((sum, p) => sum + (p.amount || 0), 0)
  return formatCurrencyAmount(total, BASE_BUDGET_CURRENCY, { maximumFractionDigits: 0 })
})
const canGenerate = computed(() => (
  !generating.value &&
  selectedAssetIds.value.length > 0 &&
  assetContextReady.value &&
  !assetContextLoading.value &&
  !assetContextError.value
))

function money(value, currency) {
  return formatCurrencyAmount(value, currency, { maximumFractionDigits: 0 })
}
function assetCurrencyById(assetId) {
  return assets.value.find((asset) => String(asset.id) === String(assetId))?.currency || 'CNY'
}
function planMoney(value, assetId) {
  return formatCurrencyAmount(value, assetCurrencyById(assetId), { maximumFractionDigits: 2 })
}

function baseCurrencyFieldLabel(label) {
  return currencyInputLabel(label, BASE_BUDGET_CURRENCY)
}

function toggleAsset(id) {
  const idx = selectedAssetIds.value.indexOf(id)
  if (idx >= 0) selectedAssetIds.value.splice(idx, 1)
  else selectedAssetIds.value.push(id)
  loadAssetInfo()
}

function normalizeAssetIds(ids) {
  const items = Array.isArray(ids) ? ids : []
  const normalized = []
  for (const id of items) {
    const number = Number(id)
    if (Number.isFinite(number) && !normalized.includes(number)) normalized.push(number)
  }
  return normalized
}

function applyPreset() {
  const ids = normalizeAssetIds(props.presetAssetIds)
  if (!ids.length && props.presetAssetId) {
    const id = Number(props.presetAssetId)
    if (Number.isFinite(id)) ids.push(id)
  }
  selectedAssetIds.value = ids

  const budget = Number(props.presetBudget)
  if (Number.isFinite(budget) && budget > 0) form.budget = budget

  if (['recovery', 'growth', 'balanced', 'trend', 'rebalance'].includes(props.presetGoal)) form.goal = props.presetGoal
  if (['low', 'medium', 'high'].includes(props.presetRiskLevel)) form.risk_level = props.presetRiskLevel

  if (selectedAssetIds.value.length) loadAssetInfo()
}

function getAssetName(id) {
  const a = assets.value.find(x => x.id === id)
  return a ? a.name : t('aiStrategyGenerator.assetNameFallback', { id })
}

function removePlan(idx) {
  editablePlans.value.splice(idx, 1)
  editablePlans.value.forEach((p, i) => { p.seq = i + 1 })
}

async function loadAssets() {
  const res = await api('/api/assets')
  const json = await res.json()
  assets.value = json.data || []
}

async function loadAssetInfo() {
  const requestId = ++assetContextRequestId
  const selectedIds = [...selectedAssetIds.value]
  holdingSummaries.value = []
  assetContextError.value = ''
  assetContextReady.value = false
  if (selectedIds.length === 0) {
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
        api(`/api/market/prices/${assetId}?cache=1`),
      ])
      const assetJson = await assetRes.json()
      const priceJson = await priceRes.json()
      if (assetJson.data) {
        const h = assetJson.data
        const asset = assets.value.find(a => a.id === assetId)
        const price = priceJson.data?.price
        const pnlPct = price && h.avg_cost ? Number((((price - h.avg_cost) / h.avg_cost) * 100).toFixed(1)) : null
        if (h.quantity) {
          summaries.push({
            asset_id: assetId,
            name: asset?.name || t('aiStrategyGenerator.assetNameFallback', { id: assetId }),
            currency: h.currency || asset?.currency || 'CNY',
            quantity: h.quantity,
            avg_cost: h.avg_cost,
            total_invested: h.total_invested,
            pnl_pct: pnlPct,
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
    assetContextError.value = t('aiStrategyGenerator.contextLoadFailed', { count: failedIds.length })
    assetContextReady.value = false
  } else {
    assetContextReady.value = selectedIds.length > 0
  }
}

async function cancelGenerate() {
  if (!_abortController || !generating.value) return
  const ok = await confirm({
    title: t('aiStrategyGenerator.cancelGenerate'),
    message: t('aiStrategyGenerator.cancelConfirmMessage'),
    confirmText: t('aiStrategyGenerator.cancelGenerate'),
    cancelText: t('common.cancel'),
    danger: true,
  })
  if (!ok) return
  _abortController.abort()
  _abortController = null
  generating.value = false
  showProgressOverlay.value = false
  agentSteps.value.forEach((s) => {
    if (s.status !== 'done') s.status = 'pending'
  })
  toast.success(t('aiStrategyGenerator.cancelled'))
}

function updateAgentStep(stepId, status, detail) {
  const current = agentSteps.value.find(x => x.id === stepId)
  if (current) {
    current.status = status
    if (detail !== undefined) current.detail = detail
  }
}

function closeProgressOverlay() {
  showProgressOverlay.value = false
  error.value = ''
}

function agentStepLabel(stepId) {
  const key = `aiStrategyGenerator.progress.${stepId}`
  return t(key, stepId)
}

function qualityGradeColor(grade) {
  return { A: 'var(--green)', B: 'var(--primary)', C: 'var(--yellow, #f59e0b)', D: 'var(--red)' }[grade] || 'var(--text-dim)'
}

function dataQualityColor(score) {
  if (score == null) return 'var(--text-dim)'
  if (score >= 0.7) return 'var(--green)'
  if (score >= 0.4) return 'var(--yellow, #f59e0b)'
  return 'var(--red)'
}

async function generate() {
  if (!canGenerate.value) return
  error.value = ''
  generating.value = true
  result.value = null
  editablePlans.value = []
  editingPlanIdx.value = -1
  step.value = 'config'
  dataQualityScore.value = null
  evalResult.value = null
  traceInfo.value = null
  currentTraceId.value = null
  agentSteps.value.forEach(s => { s.status = 'pending'; s.detail = '' })
  showProgressOverlay.value = true

  try {
    await doGenerate({
      asset_ids: selectedAssetIds.value,
      budget: form.budget,
      goal: form.goal,
      risk_level: form.risk_level,
    })
  } catch (e) {
    error.value = e.message
  }
  generating.value = false
}

async function regenerate() {
  if (!userFeedback.value.trim()) return
  error.value = ''
  generating.value = true
  dataQualityScore.value = null
  evalResult.value = null
  traceInfo.value = null
  currentTraceId.value = null
  agentSteps.value.forEach(s => { s.status = 'pending'; s.detail = '' })
  showProgressOverlay.value = true
  step.value = 'config'

  try {
    await doGenerate({
      asset_ids: selectedAssetIds.value,
      budget: form.budget,
      goal: form.goal,
      risk_level: form.risk_level,
      parent_id: generationId.value,
      user_feedback: userFeedback.value.trim(),
    })
    regenerateCount.value++
    userFeedback.value = ''
    showRegenerate.value = false
  } catch (e) {
    error.value = e.message
  }
  generating.value = false
}

async function resumeGenerate() {
  if (!currentTraceId.value || generating.value) return
  error.value = ''
  generating.value = true
  showProgressOverlay.value = true
  try {
    await doGenerate({
      asset_ids: selectedAssetIds.value,
      budget: form.budget,
      goal: form.goal,
      risk_level: form.risk_level,
      resume_trace_id: currentTraceId.value,
    })
  } catch (e) {
    error.value = e.message
  }
  generating.value = false
}

async function doGenerate(body) {
  _abortController = new AbortController()
  const token = localStorage.getItem('token')
  const baseUrl = import.meta.env.VITE_API_BASE || ''

  let response
  try {
    response = await fetch(`${baseUrl}/api/strategies/ai-agent-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: _abortController.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') return // silently cancelled
    throw e
  }

  if (!response.ok) {
    const text = await response.text()
    try {
      const json = JSON.parse(text)
      throw new Error(json.error || `HTTP ${response.status}`)
    } catch (e) {
      if (e.message?.startsWith('HTTP')) throw e
      throw new Error(t('aiStrategyGenerator.requestFailed', { status: response.status }))
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let eventType = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ') && eventType) {
          try {
            const data = JSON.parse(line.slice(6))
            handleSSEEvent(eventType, data)
          } catch {}
          eventType = ''
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') return // silently cancelled
    throw e
  } finally {
    _abortController = null
  }
}

function handleSSEEvent(event, data) {
  if (event === 'progress') {
    const { step: stepName, message, detail } = data
    if (detail) Object.assign(progressDetail, { [stepName]: detail })
    if (stepName === 'started') {
      if (detail?.trace_id) {
        currentTraceId.value = detail.trace_id
        traceInfo.value = detail
      }
      return
    }

    // Precheck
    if (stepName === 'precheck') {
      updateAgentStep('precheck', 'active', message)
    } else if (stepName === 'precheck_done') {
      updateAgentStep('precheck', 'done', message)
      updateAgentStep('collecting', 'active', '')
    // Collecting
    } else if (stepName === 'collecting') {
      updateAgentStep('collecting', 'active', message)
    } else if (stepName === 'collecting_done') {
      updateAgentStep('collecting', 'done', message)
      if (detail?.data_quality_score != null) dataQualityScore.value = detail.data_quality_score
      updateAgentStep('analyzing', 'active', '')
    // Analyzing
    } else if (stepName === 'analyzing') {
      updateAgentStep('analyzing', 'active', message)
    } else if (stepName === 'analyzing_done') {
      updateAgentStep('analyzing', 'done', message)
      updateAgentStep('validating', 'active', '')
    // Self-check
    } else if (stepName === 'validating') {
      updateAgentStep('validating', 'active', message)
    // Generating
    } else if (stepName === 'generating') {
      updateAgentStep('validating', 'done', '')
      updateAgentStep('generating', 'active', message)
    // Post-validate
    } else if (stepName === 'postvalidating') {
      updateAgentStep('generating', 'done', '')
      updateAgentStep('postvalidating', 'active', message)
    } else if (stepName === 'postvalidating_done') {
      updateAgentStep('postvalidating', 'done', message)
      updateAgentStep('evaluating', 'active', '')
    // Evaluating / done
    } else if (stepName === 'evaluating') {
      updateAgentStep('evaluating', 'active', message)
    } else if (stepName === 'done') {
      updateAgentStep('evaluating', 'active', message || t('aiStrategyGenerator.waitingForResult'))
      if (detail?.eval_score != null) evalResult.value = detail
    }
  } else if (event === 'result') {
    if (data.success && data.data) {
      result.value = data.data
      editablePlans.value = JSON.parse(JSON.stringify(data.data.plans || []))
      generationId.value = data.data.generation_id || null
      agentSteps.value.forEach(s => { s.status = 'done' })
      // Extract eval and trace info from result
      if (data.data.eval) evalResult.value = data.data.eval
      if (data.data.data_quality_score != null) dataQualityScore.value = data.data.data_quality_score
      if (data.data._meta?.trace_id) {
        traceInfo.value = data.data._meta
        currentTraceId.value = data.data._meta.trace_id
      }
      step.value = 'preview'
      showAnalysis.value = true
      emit('generated', generationId.value)
    } else {
      error.value = data.error || t('aiStrategyGenerator.generateFailed')
    }
  } else if (event === 'error') {
    error.value = data.error || t('aiStrategyGenerator.generateFailed')
  }
}

async function confirmSave() {
  saving.value = true
  try {
    const body = {
      asset_ids: selectedAssetIds.value,
      strategy: result.value.strategy,
      plans: editablePlans.value,
      generation_id: generationId.value,
    }
    if (props.existingStrategyId) {
      body.existing_strategy_id = Number(props.existingStrategyId)
    }
    const res = await api('/api/strategies/ai-confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    toast.success(props.existingStrategyId ? t('aiStrategyGenerator.updated') : t('aiStrategyGenerator.saved'))
    emit('done', json.data.strategyId)
  } catch (e) {
    toast.error(e.message)
  }
  saving.value = false
}

function typeLabel(type) {
  return type ? t(`strategyCompare.strategyTypes.${type}`) : '-'
}

function triggerLabel(type) {
  return {
    price_above: t('aiStrategyGenerator.triggers.priceAbove'),
    price_below: t('aiStrategyGenerator.triggers.priceBelow'),
    time: t('aiStrategyGenerator.triggers.time'),
  }[type] || type
}

function formatRounded(value) {
  const number = Number(value)
  return Number.isFinite(number) ? formatNumber(Math.round(number)) : '0'
}

function formatFixed(value, digits = 4) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return formatNumber(number, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatPercent(value, digits = 1, withSign = false) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const prefix = withSign && number > 0 ? '+' : ''
  return `${prefix}${formatNumber(number, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

function fmt(n) {
  return formatRounded(n)
}

onMounted(async () => {
  await loadAssets()
  applyPreset()
})
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

/* Agent Progress */
.agent-progress {
  margin-top: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
.progress-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
}
.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.progress-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  transition: opacity 0.3s;
}
.progress-step.pending { opacity: 0.4; }
.progress-step.active { opacity: 1; }
.progress-step.done { opacity: 0.8; }
.step-icon { font-size: 16px; }
.step-label { font-weight: 500; }
.step-detail { color: var(--text-dim); font-size: 12px; margin-left: auto; }
.progress-step.active .step-icon { animation: pulse 1.2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

.gen-error {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: var(--red);
  font-size: 13px;
}

/* Analysis Report */
.analysis-section {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
.section-title.clickable {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.toggle-icon { color: var(--text-dim); }
.confidence-badge {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(34,197,94,0.15);
  color: var(--green);
  font-weight: 500;
}
.analysis-content {
  margin-top: 12px;
}
.analysis-item {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.analysis-item:last-child { border-bottom: none; margin-bottom: 0; }
.analysis-item.disclaimer {
  background: rgba(239,68,68,0.05);
  border-radius: 6px;
  padding: 10px;
  border-bottom: none;
}
.analysis-label {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--text);
}
.analysis-item p {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.6;
  margin: 0;
}
.analysis-trend {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.8;
}
.analysis-trend b { color: var(--text-muted); }
.analysis-list {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}
.list-label { font-weight: 600; }

/* Preview */
.preview-section {
  margin-bottom: 16px;
}
.section-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }

.risk-info {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.8;
}
.risk-info b { color: var(--text-muted); }
.risk-info ul { margin: 4px 0 4px 16px; padding: 0; }
.risk-info li { margin-bottom: 2px; }

.plan-preview-list { display: flex; flex-direction: column; gap: 8px; }
.plan-preview-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  transition: border-color 0.2s;
}
.plan-preview-item.editing {
  border-color: var(--primary);
  background: rgba(59,130,246,0.03);
}
.plan-preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.plan-preview-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-dim); align-items: center; }
.plan-preview-meta label { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.plan-rationale {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 11px;
  color: var(--primary);
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(59,130,246,0.06);
  border-radius: 4px;
  line-height: 1.5;
}
.plan-asset-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-dim);
}
.plan-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.plan-action-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.plan-action-btn:hover { border-color: var(--primary); background: rgba(59,130,246,0.05); }
.plan-action-btn.del:hover { border-color: var(--red); background: rgba(239,68,68,0.05); color: var(--red); }

.inline-input {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  background: var(--bg-card);
  color: var(--text);
}
.inline-input:focus { border-color: var(--primary); outline: none; }
.inline-select {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  background: var(--bg-card);
  color: var(--text);
}

.budget-usage {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin-left: 8px;
}

/* Regenerate Section */
.regenerate-section {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
.regenerate-form {
  margin-top: 10px;
}
.feedback-input {
  resize: vertical;
  min-height: 60px;
  font-size: 13px;
}
.regen-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
}

/* ===== Mobile Responsive ===== */
@media (max-width: 768px) {
  .plan-action-btn {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
  .inline-input, .inline-select {
    padding: 8px 10px;
    font-size: 14px;
    min-height: 36px;
    border-radius: 6px;
  }
  .plan-preview-header {
    flex-wrap: wrap;
    gap: 6px;
  }
  .plan-preview-meta {
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }
  .plan-preview-meta label {
    font-size: 13px;
  }
  .plan-actions {
    margin-left: 0;
    margin-top: 8px;
    width: 100%;
    justify-content: flex-end;
  }
  .plan-preview-item {
    padding: 12px;
  }
  .info-row {
    flex-wrap: wrap;
    gap: 4px;
  }
  .asset-chip {
    padding: 10px 14px;
    font-size: 14px;
  }
  .summary-row {
    font-size: 14px;
    padding: 4px 0;
  }
}

/* Data quality bar in progress */
.data-quality-ribbon {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 12px;
}
.dq-label { color: var(--text-dim); white-space: nowrap; }
.dq-bar-track {
  flex: 1;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.dq-bar-track.small {
  width: 60px;
  flex: none;
  height: 5px;
}
.dq-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}
.dq-value { font-weight: 600; font-size: 12px; min-width: 30px; text-align: right; }

/* Quality banner */
.agent-quality-banner {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.quality-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.quality-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.quality-label {
  font-size: 12px;
  color: var(--text-dim);
}
.quality-score {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.quality-score small {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
}
.quality-grade {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.btn-link {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--primary);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.agent-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #f59e0b;
  padding: 6px 10px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(245, 158, 11, 0.25);
}
.quality-checks {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.quality-check-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.check-icon { display: inline-flex; align-items: center; }
.check-icon.passed { color: var(--green); }
.check-icon.failed { color: var(--red); }
.check-name { color: var(--text-dim); text-transform: capitalize; }
.check-detail { color: var(--text-muted); font-size: 11px; margin-left: auto; }
.agent-warnings-section { margin-top: 8px; }
.warnings-header {
  font-size: 12px;
  color: #f59e0b;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.warnings-list {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: var(--text-dim);
  padding: 3px 6px;
}
.fix-log {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-dim);
  padding: 4px 8px;
  background: rgba(59,130,246,0.06);
  border-radius: 4px;
}
.fix-log-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: var(--primary);
}
.trace-info {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--text-muted);
}
.trace-label { font-family: monospace; }
.trace-elapsed {
  padding: 1px 6px;
  background: var(--border);
  border-radius: 4px;
  font-size: 11px;
}
</style>
