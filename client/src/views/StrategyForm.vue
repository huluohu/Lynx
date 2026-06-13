<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">🎯 创建策略</h1>
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
            <label class="form-label">关联资产</label>
            <select class="form-select" v-model="form.asset_id">
              <option :value="null">不关联</option>
              <option v-for="a in assets" :key="a.id" :value="a.id">{{ a.icon }} {{ a.name }}</option>
            </select>
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
          <div class="section-title" style="margin-top:8px;font-size:12px">补仓线 (JSON格式: [{"price":880,"amount":8800},{"price":860,"amount":12000}])</div>
          <div class="form-group"><textarea class="form-textarea" v-model="buyLinesText" placeholder='[{"price":880,"amount":8800}]' style="font-size:12px;font-family:monospace"></textarea></div>
          <div class="section-title" style="font-size:12px">减仓线 (JSON格式: [{"price":950,"amount":9500}])</div>
          <div class="form-group"><textarea class="form-textarea" v-model="sellLinesText" placeholder='[{"price":950,"amount":9500}]' style="font-size:12px;font-family:monospace"></textarea></div>
        </div>

        <div style="display:flex;gap:12px;margin-top:16px">
          <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? '创建中...' : '创建策略' }}</button>
          <router-link to="/strategies" class="btn">取消</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const submitting = ref(false)
const assets = ref([])
const form = reactive({ name: '', description: '', type: '', asset_id: null })
const params = reactive({ amount_per: 1000, periods: 10, frequency: 'weekly', low: 800, high: 1200, grids: 5, target_value: 50000, growth_rate_val: 2, budget: 20000 })
const buyLinesText = ref('')
const sellLinesText = ref('')

function onTypeChange() {
  // reset defaults
}

async function submit() {
  submitting.value = true
  try {
    // Build params based on type
    let p = {}
    if (form.type === 'dca') p = { amount_per: Number(params.amount_per), periods: Number(params.periods), frequency: params.frequency }
    else if (form.type === 'grid') p = { low: Number(params.low), high: Number(params.high), grids: Number(params.grids), budget: Number(params.budget) || 20000 }
    else if (form.type === 'value_avg') p = { target_value: Number(params.target_value), periods: Number(params.periods), growth_rate: Number(params.growth_rate_val) / 100 }
    else if (form.type === 'recovery') {
      p = { budget: Number(params.budget) || 20000 }
      try { p.buy_lines = JSON.parse(buyLinesText.value || '[]') } catch { p.buy_lines = [] }
      try { p.sell_lines = JSON.parse(sellLinesText.value || '[]') } catch { p.sell_lines = [] }
    }

    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description, type: form.type, asset_id: form.asset_id, parameters: p })
    })
    const json = await res.json()
    if (!json.success) return alert('创建失败: ' + json.error)

    router.push('/strategies')
  } catch (e) { alert('创建失败: ' + e.message) }
  submitting.value = false
}

onMounted(async () => {
  const res = await fetch('/api/assets')
  const json = await res.json()
  assets.value = json.data || []
})
</script>
