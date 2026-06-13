<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">📝 操盘历史</h1>
      <button class="btn btn-primary" @click="showForm = true">+ 添加记录</button>
    </div>

    <!-- Add form -->
    <div class="card" v-if="showForm" style="max-width:540px;margin-bottom:20px">
      <div class="section-title">记录交易</div>
      <form @submit.prevent="addRecord">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">资产</label>
            <select class="form-select" v-model="form.asset_id" required>
              <option value="">选择资产</option>
              <option v-for="a in assets" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">类型</label>
            <select class="form-select" v-model="form.type" required>
              <option value="buy">买入</option>
              <option value="sell">卖出</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">数量</label><input class="form-input" type="number" step="any" v-model="form.quantity" required /></div>
          <div class="form-group"><label class="form-label">价格</label><input class="form-input" type="number" step="any" v-model="form.price" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">总金额</label><input class="form-input" type="number" step="any" v-model="form.total" /></div>
          <div class="form-group"><label class="form-label">日期</label><input class="form-input" type="date" v-model="form.executed_at" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">盈亏</label><input class="form-input" type="number" step="any" v-model="form.pnl" /></div>
          <div class="form-group"><label class="form-label">盈亏 %</label><input class="form-input" type="number" step="any" v-model="form.pnl_pct" /></div>
        </div>
        <div class="form-group"><label class="form-label">原因/复盘</label><textarea class="form-textarea" v-model="form.reason" placeholder="为什么操作..."></textarea></div>
        <div style="display:flex;gap:12px">
          <button type="submit" class="btn btn-primary" :disabled="submitting">保存</button>
          <button type="button" class="btn" @click="showForm=false">取消</button>
        </div>
      </form>
    </div>

    <div class="card" v-if="history.length">
      <table class="hide-mobile">
        <thead><tr><th>日期</th><th>资产</th><th>类型</th><th>数量</th><th>价格</th><th>金额</th><th>盈亏</th><th>原因</th></tr></thead>
        <tbody>
          <tr v-for="h in history" :key="h.id">
            <td>{{ h.executed_at?.slice(0,10) }}</td>
            <td>{{ h.asset_name }}</td>
            <td><span class="badge" :class="h.type==='buy'?'badge-buy':'badge-sell'">{{ h.type==='buy'?'买入':'卖出' }}</span></td>
            <td>{{ h.quantity }}</td>
            <td>¥{{ h.price }}</td>
            <td>¥{{ fmt(h.total) }}</td>
            <td :class="(h.pnl||0)>=0?'pnl positive':'pnl negative'">{{ h.pnl ? (h.pnl>=0?'+':'')+'¥'+fmt(Math.abs(h.pnl)) : '-' }}</td>
            <td style="font-size:12px;color:var(--text-dim);max-width:150px">{{ h.reason || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile history-cards">
        <div v-for="h in history" :key="h.id" class="history-card">
          <div class="history-card-header">
            <span class="badge" :class="h.type==='buy'?'badge-buy':'badge-sell'">{{ h.type==='buy'?'买入':'卖出' }}</span>
            <span style="font-weight:600">{{ h.asset_name }}</span>
            <span style="color:var(--text-muted);font-size:12px;margin-left:auto">{{ h.executed_at?.slice(0,10) }}</span>
          </div>
          <div class="history-card-body">
            <span>{{ h.quantity }} × ¥{{ h.price }}</span>
            <span>= ¥{{ fmt(h.total) }}</span>
            <span v-if="h.pnl" :class="(h.pnl||0)>=0?'pnl positive':'pnl negative'">{{ h.pnl>=0?'+':''}}\¥{{ fmt(Math.abs(h.pnl)) }}</span>
          </div>
          <div v-if="h.reason" class="history-card-reason">{{ h.reason }}</div>
        </div>
      </div>
    </div>
    <div v-else class="card empty"><div class="empty-icon">📝</div><p>暂无历史记录</p></div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../utils/api.js'

const history = ref([])
const assets = ref([])
const showForm = ref(false)
const submitting = ref(false)
const form = reactive({ asset_id: '', type: 'buy', quantity: '', price: '', total: '', pnl: '', pnl_pct: '', executed_at: new Date().toISOString().slice(0,10), reason: '' })

async function loadData() {
  const [hres, ares] = await Promise.all([api('/api/history'), api('/api/assets')])
  history.value = (await hres.json()).data || []
  assets.value = (await ares.json()).data || []
}
async function addRecord() {
  submitting.value = true
  try {
    const body = {
      asset_id: Number(form.asset_id),
      type: form.type,
      quantity: Number(form.quantity),
      price: Number(form.price),
      total: Number(form.total) || Number(form.quantity) * Number(form.price),
      executed_at: form.executed_at,
      reason: form.reason,
      pnl: form.pnl ? Number(form.pnl) : null,
      pnl_pct: form.pnl_pct ? Number(form.pnl_pct) : null,
    }
    await api('/api/history', { method:'POST', body:JSON.stringify(body) })
    showForm.value = false
    loadData()
  } catch (e) { alert('保存失败') }
  submitting.value = false
}
function fmt(n) {
  if (!n && n!==0) return '0'
  return Math.round(Number(n)).toLocaleString()
}
onMounted(loadData)
</script>

<style scoped>
.hide-mobile { display: table; }
.show-mobile { display: none !important; }
.history-cards { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.history-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.history-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.history-card-body { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.history-card-reason { margin-top: 6px; font-size: 12px; color: var(--text-dim); }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
