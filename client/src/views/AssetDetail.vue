<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ asset.icon }} {{ asset.name }}</h1>
      <div class="page-actions desktop-only">
        <button class="btn btn-primary" @click="showTxDrawer = true">+ 记录交易</button>
        <button class="btn" @click="showAIDrawer = true">AI 建议</button>
        <button class="btn" @click="showEditDrawer = true">编辑</button>
        <button class="btn btn-danger" @click="showDeleteConfirm = true">删除</button>
        <router-link to="/assets" class="btn">← 返回</router-link>
      </div>
      <button class="btn btn-icon mobile-only" @click="showActions = !showActions">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>

    <!-- Mobile action sheet -->
    <div v-if="showActions" class="action-sheet-overlay" @click="showActions = false"></div>
    <transition name="slide-up">
      <div v-if="showActions" class="action-sheet">
        <div class="action-sheet-item" @click="showTxDrawer = true; showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          记录交易
        </div>
        <div class="action-sheet-item" @click="showAIDrawer = true; showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          AI 策略建议
        </div>
        <div class="action-sheet-item" @click="showEditDrawer = true; showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          编辑资产
        </div>
        <div class="action-sheet-item danger" @click="showDeleteConfirm = true; showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          删除资产
        </div>
        <div class="action-sheet-cancel" @click="showActions = false">取消</div>
      </div>
    </transition>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="section-title">📋 基本信息</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">代码</span><span style="color:var(--text-dim)">{{ asset.symbol }}</span></div>
          <div class="info-row"><span class="info-label">类型</span><span class="badge" :class="typeBadge(asset.type)">{{ asset.type }}</span></div>
          <div class="info-row"><span class="info-label">计价货币</span><span>{{ asset.currency }}</span></div>
          <div class="info-row"><span class="info-label">数据源</span><span style="color:var(--text-dim)">{{ asset.data_source || '自动' }}</span></div>
        </div>
      </div>

      <div class="card" v-if="holding">
        <div class="section-title">📦 持仓信息</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">持仓数量</span><span style="font-weight:600">{{ holding.quantity }}</span></div>
          <div class="info-row"><span class="info-label">成本价</span><span>¥{{ fmt(holding.avg_cost) }}</span></div>
          <div class="info-row"><span class="info-label">总投入</span><span>¥{{ fmt(holding.total_invested) }}</span></div>
          <div class="info-row"><span class="info-label">目标价</span><span>{{ holding.target_price ? '¥'+holding.target_price : '-' }}</span></div>
          <div class="info-row"><span class="info-label">止损线</span><span style="color:var(--red)">{{ holding.stop_loss ? '¥'+holding.stop_loss : '-' }}</span></div>
        </div>
      </div>
    </div>

    <!-- 交易记录 -->
    <div class="card">
      <div class="section-title">📝 交易记录</div>
      <!-- Desktop -->
      <table v-if="transactions.length" class="hide-mobile">
        <thead><tr><th>时间</th><th>类型</th><th>数量</th><th>价格</th><th>金额</th><th>手续费</th></tr></thead>
        <tbody>
          <tr v-for="t in transactions" :key="t.id">
            <td>{{ t.executed_at?.slice(0,10) }}</td>
            <td><span class="badge" :class="t.type==='buy'?'badge-buy':'badge-sell'">{{ t.type==='buy'?'买入':'卖出' }}</span></td>
            <td>{{ t.quantity }}</td>
            <td>¥{{ t.price }}</td>
            <td :class="t.type==='buy'?'pnl negative':'pnl positive'">¥{{ fmt(t.total) }}</td>
            <td>¥{{ fmt(t.fee) }}</td>
          </tr>
        </tbody>
      </table>
      <!-- Mobile cards -->
      <div v-if="transactions.length" class="show-mobile tx-cards">
        <div v-for="t in transactions" :key="t.id" class="tx-card">
          <div class="tx-card-top">
            <span class="badge" :class="t.type==='buy'?'badge-buy':'badge-sell'">{{ t.type==='buy'?'买入':'卖出' }}</span>
            <span style="color:var(--text-muted);font-size:12px">{{ t.executed_at?.slice(0,10) }}</span>
          </div>
          <div class="tx-card-body">
            <span>{{ t.quantity }} × ¥{{ t.price }}</span>
            <span :class="t.type==='buy'?'pnl negative':'pnl positive'" style="font-weight:600">¥{{ fmt(t.total) }}</span>
          </div>
        </div>
      </div>
      <div v-if="!transactions.length" class="empty" style="padding:24px"><p>暂无交易记录</p></div>
    </div>

    <!-- Transaction Drawer -->
    <AppDrawer v-model="showTxDrawer" title="记录交易">
      <TransactionForm :asset-id="route.params.id" @success="onTxSuccess" @cancel="showTxDrawer = false" />
    </AppDrawer>

    <!-- Edit Drawer -->
    <AppDrawer v-model="showEditDrawer" title="编辑资产">
      <form @submit.prevent="saveEdit">
        <div class="form-group"><label class="form-label">名称</label><input class="form-input" v-model="editForm.name" required /></div>
        <div class="form-group"><label class="form-label">代码</label><input class="form-input" v-model="editForm.symbol" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">类型</label>
            <select class="form-select" v-model="editForm.type">
              <option value="gold">黄金</option><option value="crypto">加密货币</option><option value="stock">股票</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">货币</label><input class="form-input" v-model="editForm.currency" /></div>
        </div>
        <div class="form-group"><label class="form-label">图标</label><input class="form-input" v-model="editForm.icon" /></div>
        <div class="form-group"><label class="form-label">数据源</label><input class="form-input" v-model="editForm.data_source" placeholder="自动" /></div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
          <button type="button" class="btn" @click="showEditDrawer = false">取消</button>
        </div>
      </form>
    </AppDrawer>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="删除资产"
      :message="`确定要删除「${asset.name}」吗？相关持仓和交易记录将一并删除。`"
      confirm-text="删除"
      :loading="deleting"
      @confirm="doDelete"
    />

    <!-- AI Drawer -->
    <AppDrawer v-model="showAIDrawer" title="🤖 AI 策略建议">
      <AIStrategyGenerator :preset-asset-id="route.params.id" @done="showAIDrawer = false" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import AppDrawer from '../components/AppDrawer.vue'
