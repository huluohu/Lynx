<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">🎯 {{ strategy.name }}</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" @click="generatePlan" :disabled="generating">🤖 生成操盘计划</button>
        <router-link to="/strategies" class="btn">← 返回</router-link>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="section-title">📋 策略信息</div>
        <div style="font-size:14px">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">类型</span><span class="badge badge-buy">{{ typeLabel(strategy.type) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">关联资产</span><span>{{ strategy.asset_name || '-' }} {{ strategy.symbol }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">状态</span><span class="badge" :class="strategy.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ strategy.status }}</span>
          </div>
          <div style="padding:6px 0" v-if="strategy.description">
            <span class="form-label" style="margin:0;display:block">{{ strategy.description }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">⚙️ 参数</div>
        <pre style="font-size:12px;color:var(--text-dim);white-space:pre-wrap">{{ paramsJson }}</pre>
      </div>
    </div>

    <!-- Plans -->
    <div class="card">
      <div class="section-title">📋 操盘计划 ({{ plans.length }} 步)</div>
      <div v-if="generating" style="text-align:center;padding:24px"><span class="spinner"></span> 生成中...</div>
      <table v-else-if="plans.length">
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
            <td><span class="badge" :class="statusBadge(p.status)">{{ statusLabel(p.status) }}</span></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty" style="padding:24px"><p>点击"生成操盘计划"来创建执行步骤</p></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const strategy = ref({})
const plans = ref([])
const generating = ref(false)

const paramsJson = computed(() => {
  try { return JSON.stringify(JSON.parse(strategy.value.parameters || '{}'), null, 2) } catch { return strategy.value.parameters }
})

async function fetch() {
  const res = await fetch(`/api/strategies/${route.params.id}`)
  const json = await res.json()
  if (json.data) strategy.value = json.data

  const pres = await fetch(`/api/plans?strategy_id=${route.params.id}`)
  const pjson = await pres.json()
  plans.value = pjson.data || []
}

async function generatePlan() {
  generating.value = true
  try {
    const res = await fetch(`/api/strategies/${route.params.id}/generate-plan`, { method: 'POST' })
    const json = await res.json()
    if (json.success) plans.value = json.data || []
    else alert('生成失败: ' + json.error)
  } catch (e) { alert('生成失败: ' + e.message) }
  generating.value = false
}

function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏' }[t] || t }
function triggerLabel(t) { return { price_above:'价格上涨至', price_below:'价格下跌至', time:'时间' }[t] || t }
function statusLabel(s) { return { pending:'等待', triggered:'⚡触发', executed:'已执行', cancelled:'取消' }[s] || s }
function statusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }

onMounted(fetch)
</script>
