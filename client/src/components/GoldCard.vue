<template>
  <div class="card" :class="{ loading }">
    <div class="section-title">
      <span class="badge badge-gold">🥇 黄金</span>
    </div>
    <div class="price-big">
      {{ price?.shanghai ? '¥' + price.shanghai : '-' }}
      <span style="font-size:16px;font-weight:400;color:var(--text-dim)">/克</span>
    </div>
    <div class="price-sub">
      伦敦金 {{ price?.london ? '$' + price.london.toFixed(1) : '-' }}/oz
    </div>
    <div class="pnl" :class="pl_pct >= 0 ? 'positive' : 'negative'">
      {{ profit?.pl ? (profit.pl >= 0 ? '+' : '') + formatNum(profit.pl) + '元' : '-' }}
      &nbsp;({{ profit?.pl_pct ? (profit.pl_pct >= 0 ? '+' : '') + profit.pl_pct.toFixed(1) + '%' : '-' }})
    </div>
    <div class="progress-bar">
      <div class="fill" :class="pl_pct >= 0 ? 'green' : 'red'"
        :style="{ width: Math.min(Math.abs(pl_pct) * 3, 100) + '%' }"></div>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim)">
      <div>持仓 {{ holding?.amount }}g</div>
      <div>成本 ¥{{ holding?.cost_per }}/g</div>
      <div style="color:var(--green)">补仓 ¥880</div>
      <div style="color:var(--gold)">减仓 ¥950</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  price: Object,
  profit: Object,
  holding: Object,
  loading: Boolean
})

const pl_pct = computed(() => props.profit?.pl_pct || 0)

function formatNum(n) {
  if (!n && n !== 0) return '-'
  return Math.round(n).toLocaleString()
}
</script>
