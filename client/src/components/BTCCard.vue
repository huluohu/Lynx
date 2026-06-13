<template>
  <div class="card" :class="{ loading }">
    <div class="section-title">
      <span class="badge badge-btc">₿ 比特币</span>
    </div>
    <div class="price-big">
      {{ price?.usd ? '$' + price.usd.toLocaleString() : '-' }}
    </div>
    <div class="price-sub">
      约 {{ price?.cny ? '¥' + price.cny.toLocaleString() : '-' }} / 枚
      <span :class="price?.ch24 > 0 ? 'positive' : 'negative'" style="margin-left:8px">
        {{ price?.ch24 ? '24h ' + (price.ch24 >= 0 ? '+' : '') + price.ch24.toFixed(2) + '%' : '' }}
      </span>
    </div>
    <div class="pnl" :class="pl_pct >= 0 ? 'positive' : 'negative'">
      {{ profit?.pl ? (profit.pl >= 0 ? '+' : '') + formatNum(profit.pl) + '元' : '-' }}
      &nbsp;({{ profit?.pl_pct ? (profit.pl_pct >= 0 ? '+' : '') + profit.pl_pct.toFixed(1) + '%' : '-' }})
    </div>
    <div class="progress-bar">
      <div class="fill" :class="pl_pct >= 0 ? 'green' : 'red'"
        :style="{ width: Math.min(Math.abs(pl_pct) * 2, 100) + '%' }"></div>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim)">
      <div>持仓 {{ holding?.amount }} BTC</div>
      <div>成本 ${{ holding?.cost_per_usd?.toLocaleString() }}</div>
      <div style="color:var(--green)">补仓 $55k</div>
      <div style="color:var(--gold)">减仓 $75k</div>
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
