<template>
  <div class="strategy-form-page">
    <div class="page-header">
      <h1 class="page-title">{{ isEdit ? t('strategyForm.editTitle') : t('strategyForm.createTitle') }}</h1>
    </div>

    <form class="strategy-form-shell" @submit.prevent="submit">
      <div class="card form-section">
        <div class="form-section-header">
          <div>
            <div class="section-kicker">{{ t('strategyForm.sectionBasicsKicker') }}</div>
            <div class="section-title">{{ t('strategyForm.sectionBasics') }}</div>
            <p class="section-help">{{ t('strategyForm.sectionBasicsDesc') }}</p>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('strategyForm.name') }} *</label>
          <input class="form-input" v-model="form.name" :placeholder="t('strategyForm.namePlaceholder')" required />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('strategyForm.description') }}</label>
          <textarea class="form-textarea" v-model="form.description" :placeholder="t('strategyForm.descriptionPlaceholder')"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('strategyForm.type') }} *</label>
          <select class="form-select" v-model="form.type" @change="onTypeChange" required>
            <option value="">{{ t('strategyForm.selectType') }}</option>
            <option v-for="option in strategyTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <p v-if="currentStrategyType" class="type-hint">{{ currentStrategyType.description }}</p>
          <p v-else class="type-hint">{{ t('strategyForm.supportedTypesHint') }}</p>
        </div>
      </div>

      <div class="card form-section">
        <div class="form-section-header">
          <div>
            <div class="section-kicker">{{ t('strategyForm.sectionAssetsKicker') }}</div>
            <div class="section-title">{{ t('strategyForm.sectionAssets') }}</div>
            <p class="section-help">{{ t('strategyForm.sectionAssetsDesc') }}</p>
          </div>
          <div class="selection-pill" v-if="selectedAssetIds.length">
            {{ t('strategyForm.selectedCount', { count: selectedAssetIds.length }) }}
          </div>
        </div>
        <div class="asset-multi-select">
          <div
            v-for="a in assets"
            :key="a.id"
            class="asset-chip"
            :class="{ selected: selectedAssetIds.includes(a.id) }"
            @click="toggleAsset(a.id)"
          >
            <span class="asset-chip-name">{{ a.icon }} {{ a.name }}</span>
            <span class="asset-chip-symbol">{{ a.symbol }}</span>
          </div>
        </div>
        <div v-if="selectedAssets.length" class="selected-asset-list">
          <span v-for="asset in selectedAssets" :key="asset.id" class="selected-asset-pill">{{ asset.icon }} {{ asset.name }}</span>
        </div>
      </div>

      <div v-if="form.type" class="editor-layout">
        <div class="card form-section params-card">
          <div class="form-section-header">
            <div>
              <div class="section-kicker">{{ t('strategyForm.sectionParamsKicker') }}</div>
              <div class="section-title">{{ t('strategyForm.params') }}</div>
              <p class="section-help">{{ t('strategyForm.sectionParamsDesc') }}</p>
            </div>
          </div>

          <div v-if="unsupportedStrategyType" class="unsupported-param-box">
            <div class="unsupported-param-title">{{ t('strategyForm.unsupportedTypeTitle') }}</div>
            <p class="unsupported-param-desc">{{ t('strategyForm.unsupportedTypeDesc') }}</p>
            <textarea class="form-textarea raw-params-textarea" v-model="rawParameters"></textarea>
          </div>

          <!-- Recovery: 按资产分组 -->
          <div v-else-if="form.type === 'recovery'">
            <div class="form-group">
              <label class="form-label">{{ t('strategyForm.budget') }} (¥)</label>
              <input class="form-input" type="number" v-model="globalBudget" placeholder="20000" inputmode="numeric" />
            </div>

            <div v-for="assetId in selectedAssetIds" :key="'r-'+assetId" class="asset-param-group">
              <div class="asset-param-header">
                <div>
                  <div class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</div>
                  <div class="asset-param-summary">{{ t('strategyForm.recoveryAssetSummary', { buyCount: getAssetBuyLines(assetId).length, sellCount: getAssetSellLines(assetId).length }) }}</div>
                </div>
                <span class="asset-param-symbol">{{ getAsset(assetId)?.symbol }}</span>
              </div>

              <div class="sub-section">
                <div class="sub-section-title">📉 {{ t('strategyForm.buyLines') }}</div>
                <div class="lines-editor">
                  <div v-for="(line, i) in getAssetBuyLines(assetId)" :key="'b'+assetId+'-'+i" class="line-row">
                    <div class="line-field">
                      <span class="line-prefix">≤</span>
                      <input class="form-input" type="number" step="any" v-model="line.price" :placeholder="t('strategyForm.triggerPrice')" inputmode="decimal" />
                    </div>
                    <div class="line-field">
                      <span class="line-prefix">¥</span>
                      <input class="form-input" type="number" step="any" v-model="line.amount" :placeholder="t('strategyForm.buyAmount')" inputmode="numeric" />
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" @click="removeAssetBuyLine(assetId, i)">✕</button>
                  </div>
                  <button type="button" class="btn btn-sm" @click="addAssetBuyLine(assetId)">+ {{ t('strategyForm.addBuyLine') }}</button>
                </div>
              </div>

              <div class="sub-section">
                <div class="sub-section-title">📈 {{ t('strategyForm.sellLines') }}</div>
                <div class="lines-editor">
                  <div v-for="(line, i) in getAssetSellLines(assetId)" :key="'s'+assetId+'-'+i" class="line-row">
                    <div class="line-field">
                      <span class="line-prefix">≥</span>
                      <input class="form-input" type="number" step="any" v-model="line.price" :placeholder="t('strategyForm.triggerPrice')" inputmode="decimal" />
                    </div>
                    <div class="line-field">
                      <span class="line-prefix">¥</span>
                      <input class="form-input" type="number" step="any" v-model="line.amount" :placeholder="t('strategyForm.sellAmount')" inputmode="numeric" />
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" @click="removeAssetSellLine(assetId, i)">✕</button>
                  </div>
                  <button type="button" class="btn btn-sm" @click="addAssetSellLine(assetId)">+ {{ t('strategyForm.addSellLine') }}</button>
                </div>
              </div>
            </div>

            <!-- 预算汇总 -->
            <div class="budget-summary" :class="{ over: allocatedBudget > Number(globalBudget) }">
              <span>{{ t('strategyForm.allocated') }}: ¥{{ formatNumber(allocatedBudget) }}</span>
              <span>/</span>
              <span>{{ t('strategyForm.totalBudget') }}: ¥{{ formatNumber(Number(globalBudget || 0)) }}</span>
              <span v-if="allocatedBudget > Number(globalBudget)" class="budget-warn">⚠️ {{ t('strategyForm.overBudget') }}</span>
            </div>
          </div>

          <!-- DCA: 按资产分组 -->
          <div v-else-if="form.type === 'dca'">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ t('strategyForm.frequency') }}</label>
                <select class="form-select" v-model="globalFrequency">
                  <option value="daily">{{ t('strategyForm.frequencies.daily') }}</option>
                  <option value="weekly">{{ t('strategyForm.frequencies.weekly') }}</option>
                  <option value="monthly">{{ t('strategyForm.frequencies.monthly') }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">{{ t('strategyForm.periods') }}</label>
                <input class="form-input" type="number" v-model="globalPeriods" placeholder="10" />
              </div>
             </div>

            <div v-for="assetId in selectedAssetIds" :key="'d-'+assetId" class="asset-param-group compact">
              <div class="asset-param-header">
                <span class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</span>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">{{ t('strategyForm.amountPerPeriod') }} (¥)</label>
                  <input class="form-input" type="number" v-model="getAssetDCA(assetId).amount_per" placeholder="1000" inputmode="numeric" />
                </div>
              </div>
            </div>
          </div>

          <!-- Grid: 按资产分组 -->
          <div v-else-if="form.type === 'grid'">
            <div class="form-group">
              <label class="form-label">{{ t('strategyForm.budget') }} (¥)</label>
              <input class="form-input" type="number" v-model="globalBudget" placeholder="20000" inputmode="numeric" />
            </div>

            <div v-for="assetId in selectedAssetIds" :key="'g-'+assetId" class="asset-param-group compact">
              <div class="asset-param-header">
                <span class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</span>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">{{ t('strategyForm.lowerBound') }}</label><input class="form-input" type="number" v-model="getAssetGrid(assetId).low" :placeholder="t('strategyForm.lowerBound')" inputmode="decimal" /></div>
                <div class="form-group"><label class="form-label">{{ t('strategyForm.upperBound') }}</label><input class="form-input" type="number" v-model="getAssetGrid(assetId).high" :placeholder="t('strategyForm.upperBound')" inputmode="decimal" /></div>
                <div class="form-group"><label class="form-label">{{ t('strategyForm.gridCount') }}</label><input class="form-input" type="number" v-model="getAssetGrid(assetId).grids" placeholder="5" /></div>
              </div>
             </div>
           </div>

          <!-- Value Avg: 按资产分组 -->
          <div v-else-if="form.type === 'value_avg'">
            <div class="form-group">
              <label class="form-label">{{ t('strategyForm.periods') }}</label>
              <input class="form-input" type="number" v-model="globalPeriods" placeholder="10" />
            </div>

            <div v-for="assetId in selectedAssetIds" :key="'v-'+assetId" class="asset-param-group compact">
              <div class="asset-param-header">
                <span class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</span>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">{{ t('strategyForm.targetValue') }} (¥)</label><input class="form-input" type="number" v-model="getAssetValueAvg(assetId).target_value" placeholder="50000" inputmode="numeric" /></div>
                <div class="form-group"><label class="form-label">{{ t('strategyForm.growthRate') }} (%)</label><input class="form-input" type="number" step="0.1" v-model="getAssetValueAvg(assetId).growth_rate_val" placeholder="2" /></div>
              </div>
            </div>
          </div>

          <div v-if="selectedAssetIds.length === 0" class="empty-hint">
            {{ t('strategyForm.selectAssetHint') }}
          </div>
        </div>

        <div class="card summary-card">
          <div class="section-kicker">{{ t('strategyForm.sectionSummaryKicker') }}</div>
          <div class="section-title">{{ t('strategyForm.sectionSummary') }}</div>
          <div class="summary-list">
            <div v-for="item in strategySummaryRows" :key="item.label" class="summary-row">
              <span class="summary-label">{{ item.label }}</span>
              <span class="summary-value">{{ item.value }}</span>
            </div>
          </div>
          <div v-if="selectedAssets.length" class="selected-asset-list compact">
            <span v-for="asset in selectedAssets" :key="asset.id" class="selected-asset-pill">{{ asset.icon }} {{ asset.name }}</span>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="submitting || (!unsupportedStrategyType && selectedAssetIds.length === 0)">{{ submitting ? t('strategyForm.creating') : (isEdit ? t('strategyForm.save') : t('strategyForm.create')) }}</button>
        <button v-if="isEdit" type="button" class="btn" @click="showAIRegenerate = true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> {{ t('strategyForm.aiRegenerate') }}</button>
        <router-link to="/strategies" class="btn">{{ t('strategyForm.cancel') }}</router-link>
      </div>
    </form>

    <!-- AI Regenerate Drawer -->
    <AppDrawer v-if="isEdit" v-model="showAIRegenerate" :title="`✨ ${t('strategyForm.aiRegenerateTitle')}`">
      <AIStrategyGenerator :preset-asset-id="selectedAssetIds[0]" :existing-strategy-id="strategyId" @done="onAIRegenDone" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import AppDrawer from '../components/AppDrawer.vue'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'
import { formatNumber } from '../utils/formatters.js'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const { t } = useI18n()
const submitting = ref(false)
const showAIRegenerate = ref(false)
const assets = ref([])
const isEdit = ref(false)
const strategyId = ref(null)
const selectedAssetIds = ref([])
const form = reactive({ name: '', description: '', type: '' })
const rawParameters = ref('{}')

// Global params shared across assets
const globalBudget = ref(20000)
const globalFrequency = ref('weekly')
const globalPeriods = ref(10)

// Per-asset parameters (keyed by asset ID)
const perAssetBuyLines = reactive({})   // { [assetId]: [{price, amount}] }
const perAssetSellLines = reactive({})  // { [assetId]: [{price, amount}] }
const perAssetDCA = reactive({})        // { [assetId]: {amount_per} }
const perAssetGrid = reactive({})       // { [assetId]: {low, high, grids} }
const perAssetValueAvg = reactive({})   // { [assetId]: {target_value, growth_rate_val} }
const supportedStrategyTypes = ['recovery', 'dca', 'grid', 'value_avg']
const strategyTypeOptions = computed(() => {
  const options = supportedStrategyTypes.map((value) => ({
    value,
    label: t(`strategyForm.types.${value}`),
    description: t(`strategyForm.typeDescriptions.${value}`),
  }))
  if (form.type && !supportedStrategyTypes.includes(form.type)) {
    options.push({
      value: form.type,
      label: t('strategyForm.unsupportedTypeOption', { type: form.type }),
      description: t('strategyForm.unsupportedTypeDesc'),
    })
  }
  return options
})
const unsupportedStrategyType = computed(() => !!form.type && !supportedStrategyTypes.includes(form.type))
const selectedAssets = computed(() => selectedAssetIds.value.map((id) => getAsset(id)).filter(Boolean))
const currentStrategyType = computed(() => strategyTypeOptions.value.find((option) => option.value === form.type) || null)
const strategySummaryRows = computed(() => {
  const rows = [
    { label: t('strategyForm.type'), value: currentStrategyType.value?.label || '-' },
    { label: t('strategyForm.relatedAssets'), value: selectedAssets.value.length ? t('strategyForm.selectedCount', { count: selectedAssets.value.length }) : t('strategyForm.selectAssetHint') },
  ]
  if (form.type === 'recovery') {
    rows.push(
      { label: t('strategyForm.budget'), value: `¥${formatNumber(Number(globalBudget.value || 0))}` },
      { label: t('strategyForm.allocated'), value: `¥${formatNumber(allocatedBudget.value)}` },
    )
  } else if (form.type === 'dca') {
    rows.push(
      { label: t('strategyForm.frequency'), value: t(`strategyForm.frequencies.${globalFrequency.value}`) },
      { label: t('strategyForm.periods'), value: `${globalPeriods.value || 0}` },
    )
  } else if (form.type === 'grid') {
    rows.push(
      { label: t('strategyForm.budget'), value: `¥${formatNumber(Number(globalBudget.value || 0))}` },
      { label: t('strategyForm.gridCount'), value: selectedAssetIds.value.length ? selectedAssetIds.value.map((id) => getAssetGrid(id).grids || 0).join(' / ') : '-' },
    )
  } else if (form.type === 'value_avg') {
    rows.push(
      { label: t('strategyForm.periods'), value: `${globalPeriods.value || 0}` },
      { label: t('strategyForm.targetValue'), value: selectedAssetIds.value.length ? selectedAssetIds.value.map((id) => `¥${formatNumber(Number(getAssetValueAvg(id).target_value || 0))}`).join(' / ') : '-' },
    )
  } else if (unsupportedStrategyType.value) {
    rows.push({ label: t('strategyForm.unsupportedTypeTitle'), value: form.type })
  }
  return rows
})

function getAsset(id) {
  return assets.value.find(a => a.id === id)
}

function toggleAsset(id) {
  const idx = selectedAssetIds.value.indexOf(id)
  if (idx >= 0) {
    selectedAssetIds.value.splice(idx, 1)
  } else {
    selectedAssetIds.value.push(id)
    // Initialize per-asset data
    if (!perAssetBuyLines[id]) perAssetBuyLines[id] = []
    if (!perAssetSellLines[id]) perAssetSellLines[id] = []
    if (!perAssetDCA[id]) perAssetDCA[id] = { amount_per: 1000 }
    if (!perAssetGrid[id]) perAssetGrid[id] = { low: '', high: '', grids: 5 }
    if (!perAssetValueAvg[id]) perAssetValueAvg[id] = { target_value: 50000, growth_rate_val: 2 }
  }
}

// Recovery lines per asset
function getAssetBuyLines(id) {
  if (!perAssetBuyLines[id]) perAssetBuyLines[id] = []
  return perAssetBuyLines[id]
}
function getAssetSellLines(id) {
  if (!perAssetSellLines[id]) perAssetSellLines[id] = []
  return perAssetSellLines[id]
}
function addAssetBuyLine(id) {
  if (!perAssetBuyLines[id]) perAssetBuyLines[id] = []
  perAssetBuyLines[id].push({ price: '', amount: '' })
}
function addAssetSellLine(id) {
  if (!perAssetSellLines[id]) perAssetSellLines[id] = []
  perAssetSellLines[id].push({ price: '', amount: '' })
}
function removeAssetBuyLine(id, i) { perAssetBuyLines[id].splice(i, 1) }
function removeAssetSellLine(id, i) { perAssetSellLines[id].splice(i, 1) }

// DCA / Grid / ValueAvg per asset
function getAssetDCA(id) {
  if (!perAssetDCA[id]) perAssetDCA[id] = { amount_per: 1000 }
  return perAssetDCA[id]
}
function getAssetGrid(id) {
  if (!perAssetGrid[id]) perAssetGrid[id] = { low: '', high: '', grids: 5 }
  return perAssetGrid[id]
}
function getAssetValueAvg(id) {
  if (!perAssetValueAvg[id]) perAssetValueAvg[id] = { target_value: 50000, growth_rate_val: 2 }
  return perAssetValueAvg[id]
}

// Budget summary for recovery
const allocatedBudget = computed(() => {
  let total = 0
  for (const id of selectedAssetIds.value) {
    const lines = perAssetBuyLines[id] || []
    for (const l of lines) {
      if (l.amount) total += Number(l.amount) || 0
    }
  }
  return total
})

function onTypeChange() {}

function buildParameters() {
  const p = {}
  if (unsupportedStrategyType.value) {
    return JSON.parse(rawParameters.value || '{}')
  }
  
  if (form.type === 'recovery') {
    p.budget = Number(globalBudget.value) || 20000
    p.buy_lines = []
    p.sell_lines = []
    for (const id of selectedAssetIds.value) {
      const buys = (perAssetBuyLines[id] || []).filter(l => l.price)
      const sells = (perAssetSellLines[id] || []).filter(l => l.price)
      for (const l of buys) p.buy_lines.push({ price: Number(l.price), amount: Number(l.amount), asset_id: id })
      for (const l of sells) p.sell_lines.push({ price: Number(l.price), amount: Number(l.amount), asset_id: id })
    }
  } else if (form.type === 'dca') {
    p.frequency = globalFrequency.value
    p.periods = Number(globalPeriods.value)
    p.per_asset = {}
    for (const id of selectedAssetIds.value) {
      p.per_asset[id] = { amount_per: Number(getAssetDCA(id).amount_per) || 1000 }
    }
    // For backward compatibility, set top-level amount_per as sum
    p.amount_per = Object.values(p.per_asset).reduce((s, v) => s + v.amount_per, 0)
  } else if (form.type === 'grid') {
    p.budget = Number(globalBudget.value) || 20000
    p.per_asset = {}
    for (const id of selectedAssetIds.value) {
      const g = getAssetGrid(id)
      p.per_asset[id] = { low: Number(g.low), high: Number(g.high), grids: Number(g.grids) || 5 }
    }
    // Backward compat
    if (selectedAssetIds.value.length === 1) {
      const g = getAssetGrid(selectedAssetIds.value[0])
      p.low = Number(g.low); p.high = Number(g.high); p.grids = Number(g.grids) || 5
    }
  } else if (form.type === 'value_avg') {
    p.periods = Number(globalPeriods.value)
    p.per_asset = {}
    for (const id of selectedAssetIds.value) {
      const v = getAssetValueAvg(id)
      p.per_asset[id] = { target_value: Number(v.target_value), growth_rate: Number(v.growth_rate_val) / 100 }
    }
    // Backward compat
    if (selectedAssetIds.value.length === 1) {
      const v = getAssetValueAvg(selectedAssetIds.value[0])
      p.target_value = Number(v.target_value); p.growth_rate = Number(v.growth_rate_val) / 100
    }
  }

  return p
}

async function submit() {
  // Validate required fields
    if (!form.name || !form.type) {
      toast.error(t('strategyForm.validationNameType'))
      return
    }
    if (selectedAssetIds.value.length === 0) {
      toast.error(t('strategyForm.validationAssets'))
      return
    }

  // Validate parameters per type
  if (form.type === 'recovery') {
    if (!globalBudget.value || Number(globalBudget.value) <= 0) {
        toast.error(t('strategyForm.validationBudget'))
        return
      }
  } else if (unsupportedStrategyType.value) {
    try {
      JSON.parse(rawParameters.value || '{}')
    } catch {
      toast.error(t('strategyForm.validationParamsJson'))
      return
    }
  } else if (form.type === 'grid') {
    for (const id of selectedAssetIds.value) {
      const g = getAssetGrid(id)
        if (!g.low || !g.high || Number(g.low) <= 0 || Number(g.high) <= 0) {
          toast.error(t('strategyForm.validationGridPrice', { name: getAsset(id)?.name || 'Asset' }))
          return
        }
        if (Number(g.low) >= Number(g.high)) {
          toast.error(t('strategyForm.validationGridOrder', { name: getAsset(id)?.name || 'Asset' }))
          return
        }
        if (!g.grids || Number(g.grids) < 2) {
          toast.error(t('strategyForm.validationGridCount', { name: getAsset(id)?.name || 'Asset' }))
          return
        }
    }
  } else if (form.type === 'dca') {
    for (const id of selectedAssetIds.value) {
      const d = getAssetDCA(id)
        if (!d.amount_per || Number(d.amount_per) <= 0) {
          toast.error(t('strategyForm.validationDcaAmount', { name: getAsset(id)?.name || 'Asset' }))
          return
        }
    }
  } else if (form.type === 'value_avg') {
    for (const id of selectedAssetIds.value) {
      const v = getAssetValueAvg(id)
        if (!v.target_value || Number(v.target_value) <= 0) {
          toast.error(t('strategyForm.validationTargetValue', { name: getAsset(id)?.name || 'Asset' }))
          return
        }
    }
  }

  submitting.value = true
  try {
    const p = buildParameters()

    const url = isEdit.value ? `/api/strategies/${strategyId.value}` : '/api/strategies'
    const method = isEdit.value ? 'PUT' : 'POST'
    const body = {
      name: form.name, description: form.description, type: form.type, parameters: p,
      asset_id: selectedAssetIds.value[0] || null,
      asset_ids: selectedAssetIds.value.length > 0 ? selectedAssetIds.value : undefined,
    }
    const res = await api(url, { method, body: JSON.stringify(body) })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || t('common.saveFailed'))

    toast.success(isEdit.value ? t('strategyForm.updated') : t('strategyForm.created'))
    router.push(isEdit.value ? `/strategies/${strategyId.value}` : '/strategies')
  } catch (e) { toast.error(e.message) }
  finally { submitting.value = false }
}

