<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ isEdit ? '编辑策略' : '创建策略' }}</h1>
    </div>

    <div class="card" style="max-width:700px">
      <form @submit.prevent="submit">
        <div class="form-group">
          <label class="form-label">策略名称 *</label>
          <input class="form-input" v-model="form.name" placeholder="例如：黄金扭亏计划" required />
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea class="form-textarea" v-model="form.description" placeholder="简短描述策略目标..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">策略类型 *</label>
            <select class="form-select" v-model="form.type" @change="onTypeChange" required>
              <option value="">选择类型</option>
              <option value="dca">📅 定投 (DCA)</option>
              <option value="grid">📐 网格交易</option>
              <option value="value_avg">📈 价值平均</option>
              <option value="recovery">💉 扭亏/补仓</option>
              <option value="trend">📊 趋势跟踪</option>
              <option value="rebalance">⚖️ 组合再平衡</option>
            </select>
          </div>
        </div>

        <!-- 资产选择 -->
        <div class="form-group">
          <label class="form-label">关联资产（可多选）</label>
          <div class="asset-multi-select">
            <div v-for="a in assets" :key="a.id" class="asset-chip"
                 :class="{ selected: selectedAssetIds.includes(a.id) }"
                 @click="toggleAsset(a.id)">
              {{ a.icon }} {{ a.name }}
            </div>
          </div>
          <div v-if="selectedAssetIds.length > 0" class="selected-hint">已选 {{ selectedAssetIds.length }} 个资产</div>
        </div>

        <!-- 动态参数：按资产分组 -->
        <div v-if="form.type && selectedAssetIds.length > 0" class="params-section">
          <div class="section-title">策略参数</div>

          <!-- Recovery: 按资产分组 -->
          <div v-if="form.type === 'recovery'">
            <div class="form-group">
              <label class="form-label">总预算 (¥)</label>
              <input class="form-input" type="number" v-model="globalBudget" placeholder="20000" inputmode="numeric" />
            </div>

            <div v-for="assetId in selectedAssetIds" :key="'r-'+assetId" class="asset-param-group">
              <div class="asset-param-header">
                <span class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</span>
                <span class="asset-param-symbol">{{ getAsset(assetId)?.symbol }}</span>
              </div>

              <div class="sub-section">
                <div class="sub-section-title">📉 补仓线</div>
                <div class="lines-editor">
                  <div v-for="(line, i) in getAssetBuyLines(assetId)" :key="'b'+assetId+'-'+i" class="line-row">
                    <div class="line-field">
                      <span class="line-prefix">≤</span>
                      <input class="form-input" type="number" step="any" v-model="line.price" placeholder="触发价格" inputmode="decimal" />
                    </div>
                    <div class="line-field">
                      <span class="line-prefix">¥</span>
                      <input class="form-input" type="number" step="any" v-model="line.amount" placeholder="买入金额" inputmode="numeric" />
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" @click="removeAssetBuyLine(assetId, i)">✕</button>
                  </div>
                  <button type="button" class="btn btn-sm" @click="addAssetBuyLine(assetId)">+ 补仓线</button>
                </div>
              </div>

              <div class="sub-section">
                <div class="sub-section-title">📈 减仓线</div>
                <div class="lines-editor">
                  <div v-for="(line, i) in getAssetSellLines(assetId)" :key="'s'+assetId+'-'+i" class="line-row">
                    <div class="line-field">
                      <span class="line-prefix">≥</span>
                      <input class="form-input" type="number" step="any" v-model="line.price" placeholder="触发价格" inputmode="decimal" />
                    </div>
                    <div class="line-field">
                      <span class="line-prefix">¥</span>
                      <input class="form-input" type="number" step="any" v-model="line.amount" placeholder="卖出金额" inputmode="numeric" />
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" @click="removeAssetSellLine(assetId, i)">✕</button>
                  </div>
                  <button type="button" class="btn btn-sm" @click="addAssetSellLine(assetId)">+ 减仓线</button>
                </div>
              </div>
            </div>

            <!-- 预算汇总 -->
            <div class="budget-summary" :class="{ over: allocatedBudget > Number(globalBudget) }">
              <span>已分配: ¥{{ allocatedBudget.toLocaleString() }}</span>
              <span>/</span>
              <span>总预算: ¥{{ Number(globalBudget || 0).toLocaleString() }}</span>
              <span v-if="allocatedBudget > Number(globalBudget)" class="budget-warn">⚠️ 超预算</span>
            </div>
          </div>

          <!-- DCA: 按资产分组 -->
          <div v-if="form.type === 'dca'">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">频率</label>
                <select class="form-select" v-model="globalFrequency">
                  <option value="daily">每日</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">期数</label>
                <input class="form-input" type="number" v-model="globalPeriods" placeholder="10" />
              </div>
            </div>

            <div v-for="assetId in selectedAssetIds" :key="'d-'+assetId" class="asset-param-group compact">
              <div class="asset-param-header">
                <span class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</span>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">每期金额 (¥)</label>
                  <input class="form-input" type="number" v-model="getAssetDCA(assetId).amount_per" placeholder="1000" inputmode="numeric" />
                </div>
              </div>
            </div>
          </div>

          <!-- Grid: 按资产分组 -->
          <div v-if="form.type === 'grid'">
            <div class="form-group">
              <label class="form-label">总预算 (¥)</label>
              <input class="form-input" type="number" v-model="globalBudget" placeholder="20000" inputmode="numeric" />
            </div>

            <div v-for="assetId in selectedAssetIds" :key="'g-'+assetId" class="asset-param-group compact">
              <div class="asset-param-header">
                <span class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</span>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">下限</label><input class="form-input" type="number" v-model="getAssetGrid(assetId).low" placeholder="下限价格" inputmode="decimal" /></div>
                <div class="form-group"><label class="form-label">上限</label><input class="form-input" type="number" v-model="getAssetGrid(assetId).high" placeholder="上限价格" inputmode="decimal" /></div>
                <div class="form-group"><label class="form-label">网格数</label><input class="form-input" type="number" v-model="getAssetGrid(assetId).grids" placeholder="5" /></div>
              </div>
            </div>
          </div>

          <!-- Value Avg: 按资产分组 -->
          <div v-if="form.type === 'value_avg'">
            <div class="form-group">
              <label class="form-label">期数</label>
              <input class="form-input" type="number" v-model="globalPeriods" placeholder="10" />
            </div>

            <div v-for="assetId in selectedAssetIds" :key="'v-'+assetId" class="asset-param-group compact">
              <div class="asset-param-header">
                <span class="asset-param-name">{{ getAsset(assetId)?.icon }} {{ getAsset(assetId)?.name }}</span>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">目标市值 (¥)</label><input class="form-input" type="number" v-model="getAssetValueAvg(assetId).target_value" placeholder="50000" inputmode="numeric" /></div>
                <div class="form-group"><label class="form-label">增长率 (%)</label><input class="form-input" type="number" step="0.1" v-model="getAssetValueAvg(assetId).growth_rate_val" placeholder="2" /></div>
              </div>
            </div>
          </div>
        </div>

        <!-- No assets selected hint -->
        <div v-if="form.type && selectedAssetIds.length === 0" class="empty-hint">
          请先选择关联资产
        </div>

        <div style="display:flex;gap:12px;margin-top:16px">
          <button type="submit" class="btn btn-primary" :disabled="submitting || selectedAssetIds.length === 0">{{ submitting ? '创建中...' : (isEdit ? '保存修改' : '创建策略') }}</button>
          <button v-if="isEdit" type="button" class="btn" @click="showAIRegenerate = true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> AI 重新生成</button>
          <router-link to="/strategies" class="btn">取消</router-link>
        </div>
      </form>
    </div>

    <!-- AI Regenerate Drawer -->
    <AppDrawer v-if="isEdit" v-model="showAIRegenerate" title="✨ AI 重新生成策略">
      <AIStrategyGenerator :preset-asset-id="selectedAssetIds[0]" :existing-strategy-id="strategyId" @done="onAIRegenDone" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import AppDrawer from '../components/AppDrawer.vue'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const submitting = ref(false)