import TransactionForm from '../components/TransactionForm.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const asset = ref({})
const holding = ref(null)
const transactions = ref([])
const showTxDrawer = ref(false)
const showEditDrawer = ref(false)
const showAIDrawer = ref(false)
const showDeleteConfirm = ref(false)
const showActions = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editForm = reactive({ name: '', symbol: '', type: '', currency: '', icon: '', data_source: '' })

async function loadData() {
  const res = await api(`/api/assets/${route.params.id}`)
  const json = await res.json()
  if (json.data) {
    asset.value = json.data
    holding.value = json.data.quantity ? json.data : null
    Object.assign(editForm, { name: json.data.name, symbol: json.data.symbol, type: json.data.type, currency: json.data.currency, icon: json.data.icon || '', data_source: json.data.data_source || '' })
  }
  const tres = await api(`/api/transactions?asset_id=${route.params.id}`)
  const tjson = await tres.json()
  transactions.value = tjson.data || []
}

function onTxSuccess() {
  showTxDrawer.value = false
  toast.success('交易已记录')
  loadData()
}

async function saveEdit() {
  saving.value = true
  try {
    const res = await api(`/api/assets/${route.params.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
    const json = await res.json()
    if (json.success) { toast.success('已更新'); showEditDrawer.value = false; loadData() }
    else toast.error(json.error || '保存失败')
  } catch (e) { toast.error(e.message) }
  saving.value = false
}

async function doDelete() {
  deleting.value = true
  try {
    const res = await api(`/api/assets/${route.params.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { toast.success('已删除'); router.push('/assets') }
    else toast.error(json.error || '删除失败')
  } catch (e) { toast.error(e.message) }
  deleting.value = false
  showDeleteConfirm.value = false
}

function typeBadge(type) {
  return { gold: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
}
function fmt(n) {
  if (!n && n !== 0) return '0'
  return Number(n).toLocaleString()
}

onMounted(loadData)
</script>

<style scoped>
.page-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }

.hide-mobile { display: table; }
.show-mobile { display: none !important; }

.tx-cards { flex-direction: column; gap: 8px; }
.tx-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.tx-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.tx-card-body { display: flex; justify-content: space-between; font-size: 14px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .page-actions { width: 100%; }
  .page-actions .btn { flex: 1; justify-content: center; font-size: 12px; }
}
</style>