function onAIRegenDone(strategyId) {
  showAIRegenerate.value = false
  toast.success(t('strategyForm.updated'))
  router.push(`/strategies/${strategyId}`)
}

onMounted(async () => {
  const res = await api('/api/assets')
  const json = await res.json()
  assets.value = json.data || []

  // Edit mode
  if (route.params.id) {
    isEdit.value = true
    strategyId.value = route.params.id
    const sres = await api(`/api/strategies/${route.params.id}`)
    const sjson = await sres.json()
    if (sjson.data) {
      const s = sjson.data
      form.name = s.name
      form.description = s.description || ''
      form.type = s.type
      rawParameters.value = s.parameters || '{}'

      if (s.asset_ids) {
        try { selectedAssetIds.value = JSON.parse(s.asset_ids) } catch { selectedAssetIds.value = s.asset_id ? [s.asset_id] : [] }
      } else if (s.asset_id) {
        selectedAssetIds.value = [s.asset_id]
      }

      // Initialize per-asset structures
      for (const id of selectedAssetIds.value) {
        perAssetBuyLines[id] = perAssetBuyLines[id] || []
        perAssetSellLines[id] = perAssetSellLines[id] || []
        perAssetDCA[id] = perAssetDCA[id] || { amount_per: 1000 }
        perAssetGrid[id] = perAssetGrid[id] || { low: '', high: '', grids: 5 }
        perAssetValueAvg[id] = perAssetValueAvg[id] || { target_value: 50000, growth_rate_val: 2 }
      }

      try {
        const p = JSON.parse(s.parameters || '{}')
        if (s.type === 'recovery') {
          globalBudget.value = p.budget || 20000
          // Load lines with asset_id
          if (p.buy_lines) {
            for (const l of p.buy_lines) {
              const aid = l.asset_id || selectedAssetIds.value[0]
              if (!perAssetBuyLines[aid]) perAssetBuyLines[aid] = []
              perAssetBuyLines[aid].push({ price: l.price, amount: l.amount })
            }
          }
          if (p.sell_lines) {
            for (const l of p.sell_lines) {
              const aid = l.asset_id || selectedAssetIds.value[0]
              if (!perAssetSellLines[aid]) perAssetSellLines[aid] = []
              perAssetSellLines[aid].push({ price: l.price, amount: l.amount })
            }
          }
        } else if (s.type === 'dca') {
          globalFrequency.value = p.frequency || 'weekly'
          globalPeriods.value = p.periods || 10
          if (p.per_asset) {
            for (const [id, v] of Object.entries(p.per_asset)) {
              perAssetDCA[id] = { amount_per: v.amount_per || 1000 }
            }
          } else {
            // Legacy single-asset
            for (const id of selectedAssetIds.value) {
              perAssetDCA[id] = { amount_per: p.amount_per || 1000 }
            }
          }
        } else if (s.type === 'grid') {
          globalBudget.value = p.budget || 20000
          if (p.per_asset) {
            for (const [id, v] of Object.entries(p.per_asset)) {
              perAssetGrid[id] = { low: v.low, high: v.high, grids: v.grids || 5 }
            }
          } else {
            for (const id of selectedAssetIds.value) {
              perAssetGrid[id] = { low: p.low, high: p.high, grids: p.grids || 5 }
            }
          }
        } else if (s.type === 'value_avg') {
          globalPeriods.value = p.periods || 10
          if (p.per_asset) {
            for (const [id, v] of Object.entries(p.per_asset)) {
              perAssetValueAvg[id] = { target_value: v.target_value, growth_rate_val: (v.growth_rate || 0) * 100 }
            }
          } else {
            for (const id of selectedAssetIds.value) {
              perAssetValueAvg[id] = { target_value: p.target_value, growth_rate_val: (p.growth_rate || 0) * 100 }
            }
          }
        }
      } catch {}
    }
  }
})
</script>

