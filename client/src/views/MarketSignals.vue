<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">市场信号</h1>
      <button class="btn" @click="refreshSignals" :disabled="loading">{{ loading ? '分析中...' : '刷新信号' }}</button>
    </div>

    <div v-if="!initialized" class="grid-2">
      <div v-for="i in 4" :key="i" class="card skeleton-card">
        <div class="skeleton skeleton-text short" style="width:120px;margin-bottom:10px"></div>
        <div class="skeleton skeleton-badge" style="margin-bottom:10px"></div>
        <div class="skeleton skeleton-text" style="width:100%;margin-bottom:8px"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    </div>

    <div v-else-if="signals.length" class="grid-2">
      <div v-for="signal in signals" :key="signal.id" class="card signal-card">
        <div class="signal-head">
          <div>
            <div class="signal-name">{{ signal.icon }} {{ signal.asset_name }}</div>
            <div class="signal-meta">{{ signal.symbol }} · {{ signal.type }}</div>
          </div>
          <div class="signal-status">
            <span class="badge" :class="signalBadgeClass(signal.signal_type)">{{ signalLabel(signal.signal_type) }}</span>
            <div class="strength-wrap">
              <span class="strength-label">强度 {{ signal.strength }}/10</span>
              <div class="strength-bar"><div class="strength-fill" :class="signal.signal_type" :style="{ width: `${Math.max(10, signal.strength * 10)}%` }"></div></div>
            </div>
          </div>
        </div>

        <div class="signal-summary">{{ signal.summary }}</div>

        <details class="signal-details">
          <summary>技术指标</summary>
          <div class="indicator-grid">
            <div class="indicator-item"><span>MA5</span><b>{{ fmtIndicator(signal.indicators?.ma5) }}</b></div>
            <div class="indicator-item"><span>MA20</span><b>{{ fmtIndicator(signal.indicators?.ma20) }}</b></div>
            <div class="indicator-item"><span>RSI</span><b>{{ fmtIndicator(signal.indicators?.rsi14) }}</b></div>
            <div class="indicator-item"><span>波动率</span><b>{{ fmtIndicator(signal.indicators?.volatility_pct, '%') }}</b></div>
            <div class="indicator-item"><span>1日涨跌</span><b>{{ fmtIndicator(signal.indicators?.change_1d_pct, '%') }}</b></div>
            <div class="indicator-item"><span>7日涨跌</span><b>{{ fmtIndicator(signal.indicators?.change_7d_pct, '%') }}</b></div>
          </div>
        </details>

        <div class="signal-analysis">
          <div class="detail-title">AI分析</div>
          <div class="signal-analysis-text">{{ signal.ai_analysis || '暂无 AI 补充分析' }}</div>
        </div>

        <div class="signal-footer">
          <span>有效期至 {{ fmtTime(signal.valid_until) }}</span>
          <span>{{ fmtTime(signal.created_at) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="card empty">
      <div class="empty-icon">📡</div>
      <p>还没有市场信号，点击上方“刷新信号”开始分析。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const toast = useToast()
const signals = ref([])
const loading = ref(false)
const initialized = ref(false)

async function loadSignals() {
  loading.value = true
  try {
    const res = await api('/api/signals/latest')
    const json = await res.json()
    signals.value = json.data || []
  } catch (e) {
    toast.error(e.message || '获取信号失败')
  }
  loading.value = false
  initialized.value = true
}

async function refreshSignals() {
  loading.value = true
  try {
    const res = await api('/api/signals/analyze', { method: 'POST', body: JSON.stringify({}) })
    const json = await res.json()
    if (json.success) {
      signals.value = json.data || []
      toast.success(`已刷新 ${signals.value.length} 条市场信号`)
    } else {
      toast.error(json.error || '刷新失败')
    }
  } catch (e) {
    toast.error(e.message || '刷新失败')
  }
  loading.value = false
  initialized.value = true
}

function signalLabel(type) { return { bullish: '看涨', bearish: '看跌', neutral: '中性' }[type] || '中性' }
function signalBadgeClass(type) {
  return { bullish: 'badge-buy', bearish: 'badge-sell', neutral: 'badge-pending' }[type] || 'badge-pending'
}
function fmtIndicator(value, suffix = '') {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}${suffix}` : '-'
}
function fmtTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '-'
}

onMounted(loadSignals)
</script>

<style scoped>
.signal-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.signal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.signal-name {
  font-size: 16px;
  font-weight: 700;
}
.signal-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.signal-status {
  min-width: 110px;
}
.strength-wrap {
  margin-top: 8px;
}
.strength-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.strength-bar {
  height: 6px;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  overflow: hidden;
}
.strength-fill {
  height: 100%;
  border-radius: 999px;
}
.strength-fill.bullish { background: var(--green); }
.strength-fill.bearish { background: var(--red); }
.strength-fill.neutral { background: var(--text-muted); }
.signal-summary {
  font-size: 14px;
  line-height: 1.7;
}
.signal-details summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--text-dim);
}
.indicator-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.indicator-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-dim);
}
.signal-analysis {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.detail-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 8px;
}
.signal-analysis-text {
  line-height: 1.7;
  color: var(--text-dim);
  white-space: pre-wrap;
}
.signal-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .signal-head,
  .signal-footer {
    flex-direction: column;
  }
  .indicator-grid {
    grid-template-columns: 1fr;
  }
}
</style>
