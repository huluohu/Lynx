<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">🎯 {{ isEdit ? '编辑策略' : '创建策略' }}</h1>
    </div>

    <div class="card" style="max-width:640px">
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
            </select>
          </div>
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
        </div>

        <!-- 动态参数 -->
        <div class="section-title" style="margin-top:8px">⚙️ 策略参数</div>

        <!-- DCA -->
        <div v-if="form.type === 'dca'" class="form-row">
          <div class="form-group"><label class="form-label">每期金额 (¥)</label><input class="form-input" type="number" v-model="params.amount_per" placeholder="1000" /></div>
          <div class="form-group"><label class="form-label">期数</label><input class="form-input" type="number" v-model="params.periods" placeholder="10" /></div>
          <div class="form-group">
            <label class="form-label">频率</label>
            <select class="form-select" v-model="params.frequency">
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
        </div>

        <!-- Grid -->
        <div v-if="form.type === 'grid'" class="form-row">
          <div class="form-group"><label class="form-label">下限</label><input class="form-input" type="number" v-model="params.low" placeholder="800" /></div>
          <div class="form-group"><label class="form-label">上限</label><input class="form-input" type="number" v-model="params.high" placeholder="1200" /></div>
          <div class="form-group"><label class="form-label">网格数</label><input class="form-input" type="number" v-model="params.grids" placeholder="5" /></div>
        </div>

        <!-- Value Avg -->
        <div v-if="form.type === 'value_avg'" class="form-row">
          <div class="form-group"><label class="form-label">目标市值 (¥)</label><input class="form-input" type="number" v-model="params.target_value" placeholder="50000" /></div>
          <div class="form-group"><label class="form-label">期数</label><input class="form-input" type="number" v-model="params.periods" placeholder="10" /></div>
          <div class="form-group"><label class="form-label">增长率 (%)</label><input class="form-input" type="number" step="0.1" v-model="params.growth_rate_val" placeholder="2" /></div>
        </div>

        <!-- Recovery -->
        <div v-if="form.type === 'recovery'">
          <div class="form-group"><label class="form-label">可用预算 (¥)</label><input class="form-input" type="number" v-model="params.budget" placeholder="20000" /></div>

          <div class="section-title" style="margin-top:12px">📉 补仓线</div>
          <div class="lines-editor">
            <div v-for="(line, i) in buyLines" :key="'b'+i" class="line-row">
              <div class="form-group" style="margin:0;flex:1"><input class="form-input" type="number" step="any" v-model="line.price" placeholder="触发价格" /></div>
              <div class="form-group" style="margin:0;flex:1"><input class="form-input" type="number" step="any" v-model="line.amount" placeholder="买入金额" /></div>
              <button type="button" class="btn btn-sm btn-danger" @click="buyLines.splice(i,1)">✕</button>
            </div>
            <button type="button" class="btn btn-sm" @click="buyLines.push({price:'',amount:''})">+ 添加补仓线</button>
          </div>

          <div class="section-title" style="margin-top:12px">📈 减仓线</div>
          <div class="lines-editor">
            <div v-for="(line, i) in sellLines" :key="'s'+i" class="line-row">
              <div class="form-group" style="margin:0;flex:1"><input class="form-input" type="number" step="any" v-model="line.price" placeholder="触发价格" /></div>
              <div class="form-group" style="margin:0;flex:1"><input class="form-input" type="number" step="any" v-model="line.amount" placeholder="卖出金额" /></div>
              <button type="button" class="btn btn-sm btn-danger" @click="sellLines.splice(i,1)">✕</button>
            </div>
            <button type="button" class="btn btn-sm" @click="sellLines.push({price:'',amount:''})">+ 添加减仓线</button>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:16px">
          <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? '创建中...' : (isEdit ? '保存修改' : '创建策略') }}</button>
          <router-link to="/strategies" class="btn">取消</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const submitting = ref(false)
const assets = ref([])
const isEdit = ref(false)
const strategyId = ref(null)
const selectedAssetIds = ref([])
const form = reactive({ name: '', description: '', type: '' })
const params = reactive({ amount_per: 1000, periods: 10, frequency: 'weekly', low: 800, high: 1200, grids: 5, target_value: 50000, growth_rate_val: 2, budget: 20000 })
const buyLines = reactive([])
const sellLines = reactive([])

function toggleAsset(id) {
  const idx = selectedAssetIds.value.indexOf(id)
  if (idx >= 0) selectedAssetIds.value.splice(idx, 1)
  else selectedAssetIds.value.push(id)
}

function onTypeChange() {
  // reset defaults
}

async function submit() {
  submitting.value = true
  try {
    let p = {}
    if (form.type === 'dca') p = { amount_per: Number(params.amount_per), periods: Number(params.periods), frequency: params.frequency }
    else if (form.type === 'grid') p = { low: Number(params.low), high: Number(params.high), grids: Number(params.grids), budget: Number(params.budget) || 20000 }
    else if (form.type === 'value_avg') p = { target_value: Number(params.target_value), periods: Number(params.periods), growth_rate: Number(params.growth_rate_val) / 100 }
    else if (form.type === 'recovery') {
      p = { budget: Number(params.budget) || 20000 }
      p.buy_lines = buyLines.filter(l => l.price).map(l => ({ price: Number(l.price), amount: Number(l.amount) }))
      p.sell_lines = sellLines.filter(l => l.price).map(l => ({ price: Number(l.price), amount: Number(l.amount) }))
    }

    const url = isEdit.value ? `/api/strategies/${strategyId.value}` : '/api/strategies'
    const method = isEdit.value ? 'PUT' : 'POST'
    const body = {
      name: form.name, description: form.description, type: form.type, parameters: p,
      asset_id: selectedAssetIds.value[0] || null,
      asset_ids: selectedAssetIds.value.length > 0 ? selectedAssetIds.value : undefined,
    }
    const res = await api(url, {
      method,
      body: JSON.stringify(body)
    })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || '保存失败')

    toast.success(isEdit.value ? '策略已更新' : '策略已创建')
    router.push(isEdit.value ? `/strategies/${strategyId.value}` : '/strategies')
  } catch (e) { toast.error(e.message) }
  submitting.value = false
}

onMounted(async () => {
  const res = await api('/api/assets')
  const json = await res.json()
  assets.value = json.data || []

  // Edit mode: load existing strategy
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
      try {
        const p = JSON.parse(s.parameters || '{}')
        if (s.type === 'dca') { params.amount_per = p.amount_per; params.periods = p.periods; params.frequency = p.frequency }
        else if (s.type === 'grid') { params.low = p.low; params.high = p.high; params.grids = p.grids; params.budget = p.budget }
        else if (s.type === 'value_avg') { params.target_value = p.target_value; params.periods = p.periods; params.growth_rate_val = (p.growth_rate || 0) * 100 }
        else if (s.type === 'recovery') {
          params.budget = p.budget
          if (p.buy_lines) p.buy_lines.forEach(l => buyLines.push({ price: l.price, amount: l.amount }))
          if (p.sell_lines) p.sell_lines.forEach(l => sellLines.push({ price: l.price, amount: l.amount }))
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
.lines-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.line-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