<style scoped>
.strategy-form-page {
  max-width: 980px;
}
.strategy-form-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.9fr);
  gap: 16px;
  align-items: start;
}
.form-section {
  margin-bottom: 0;
}
.form-section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.section-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.section-help {
  margin-top: -8px;
  color: var(--text-dim);
  font-size: 13px;
}
.type-hint {
  margin-top: 8px;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.6;
}
.selection-pill {
  align-self: flex-start;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: var(--blue);
  font-size: 12px;
  font-weight: 600;
}
.asset-multi-select {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
}
.asset-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  background: var(--bg);
}
.asset-chip:hover { border-color: var(--primary); }
.asset-chip.selected {
  background: rgba(59, 130, 246, 0.12);
  border-color: var(--primary);
  color: var(--text);
}
.asset-chip-name {
  font-size: 14px;
  font-weight: 600;
}
.asset-chip-symbol {
  font-size: 12px;
  color: var(--text-muted);
}
.selected-asset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.selected-asset-list.compact {
  margin-top: 16px;
}
.selected-asset-pill {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--bg);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
}
.selected-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-dim);
}

.params-section {
  margin-top: 16px;
}

.asset-param-group {
  margin-top: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  background: var(--bg);
}
.asset-param-group.compact {
  padding: 12px;
  margin-top: 12px;
}
.asset-param-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.asset-param-name {
  font-weight: 600;
  font-size: 14px;
}
.asset-param-symbol {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
}
.asset-param-summary {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.sub-section {
  margin-bottom: 12px;
}
.sub-section:last-child { margin-bottom: 0; }
.sub-section-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-dim);
}

