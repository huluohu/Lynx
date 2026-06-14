<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">🎯 {{ strategy.name }}</h1>
      <div class="page-actions">
        <button class="btn btn-primary" @click="generatePlan" :disabled="generating">🤖 生成计划</button>
        <router-link :to="`/strategies/${route.params.id}/edit`" class="btn">✏️ 编辑</router-link>
        <button class="btn btn-danger" @click="showDeleteConfirm = true">🗑️ 删除</button>
        <router-link to="/strategies" class="btn">← 返回</router-link>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="section-title">📋 策略信息</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">类型</span><span class="badge badge-buy">{{ typeLabel(strategy.type) }}</span></div>
          <div class="info-row"><span class="info-label">关联资产</span><span>{{ strategy.asset_name || '-' }} {{ strategy.symbol }}</span></div>
          <div class="info-row"><span class="info-label">状态</span><span class="badge" :class="strategy.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ statusLabel(strategy.status) }}</span></div>
          <div class="info-row" v-if="strategy.description"><span class="info-label">描述</span><span style="color:var(--text-dim)">{{ strategy.description }}</span></div>
        </div>
      </div>

      <div class="card">
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
    </div>

    <!-- Plans -->
    <div class="card">
      <div class="section-title">📋 操盘计划 ({{ plans.length }} 步)</div>
      <div v-if="generating" style="text-align:center;padding:24px"><span class="spinner"></span> 生成中...</div>

      <!-- Desktop table -->
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

      <!-- Mobile cards -->
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

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="删除策略"
      :message="`确定要删除策略「${strategy.name}」吗？相关的操盘计划也会被删除。`"
      confirm-text="删除"
      :loading="deleting"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const strategy = ref({})
const plans = ref([])
const generating = ref(false)
const showDeleteConfirm = ref(false)
const deleting = ref(false)

const parsedParams = computed(() => {
  try { return JSON.parse(strategy.value.parameters || '{}') } catch { return null }
})

async function loadData() {
  const res = await api(`/api/strategies/${route.params.id}`)
  const json = await res.json()
  if (json.data) strategy.value = json.data

  const pres = await api(`/api/plans?strategy_id=${route.params.id}`)
  const pjson = await pres.json()
  plans.value = pjson.data || []
}

async function generatePlan() {
  generating.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/generate-plan`, { method: 'POST' })
    const json = await res.json()
    if (json.success) { plans.value = json.data || []; toast.success('计划已生成') }
    else toast.error('生成失败: ' + json.error)
  } catch (e) { toast.error(e.message) }
  generating.value = false
}

async function doDelete() {
  deleting.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { toast.success('策略已删除'); router.push('/strategies') }
    else toast.error(json.error || '删除失败')
  } catch (e) { toast.error(e.message) }
  deleting.value = false
  showDeleteConfirm.value = false
}

function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏', trend:'趋势', rebalance:'再平衡' }[t] || t }
function statusLabel(s) { return { draft:'草稿', active:'活跃', paused:'暂停', closed:'关闭' }[s] || s }
function triggerLabel(t) { return { price_above:'价格 ≥', price_below:'价格 ≤', time:'时间' }[t] || t }
function planStatusLabel(s) { return { pending:'等待', triggered:'⚡触发', executed:'已执行', cancelled:'取消' }[s] || s }
function planStatusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }

onMounted(loadData)
</script>

<style scoped>
.page-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.info-list { font-size: 14px; }
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
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

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .page-actions {
    width: 100%;
    justify-content: stretch;
  }
  .page-actions .btn { flex: 1; justify-content: center; font-size: 12px; padding: 8px 8px; }
}
</style>