const showAIRegenerate = ref(false)
const assets = ref([])
const isEdit = ref(false)
const strategyId = ref(null)
const selectedAssetIds = ref([])
const form = reactive({ name: '', description: '', type: '' })

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
    toast.error('请填写策略名称和类型')
    return
  }
  if (selectedAssetIds.value.length === 0) {
    toast.error('请选择至少一个关联资产')
    return
  }

  // Validate parameters per type
  if (form.type === 'recovery') {
    if (!globalBudget.value || Number(globalBudget.value) <= 0) {
      toast.error('请设置有效的预算金额')
      return
    }
  } else if (form.type === 'grid') {
    for (const id of selectedAssetIds.value) {
      const g = getAssetGrid(id)
      if (!g.low || !g.high || Number(g.low) <= 0 || Number(g.high) <= 0) {
        toast.error(`请为 ${getAsset(id)?.name || '资产'} 设置有效的网格高低价`)
        return
      }
      if (Number(g.low) >= Number(g.high)) {
        toast.error(`${getAsset(id)?.name || '资产'} 的网格低价必须小于高价`)
        return
      }
      if (!g.grids || Number(g.grids) < 2) {
        toast.error(`${getAsset(id)?.name || '资产'} 的网格数必须大于1`)
        return
      }
    }
  } else if (form.type === 'dca') {
    for (const id of selectedAssetIds.value) {
      const d = getAssetDCA(id)
      if (!d.amount_per || Number(d.amount_per) <= 0) {
        toast.error(`请为 ${getAsset(id)?.name || '资产'} 设置有效的定投金额`)
        return
      }
    }
  } else if (form.type === 'value_avg') {
    for (const id of selectedAssetIds.value) {
      const v = getAssetValueAvg(id)
      if (!v.target_value || Number(v.target_value) <= 0) {
        toast.error(`请为 ${getAsset(id)?.name || '资产'} 设置有效的目标市值`)
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
    if (!json.success) return toast.error(json.error || '保存失败')

    toast.success(isEdit.value ? '策略已更新' : '策略已创建')
    router.push(isEdit.value ? `/strategies/${strategyId.value}` : '/strategies')
  } catch (e) { toast.error(e.message) }
  finally { submitting.value = false }
}

function onAIRegenDone(strategyId) {
  showAIRegenerate.value = false
  toast.success('策略已更新')
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
  display: flex;
  gap: 8px;
  align-items: center;
}
.line-field {
  flex: 1;
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
  margin-top: 16px;
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}
</style>