.lines-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.line-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.line-field {
  display: flex;
  align-items: center;
  gap: 4px;
}
.line-field .form-input {
  flex: 1;
}
.line-prefix {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
  min-width: 14px;
}

.budget-summary {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.2);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}
.budget-summary.over {
  background: rgba(239,68,68,0.08);
  border-color: rgba(239,68,68,0.3);
  color: var(--red);
}
.budget-warn {
  margin-left: auto;
  font-weight: 600;
}

.empty-hint {
  margin-top: 4px;
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}
.summary-card {
  position: sticky;
  top: calc(var(--header-h) + var(--safe-top) + 8px);
}
.summary-list {
  display: grid;
  gap: 10px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.summary-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}
.summary-label {
  color: var(--text-dim);
  font-size: 13px;
}
.summary-value {
  text-align: right;
  font-size: 13px;
  font-weight: 600;
}
.unsupported-param-box {
  border: 1px dashed var(--border);
  border-radius: 12px;
  padding: 16px;
  background: var(--bg);
}
.unsupported-param-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.unsupported-param-desc {
  margin-bottom: 12px;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.6;
}
.raw-params-textarea {
  min-height: 220px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 900px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
  .summary-card {
    position: static;
  }
}

@media (max-width: 768px) {
  .asset-multi-select {
    grid-template-columns: 1fr 1fr;
  }
  .line-row {
    grid-template-columns: 1fr;
  }
}
</style>
