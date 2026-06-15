<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">操盘历史</h1>
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
        <thead><tr><th>日期</th><th>资产</th><th>类型</th><th>数量</th><th>价格</th><th>金额</th><th>盈亏</th></tr></thead>
        <tbody>
          <tr v-for="h in history" :key="h.id" style="cursor:pointer" @click="openDetail(h)">
            <td>{{ h.executed_at?.slice(0,10) }}</td>
            <td>{{ h.asset_name }}</td>
            <td><span class="badge" :class="h.type==='buy'?'badge-buy':'badge-sell'">{{ h.type==='buy'?'买入':'卖出' }}</span></td>
            <td>{{ h.quantity }}</td>
            <td>¥{{ h.price }}</td>
            <td>¥{{ fmt(h.total) }}</td>
            <td :class="(h.pnl||0)>=0?'pnl positive':'pnl negative'">{{ h.pnl ? (h.pnl>=0?'+':'')+'¥'+fmt(Math.abs(h.pnl)) : '-' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile history-cards">
        <div v-for="h in history" :key="h.id" class="history-card" @click="openDetail(h)">
          <div class="history-card-header">
            <span class="badge" :class="h.type==='buy'?'badge-buy':'badge-sell'">{{ h.type==='buy'?'买入':'卖出' }}</span>
            <span style="font-weight:600">{{ h.asset_name }}</span>
            <span style="color:var(--text-muted);font-size:12px;margin-left:auto">{{ h.executed_at?.slice(0,10) }}</span>
          </div>
          <div class="history-card-body">
            <span>{{ h.quantity }} × ¥{{ h.price }}</span>
            <span>= ¥{{ fmt(h.total) }}</span>
            <span v-if="h.pnl" :class="(h.pnl||0)>=0?'pnl positive':'pnl negative'">{{ h.pnl>=0?'+':''}}¥{{ fmt(Math.abs(h.pnl)) }}</span>
          </div>
          <div v-if="h.reason" class="history-card-reason">{{ h.reason }}</div>
        </div>
      </div>
    </div>
    <div v-else class="card empty"><div class="empty-icon">📝</div><p>暂无历史记录</p></div>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetailDrawer" :title="detailRecord ? `${detailRecord.asset_name} - ${detailRecord.type==='buy'?'买入':'卖出'}` : '交易详情'">
      <div v-if="detailRecord" class="detail-drawer-content">
        <div class="detail-section">
          <div class="detail-row"><span>资产</span><span style="font-weight:600">{{ detailRecord.asset_name }}</span></div>
          <div class="detail-row"><span>类型</span><span class="badge" :class="detailRecord.type==='buy'?'badge-buy':'badge-sell'">{{ detailRecord.type==='buy'?'买入':'卖出' }}</span></div>
          <div class="detail-row"><span>日期</span><span>{{ detailRecord.executed_at?.slice(0,10) }}</span></div>
        </div>
        <div class="detail-section">
          <div class="detail-section-title">交易数据</div>
          <div class="detail-row"><span>数量</span><b>{{ detailRecord.quantity }}</b></div>
          <div class="detail-row"><span>价格</span><span>¥{{ detailRecord.price }}</span></div>
          <div class="detail-row"><span>总金额</span><span>¥{{ fmt(detailRecord.total) }}</span></div>
          <div class="detail-row" v-if="detailRecord.pnl"><span>盈亏</span><span :class="(detailRecord.pnl||0)>=0?'pnl positive':'pnl negative'">{{ detailRecord.pnl>=0?'+':'' }}¥{{ fmt(Math.abs(detailRecord.pnl)) }}</span></div>
          <div class="detail-row" v-if="detailRecord.pnl_pct"><span>盈亏率</span><span :class="(detailRecord.pnl_pct||0)>=0?'pnl positive':'pnl negative'">{{ detailRecord.pnl_pct>=0?'+':'' }}{{ detailRecord.pnl_pct }}%</span></div>
        </div>
        <div v-if="detailRecord.reason" class="detail-section">
          <div class="detail-section-title">操作原因/复盘</div>
          <div style="padding:10px 14px;font-size:14px;color:var(--text-dim);line-height:1.5">{{ detailRecord.reason }}</div>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../utils/api.js'
import AppDrawer from '../components/AppDrawer.vue'

const history = ref([])
const assets = ref([])
const showForm = ref(false)
const submitting = ref(false)
const showDetailDrawer = ref(false)
const detailRecord = ref(null)
const form = reactive({ asset_id: '', type: 'buy', quantity: '', price: '', total: '', pnl: '', pnl_pct: '', executed_at: new Date().toISOString().slice(0,10), reason: '' })

async function loadData() {
  const [hres, ares] = await Promise.all([api('/api/history'), api('/api/assets')])
  history.value = (await hres.json()).data || []
  assets.value = (await ares.json()).data || []
}

function openDetail(h) {
  detailRecord.value = h
  showDetailDrawer.value = true
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
    const res = await api('/api/history', { method:'POST', body:JSON.stringify(body) })
    const json = await res.json()
    if (!json.success) { alert('保存失败: ' + (json.error || '未知错误')); return }
    showForm.value = false
    loadData()
  } catch (e) { alert('保存失败: ' + e.message) }
  finally { submitting.value = false }
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
.history-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; cursor: pointer; transition: background 0.15s; }
.history-card:hover { background: var(--bg-hover); }
.history-card:active { background: var(--bg-hover); }
.history-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.history-card-body { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.history-card-reason { margin-top: 6px; font-size: 12px; color: var(--text-dim); }

.detail-drawer-content { display: flex; flex-direction: column; gap: 16px; }
.detail-section { background: var(--bg); border-radius: 10px; padding: 4px 0; }
.detail-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); padding: 8px 14px 4px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 14px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
