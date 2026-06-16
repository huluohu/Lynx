<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ pageTitle }}</h1>
      <div v-if="!loading" class="page-header-right desktop-only">
        <div class="page-header-actions">
          <button class="btn" @click="runBacktestAction" :disabled="backtesting">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M3 3v18h18"/><path d="m7 14 3-3 3 2 4-5"/></svg>
            {{ backtesting ? t('strategyDetail.backtesting') : t('strategyDetail.backtest') }}
          </button>
          <button class="btn" @click="runStressTestAction" :disabled="stressTesting">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M9 3h6"/><path d="M10 9h4"/><path d="M8 3v3.5a1 1 0 0 0 .3.7l5.4 5.4a4 4 0 1 1-5.66 5.66l-5.4-5.4A1 1 0 0 1 2 12.16V3h6"/><path d="M14 3v3.5a1 1 0 0 1-.3.7l-.7.7"/></svg>
            {{ stressTesting ? t('strategyDetail.stressTesting') : t('strategyDetail.stressTest') }}
          </button>
          <button class="btn" @click="runReviewAction" :disabled="reviewing">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M9 12h6"/><path d="M9 16h6"/><path d="M12 8h.01"/><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/></svg>
            {{ reviewing ? t('strategyDetail.reviewing') : t('strategyDetail.review') }}
          </button>
          <button class="btn" @click="showChatDrawer = true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> {{ t('strategyDetail.chatAdjust') }}</button>
          <button class="btn" @click="showAIRegenerate = true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> {{ t('strategyDetail.regenerate') }}</button>
          <button class="btn btn-primary" @click="generatePlan" :disabled="generating">{{ generating ? t('strategyDetail.generatingPlan') : t('strategyDetail.generatePlan') }}</button>
          <router-link :to="`/strategies/${route.params.id}/edit`" class="btn">{{ t('strategyDetail.edit') }}</router-link>
          <button class="btn btn-danger" @click="confirmDelete">{{ t('strategyDetail.delete') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading">
      <div class="card skeleton-card" v-for="i in 3" :key="i">
        <div class="skeleton skeleton-text" style="width:140px;margin-bottom:16px"></div>
        <div class="skeleton skeleton-text" style="width:100%"></div>
        <div class="skeleton skeleton-text short" style="margin-top:10px"></div>
      </div>
    </div>

    <template v-else>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title">{{ t('strategyDetail.strategyInfo') }}</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">{{ t('strategyCompare.type') }}</span><span class="badge badge-buy">{{ typeLabel(strategy.type) }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('strategyDetail.linkedAssets') }}</span><span>{{ linkedAssetText }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('strategyDetail.status') }}</span><span class="badge" :class="strategy.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ statusLabel(strategy.status) }}</span></div>
          <div class="info-row" v-if="strategy.description"><span class="info-label">{{ t('aiStrategyGenerator.description') }}</span><span style="color:var(--text-dim)">{{ strategy.description }}</span></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title">{{ t('strategyDetail.params') }}</div>
        <div class="info-list" v-if="parsedParams">
          <template v-if="strategy.type === 'recovery'">
            <div class="info-row"><span class="info-label">{{ t('strategyDetail.budget') }}</span><span>¥{{ fmtMoney(parsedParams.budget) }}</span></div>
            <div v-if="parsedParams.buy_lines?.length" style="margin-top:8px">
              <span class="info-label" style="display:block;margin-bottom:4px">{{ t('strategyForm.buyLines') }}</span>
              <div v-for="(l,i) in parsedParams.buy_lines" :key="'b'+i" class="line-tag buy">{{ lineText('buy', l) }}</div>
            </div>
            <div v-if="parsedParams.sell_lines?.length" style="margin-top:8px">
              <span class="info-label" style="display:block;margin-bottom:4px">{{ t('strategyForm.sellLines') }}</span>
              <div v-for="(l,i) in parsedParams.sell_lines" :key="'s'+i" class="line-tag sell">{{ lineText('sell', l) }}</div>
            </div>
          </template>
          <template v-else-if="strategy.type === 'dca'">
            <div class="info-row"><span class="info-label">{{ t('strategyForm.frequency') }}</span><span>{{ frequencyLabel(parsedParams.frequency) }}</span></div>
            <div class="info-row"><span class="info-label">{{ t('strategyForm.periods') }}</span><span>{{ parsedParams.periods || '-' }}</span></div>
            <div v-if="dcaAssetRows.length" class="param-card-list">
              <div v-for="item in dcaAssetRows" :key="item.assetKey" class="param-card">
                <div class="param-card-title">{{ item.assetLabel }}</div>
                <div class="param-card-meta">{{ t('strategyForm.amountPerPeriod') }} · ¥{{ fmtMoney(item.amount_per) }}</div>
              </div>
            </div>
          </template>
          <template v-else-if="strategy.type === 'grid'">
            <div class="info-row"><span class="info-label">{{ t('strategyDetail.budget') }}</span><span>¥{{ fmtMoney(parsedParams.budget) }}</span></div>
            <div v-if="gridAssetRows.length" class="param-card-list">
              <div v-for="item in gridAssetRows" :key="item.assetKey" class="param-card">
                <div class="param-card-title">{{ item.assetLabel }}</div>
                <div class="param-card-meta">{{ t('strategyForm.lowerBound') }} ¥{{ fmtNumber(item.low) }} · {{ t('strategyForm.upperBound') }} ¥{{ fmtNumber(item.high) }}</div>
                <div class="param-card-meta">{{ t('strategyForm.gridCount') }} {{ item.grids }}</div>
              </div>
            </div>
          </template>
          <template v-else-if="strategy.type === 'value_avg'">
            <div class="info-row"><span class="info-label">{{ t('strategyForm.periods') }}</span><span>{{ parsedParams.periods || '-' }}</span></div>
            <div v-if="valueAvgAssetRows.length" class="param-card-list">
              <div v-for="item in valueAvgAssetRows" :key="item.assetKey" class="param-card">
                <div class="param-card-title">{{ item.assetLabel }}</div>
                <div class="param-card-meta">{{ t('strategyForm.targetValue') }} · ¥{{ fmtMoney(item.target_value) }}</div>
                <div class="param-card-meta">{{ t('strategyForm.growthRate') }} · {{ fmtPct(item.growth_rate * 100) }}</div>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-for="(v, k) in parsedParams" :key="k" class="info-row">
              <span class="info-label">{{ k }}</span><span>{{ formatParamValue(v) }}</span>
            </div>
          </template>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title">{{ t('strategyDetail.planTitle', { count: plans.length }) }}</div>
        <div v-if="generating" style="text-align:center;padding:24px"><span class="spinner"></span> {{ t('strategyDetail.creatingSteps') }}</div>

        <table v-else-if="plans.length" class="hide-mobile">
          <thead><tr><th>#</th><th>{{ t('strategyDetail.triggerCondition') }}</th><th>{{ t('strategyDetail.priceLevel') }}</th><th>{{ t('strategyDetail.action') }}</th><th>{{ t('transactionForm.quantity') }}</th><th>{{ t('aiStrategyGenerator.amount') }}</th><th>{{ t('strategyDetail.averageCost') }}</th><th>{{ t('strategyDetail.status') }}</th></tr></thead>
          <tbody>
            <tr v-for="p in plans" :key="p.id">
              <td>{{ p.seq }}</td>
              <td style="font-size:12px;color:var(--text-dim)">{{ triggerLabel(p.trigger_type) }}</td>
              <td style="font-weight:600">{{ formatTriggerValue(p.trigger_value) }}</td>
              <td><span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span></td>
              <td>{{ p.quantity ? fmtNumber(p.quantity, 4) : '-' }}</td>
              <td>{{ p.amount ? `¥${fmtMoney(p.amount)}` : '-' }}</td>
              <td>{{ p.new_avg_cost ? `¥${fmtMoney(p.new_avg_cost)}` : '-' }}</td>
              <td><span class="badge" :class="planStatusBadge(p.status)">{{ planStatusLabel(p.status) }}</span></td>
            </tr>
          </tbody>
        </table>

        <div v-if="plans.length" class="show-mobile plan-cards">
          <div v-for="p in plans" :key="p.id" class="plan-card">
            <div class="plan-card-header">
              <span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span>
              <span class="badge" :class="planStatusBadge(p.status)">{{ planStatusLabel(p.status) }}</span>
            </div>
            <div class="plan-card-body">
              <div class="plan-card-price">{{ triggerLabel(p.trigger_type) }} <b>{{ formatTriggerValue(p.trigger_value) }}</b></div>
              <div class="plan-card-meta">
                <span v-if="p.quantity">{{ t('strategyDetail.quantityLabel', { value: fmtNumber(p.quantity, 4) }) }}</span>
                <span v-if="p.amount">{{ t('strategyDetail.amountLabel', { value: fmtMoney(p.amount) }) }}</span>
                <span v-if="p.new_avg_cost">{{ t('strategyDetail.averageCostLabel', { value: fmtMoney(p.new_avg_cost) }) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty" style="padding:24px"><p>{{ t('strategyDetail.noPlans') }}</p></div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title">{{ t('strategyDetail.backtestResults') }}</div>
        <div v-if="backtestLoading" class="backtest-loading">
          <div class="stat-card" v-for="i in 5" :key="i">
            <div class="skeleton skeleton-text short"></div>
            <div class="skeleton skeleton-price" style="height:24px;width:90px;margin-top:10px"></div>
          </div>
        </div>
        <template v-else-if="latestBacktest">
          <div class="backtest-meta">
            <span>{{ t('strategyDetail.range', { start: fmtDate(latestBacktest.start_date), end: fmtDate(latestBacktest.end_date) }) }}</span>
            <span>{{ t('strategyDetail.savedRuns', { count: backtestResults.length }) }}</span>
          </div>
          <div class="backtest-stats">
            <div class="stat-card">
              <div class="stat-label">{{ t('strategyDetail.totalReturn') }}</div>
              <div class="stat-value" :class="latestBacktest.total_return_pct >= 0 ? 'pnl positive' : 'pnl negative'">{{ fmtSignedPct(latestBacktest.total_return_pct) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('strategyDetail.maxDrawdown') }}</div>
              <div class="stat-value pnl negative">{{ fmtPct(latestBacktest.max_drawdown_pct) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('strategyDetail.winRate') }}</div>
              <div class="stat-value">{{ fmtPct(latestBacktest.win_rate) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('strategyDetail.totalTrades') }}</div>
              <div class="stat-value">{{ latestBacktest.total_trades || 0 }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('strategyDetail.sharpeRatio') }}</div>
              <div class="stat-value">{{ fmtNumber(latestBacktest.sharpe_ratio) }}</div>
            </div>
          </div>

          <div class="info-list" style="margin-top:16px">
            <div class="info-row"><span class="info-label">{{ t('strategyDetail.initialInvestment') }}</span><span>¥{{ fmtMoney(latestBacktest.initial_investment) }}</span></div>
            <div class="info-row"><span class="info-label">{{ t('strategyDetail.finalValue') }}</span><span>¥{{ fmtMoney(latestBacktest.final_value) }}</span></div>
            <div class="info-row"><span class="info-label">{{ t('strategyDetail.latestExecution') }}</span><span>{{ fmtDateTime(latestBacktest.created_at) }}</span></div>
          </div>

          <details class="trade-log" :open="!!latestBacktest.details?.length">
            <summary>{{ t('strategyDetail.executionDetails', { count: latestBacktest.details?.length || 0 }) }}</summary>
            <div v-if="latestBacktest.details?.length" class="trade-log-list">
              <div v-for="(item, index) in latestBacktest.details" :key="`${item.plan_id}-${index}`" class="trade-log-item">
                <div class="trade-log-top">
                  <span class="badge" :class="item.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ item.action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span>
                  <span class="trade-log-time">{{ fmtDateTime(item.executed_at) }}</span>
                </div>
                <div class="trade-log-body">
                  <span>{{ t('strategyDetail.triggerPrice', { value: fmtNumber(item.trigger_value) }) }}</span>
                  <span>{{ t('strategyDetail.executedPrice', { value: fmtNumber(item.price) }) }}</span>
                  <span>{{ t('strategyDetail.quantityValue', { value: fmtNumber(item.quantity, 4) }) }}</span>
                  <span>{{ t('strategyDetail.amountValue', { value: fmtMoney(item.amount) }) }}</span>
                  <span v-if="item.pnl !== undefined" :class="item.pnl >= 0 ? 'pnl positive' : 'pnl negative'">{{ t('strategyDetail.profitLoss', { value: `${item.pnl >= 0 ? '+' : '-'}¥${fmtMoney(Math.abs(item.pnl))}` }) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty" style="padding:16px 0 0">{{ t('strategyDetail.noExecutions') }}</div>
          </details>
        </template>
        <div v-else class="empty" style="padding:24px">
          <p>{{ t('strategyDetail.noBacktests') }}</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title">{{ t('strategyDetail.stressSection') }}</div>
        <div v-if="stressLoading" class="stress-grid">
          <div class="stress-card" v-for="i in 6" :key="i">
            <div class="skeleton skeleton-text" style="width:90px;margin-bottom:12px"></div>
            <div class="skeleton skeleton-text" style="width:100%;margin-bottom:8px"></div>
            <div class="skeleton skeleton-text short" style="margin-bottom:8px"></div>
            <div class="skeleton skeleton-text short"></div>
          </div>
        </div>
        <div v-else-if="stressResults.length" class="stress-grid">
          <div v-for="item in stressResults" :key="item.scenario_name" class="stress-card" :class="stressCardClass(item.return_pct)">
            <div class="stress-head">
              <div class="stress-title">{{ scenarioLabel(item) }}</div>
              <span class="badge" :class="Number(item.return_pct) >= 0 ? 'badge-market-up' : 'badge-market-down'">{{ fmtSignedPct(item.return_pct) }}</span>
            </div>
            <div class="stress-stats">
              <div class="stress-stat">
                <span class="stress-label">{{ t('strategyDetail.expectedReturn') }}</span>
                <b :class="Number(item.return_pct) >= 0 ? 'pnl positive' : 'pnl negative'">{{ fmtSignedPct(item.return_pct) }}</b>
              </div>
              <div class="stress-stat">
                <span class="stress-label">{{ t('strategyDetail.maxDrawdown') }}</span>
                <b class="pnl negative">{{ fmtPct(item.max_drawdown_pct) }}</b>
              </div>
              <div class="stress-stat">
                <span class="stress-label">{{ t('strategyDetail.triggeredPlans') }}</span>
                <b>{{ item.plans_triggered || 0 }}</b>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty" style="padding:24px">
          <p>{{ t('strategyDetail.noStress') }}</p>
        </div>
      </div>

      <div class="card">
        <div class="section-title review-title-row">
          <span>{{ t('strategyDetail.reviewTitle') }}</span>
          <span v-if="latestReview" class="review-date">{{ fmtDateTime(latestReview.created_at) }}</span>
        </div>
        <div v-if="reviewing" class="review-loading"><span class="spinner"></span> {{ t('strategyDetail.reviewGenerating') }}</div>
        <template v-else-if="latestReview">
          <div class="review-top">
            <div>
              <div class="review-summary">{{ latestReview.summary }}</div>
              <div class="review-meta">{{ t('strategyDetail.latestReviewTime', { time: fmtDateTime(latestReview.created_at) }) }}</div>
            </div>
            <span class="badge review-score" :class="reviewScoreClass(latestReview.performance_score)">{{ t('strategyDetail.score', { value: latestReview.performance_score || '-' }) }}</span>
          </div>

          <div v-if="latestReview.recommendations?.length" class="review-section-block">
            <div class="detail-section-title">{{ t('strategyDetail.recommendations') }}</div>
            <ul class="review-list">
              <li v-for="(item, index) in latestReview.recommendations" :key="index">{{ item }}</li>
            </ul>
          </div>

          <details v-if="latestReview.deviation_analysis" class="review-details">
            <summary>{{ t('strategyDetail.deviationAnalysis') }}</summary>
            <pre class="review-pre">{{ formatReviewBlock(latestReview.deviation_analysis) }}</pre>
          </details>

          <details v-if="latestReview.market_context" class="review-details">
            <summary>{{ t('strategyDetail.marketContext') }}</summary>
            <div class="review-context">{{ latestReview.market_context }}</div>
          </details>

          <button v-if="olderReviews.length" class="text-link" @click="showReviewHistory = !showReviewHistory">
            {{ showReviewHistory ? t('strategyDetail.collapseHistory') : t('strategyDetail.viewHistory', { count: olderReviews.length }) }}
          </button>

          <div v-if="showReviewHistory" class="review-history">
            <div v-for="item in olderReviews" :key="item.id" class="review-history-item">
              <div class="review-history-top">
                <span class="badge" :class="reviewScoreClass(item.performance_score)">{{ t('strategyDetail.score', { value: item.performance_score || '-' }) }}</span>
                <span class="review-date">{{ fmtDateTime(item.created_at) }}</span>
              </div>
              <div class="review-history-summary">{{ item.summary }}</div>
            </div>
          </div>
        </template>
        <div v-else class="empty" style="padding:24px">
          <p>{{ t('strategyDetail.noReview') }}</p>
        </div>
      </div>
    </template>

    <!-- delete confirm is handled programmatically via useConfirm() -->

    <AppDrawer v-model="showChatDrawer" :title="t('strategyDetail.chatTitle')" width="500px">
      <div class="chat-panel">
        <div ref="chatScrollRef" class="chat-messages">
          <div v-if="!chatMessages.length" class="chat-empty">
            <p>{{ t('strategyDetail.chatTry') }}</p>
            <p>{{ t('strategyDetail.chatExample') }}</p>
          </div>

          <div v-for="msg in chatMessages" :key="msg.id" class="chat-msg" :class="msg.role">
            <div class="chat-bubble">{{ msg.text }}</div>

            <div v-if="msg.proposal" class="changes-card">
              <div class="changes-summary">{{ msg.proposal.summary }}</div>
              <div v-if="msg.proposal.interpretation && msg.proposal.interpretation !== msg.text" class="changes-interpretation">{{ msg.proposal.interpretation }}</div>

              <div v-if="proposalChangeItems(msg.proposal).length" class="changes-list">
                <div v-for="(item, index) in proposalChangeItems(msg.proposal)" :key="`${msg.id}-${index}`" class="change-item">
                  <span class="change-indicator" :class="item.type">{{ item.type === 'add' ? '+' : (item.type === 'delete' ? '-' : '~') }}</span>
                  <span>{{ item.text }}</span>
                </div>
              </div>

              <div v-if="isProposalPending(msg)" class="changes-actions">
                <button class="btn btn-primary" @click="confirmStrategyChanges(msg)" :disabled="chatApplying">{{ chatApplying ? t('strategyDetail.applying') : t('strategyDetail.confirmApply') }}</button>
                <button class="btn" @click="cancelStrategyChanges(msg)" :disabled="chatApplying">{{ t('common.cancel') }}</button>
              </div>
              <div v-else-if="msg.proposalStatus === 'applied'" class="changes-status">{{ t('strategyDetail.applied') }}</div>
              <div v-else-if="msg.proposalStatus === 'cancelled'" class="changes-status">{{ t('strategyDetail.cancelled') }}</div>
            </div>
          </div>

          <div v-if="chatLoading" class="chat-msg ai">
            <div class="chat-bubble">{{ t('strategyDetail.thinking') }}</div>
          </div>
        </div>

        <div class="chat-input">
          <textarea
            v-model="chatInput"
            rows="3"
            :placeholder="t('strategyDetail.chatPlaceholder')"
            :disabled="chatLoading || chatApplying"
            @keydown="handleChatKeydown"
          ></textarea>
          <button class="btn btn-primary" @click="sendChatMessage" :disabled="chatLoading || chatApplying || !chatInput.trim()">{{ chatLoading ? t('strategyDetail.sending') : t('strategyDetail.send') }}</button>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer v-model="showAIRegenerate" :title="`✨ ${t('strategyForm.aiRegenerateTitle')}`">
      <AIStrategyGenerator :preset-asset-id="strategy.asset_id" :existing-strategy-id="strategy.id" @done="onAIRegenDone" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import AppDrawer from '../components/AppDrawer.vue'
import { useConfirm } from '../utils/confirm.js'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'
import { useSwipeBack } from '../composables/useSwipeBack.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import { formatDate, formatDateTime, formatNumber } from '../utils/formatters.js'

useSwipeBack()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const loading = ref(true)
const strategy = ref({})
const plans = ref([])
const backtestResults = ref([])
const stressResults = ref([])
const reviews = ref([])
const generating = ref(false)
const backtesting = ref(false)
const stressTesting = ref(false)
const reviewing = ref(false)
const backtestLoading = ref(false)
const stressLoading = ref(false)
const showDeleteConfirm = ref(false) // kept for legacy; not used by dialog
const showAIRegenerate = ref(false)
const showChatDrawer = ref(false)
const showReviewHistory = ref(false)
const deleting = ref(false)
const chatMessages = ref([])
const chatInput = ref('')
const chatLoading = ref(false)
const chatApplying = ref(false)
const chatScrollRef = ref(null)
const mobilePageActions = useMobilePageActions()

const pageTitle = computed(() => loading.value ? t('strategyDetail.title') : (strategy.value.name || t('strategyDetail.title')))
const linkedAssetText = computed(() => {
  const name = strategy.value.asset_name || '-'
  const symbol = strategy.value.symbol ? ` ${strategy.value.symbol}` : ''
  return `${name}${symbol}`.trim()
})
const strategyAssets = computed(() => {
  if (Array.isArray(strategy.value.assets) && strategy.value.assets.length) {
    return strategy.value.assets
  }
  if (strategy.value.asset_id || strategy.value.asset_name) {
    return [{
      id: strategy.value.asset_id,
      name: strategy.value.asset_name || '-',
      symbol: strategy.value.symbol || '',
      icon: strategy.value.icon || '',
    }]
  }
  return []
})
const parsedParams = computed(() => {
  try { return JSON.parse(strategy.value.parameters || '{}') } catch { return null }
})
const dcaAssetRows = computed(() => buildPerAssetRows((params, assetId) => ({ amount_per: params?.amount_per })))
const gridAssetRows = computed(() => buildPerAssetRows((params) => ({ low: params?.low, high: params?.high, grids: params?.grids })))
const valueAvgAssetRows = computed(() => buildPerAssetRows((params) => ({ target_value: params?.target_value, growth_rate: params?.growth_rate })))
const latestBacktest = computed(() => backtestResults.value[0] || null)
const latestReview = computed(() => reviews.value[0] || null)
const olderReviews = computed(() => reviews.value.slice(1))

function safeParse(value, fallback) {
  try { return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback) } catch { return fallback }
}
function normalizeBacktest(row) {
  return { ...row, details: Array.isArray(row?.details) ? row.details : safeParse(row?.details, []) }
}
function normalizeReview(row) {
  return {
    ...row,
    deviation_analysis: safeParse(row?.deviation_analysis, row?.deviation_analysis || null),
    recommendations: Array.isArray(row?.recommendations) ? row.recommendations : safeParse(row?.recommendations, []),
  }
}

function createChatMessage(role, text, extras = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    proposal: null,
    proposalStatus: 'none',
    ...extras,
  }
}
function scrollChatToBottom() {
  nextTick(() => {
    const el = chatScrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
function hasProposalChanges(proposal) {
  return !!(proposal?.changes?.strategy_updates || proposal?.changes?.plans_add?.length || proposal?.changes?.plans_update?.length || proposal?.changes?.plans_delete?.length)
}
function isProposalPending(message) {
  return message?.proposal?.understood && hasProposalChanges(message.proposal) && message.proposalStatus === 'pending'
}
function typeLabel(type) {
  return type ? t(`strategyCompare.strategyTypes.${type}`) : '-'
}
function statusLabel(status) {
  return status ? t(`strategyDetail.strategyStatuses.${status}`) : '-'
}
function frequencyLabel(value) {
  return value ? t(`strategyForm.frequencies.${value}`) : '-'
}
function assetLabelById(assetId) {
  const target = strategyAssets.value.find((item) => String(item.id) === String(assetId))
  if (!target) return `#${assetId}`
  return [target.icon, target.name, target.symbol].filter(Boolean).join(' ')
}
function buildPerAssetRows(mapEntry) {
  const params = parsedParams.value || {}
  const perAsset = params.per_asset || {}
  const rows = Object.entries(perAsset).map(([assetId, assetParams]) => ({
    assetKey: assetId,
    assetLabel: assetLabelById(assetId),
    ...mapEntry(assetParams, assetId),
  }))
  if (rows.length) return rows
  if (strategyAssets.value.length === 1) {
    const asset = strategyAssets.value[0]
    return [{
      assetKey: asset.id || 'primary',
      assetLabel: assetLabelById(asset.id),
      ...mapEntry(params, asset.id),
    }]
  }
  return []
}

watchEffect(() => {
  if (loading.value) {
    mobilePageActions.setActions([])
    return
  }

  mobilePageActions.setActions([
    {
      key: 'backtest',
      label: backtesting.value ? t('strategyDetail.backtesting') : t('strategyDetail.runBacktest'),
      disabled: backtesting.value,
      onSelect: runBacktestAction,
    },
    {
      key: 'stress-test',
      label: stressTesting.value ? t('strategyDetail.stressTestingRunning') : t('strategyDetail.runStressTest'),
      disabled: stressTesting.value,
      onSelect: runStressTestAction,
    },
    {
      key: 'review',
      label: reviewing.value ? t('strategyDetail.reviewingGenerating') : t('strategyDetail.review'),
      disabled: reviewing.value,
      onSelect: runReviewAction,
    },
    {
      key: 'chat',
      label: t('strategyDetail.chatAdjust'),
      onSelect: () => { showChatDrawer.value = true },
    },
    {
      key: 'regenerate',
      label: t('strategyDetail.regenerate'),
      onSelect: () => { showAIRegenerate.value = true },
    },
    {
      key: 'generate-plan',
      label: generating.value ? t('strategyDetail.generatingPlan') : t('strategyDetail.generatePlan'),
      disabled: generating.value,
      onSelect: generatePlan,
    },
    {
      key: 'edit',
      label: t('strategyDetail.editStrategy'),
      to: `/strategies/${route.params.id}/edit`,
    },
    {
      key: 'delete',
      label: t('strategyDetail.deleteStrategy'),
      danger: true,
      onSelect: confirmDelete,
    },
  ])
})
function triggerLabel(trigger) {
  return {
    price_above: t('aiStrategyGenerator.triggers.priceAbove'),
    price_below: t('aiStrategyGenerator.triggers.priceBelow'),
    time: t('aiStrategyGenerator.triggers.time'),
  }[trigger] || trigger
}
function planStatusLabel(status) {
  return status ? t(`strategyDetail.planStatuses.${status}`) : '-'
}
function planStatusBadge(status) {
  return { pending: 'badge-pending', triggered: 'badge-triggered', executed: 'badge-executed', cancelled: 'badge-sell' }[status] || ''
}
function reviewScoreClass(score) {
  const num = Number(score)
  if (num >= 8) return 'badge-buy'
  if (num >= 5) return 'badge-executed'
  return 'badge-sell'
}
function formatReviewBlock(value) {
  if (!value) return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}
function fmtNumber(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return formatNumber(number, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function fmtMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return formatNumber(Math.round(number))
}
function fmtPct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${fmtNumber(number, 2)}%`
}
function fmtSignedPct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${fmtNumber(number, 2)}%`
}
function fmtDate(value) {
  return value ? formatDate(value) : '-'
}
function fmtDateTime(value) {
  return value ? formatDateTime(value, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
}
function formatParamValue(value) {
  if (value == null || value === '') return '-'
  if (typeof value === 'number') return fmtNumber(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function formatTriggerValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? fmtNumber(number) : (value ?? '-')
}
function lineText(action, line) {
  const assetPart = line.asset_id ? `${assetLabelById(line.asset_id)} · ` : ''
  return `${assetPart}${action === 'buy' ? t('aiStrategyGenerator.triggers.priceBelow') : t('aiStrategyGenerator.triggers.priceAbove')} ¥${fmtNumber(line.price)} → ${action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell')} ¥${fmtMoney(line.amount)}`
}
function scenarioLabel(item) {
  return item?.scenario_label || (item?.scenario_name ? t(`strategyDetail.scenarios.${item.scenario_name}`) : '-')
}
function stressCardClass(value) {
  const pct = Number(value)
  if (!Number.isFinite(pct)) return 'neutral'
  return pct > 0 ? 'positive' : (pct < 0 ? 'negative' : 'neutral')
}
function formatChangeValue(value) {
  if (value == null) return t('strategyDetail.cleared')
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : fmtNumber(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function describePlan(plan) {
  const parts = []
  if (plan.trigger_type && plan.trigger_value != null) parts.push(`${triggerLabel(plan.trigger_type)} ${formatTriggerValue(plan.trigger_value)}`)
  if (plan.action) parts.push(plan.action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell'))
  if (plan.amount != null) parts.push(t('strategyDetail.amountValue', { value: fmtMoney(plan.amount) }))
  if (plan.quantity != null) parts.push(t('strategyDetail.quantityValue', { value: fmtNumber(plan.quantity, 4) }))
  if (plan.new_avg_cost != null) parts.push(t('aiStrategyGenerator.averageCostArrow', { value: fmtNumber(plan.new_avg_cost) }))
  if (plan.notes) parts.push(t('strategyDetail.changeText.notes', { value: plan.notes }))
  return parts.join('，')
}
function planTarget(plan) {
  return plan.seq ? t('strategyDetail.changeText.planStep', { seq: plan.seq }) : t('strategyDetail.changeText.planById', { id: plan.id })
}
function describePlanPatch(plan) {
  const parts = []
  if (Object.prototype.hasOwnProperty.call(plan, 'trigger_type') || Object.prototype.hasOwnProperty.call(plan, 'trigger_value')) {
    parts.push(t('strategyDetail.changeText.triggerTo', { value: `${triggerLabel(plan.trigger_type || 'time')} ${plan.trigger_value ?? '-'}` }))
  }
  if (Object.prototype.hasOwnProperty.call(plan, 'action')) parts.push(t('strategyDetail.changeText.actionTo', { value: plan.action === 'buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }))
  if (Object.prototype.hasOwnProperty.call(plan, 'amount')) parts.push(t('strategyDetail.changeText.amountTo', { value: plan.amount == null ? t('strategyDetail.cleared') : `¥${fmtMoney(plan.amount)}` }))
  if (Object.prototype.hasOwnProperty.call(plan, 'quantity')) parts.push(t('strategyDetail.changeText.quantityTo', { value: plan.quantity == null ? t('strategyDetail.cleared') : fmtNumber(plan.quantity, 4) }))
  if (Object.prototype.hasOwnProperty.call(plan, 'new_avg_cost')) parts.push(t('strategyDetail.changeText.averageCostTo', { value: plan.new_avg_cost == null ? t('strategyDetail.cleared') : `¥${fmtNumber(plan.new_avg_cost)}` }))
  if (Object.prototype.hasOwnProperty.call(plan, 'status')) parts.push(t('strategyDetail.changeText.statusTo', { value: planStatusLabel(plan.status) }))
  if (Object.prototype.hasOwnProperty.call(plan, 'notes')) parts.push(t('strategyDetail.changeText.notesTo', { value: plan.notes || t('strategyDetail.emptyNote') }))
  return parts.length ? parts.join('；') : t('strategyDetail.updatePlanDetail')
}
function proposalChangeItems(proposal) {
  const items = []
  const updates = proposal?.changes?.strategy_updates
  if (updates) {
    if (Object.prototype.hasOwnProperty.call(updates, 'name')) items.push({ type: 'update', text: t('strategyDetail.changeText.updateName', { value: updates.name }) })
    if (Object.prototype.hasOwnProperty.call(updates, 'description')) items.push({ type: 'update', text: t('strategyDetail.changeText.updateDescription', { value: updates.description }) })
    if (Object.prototype.hasOwnProperty.call(updates, 'type')) items.push({ type: 'update', text: t('strategyDetail.changeText.updateType', { value: typeLabel(updates.type) }) })
    if (Object.prototype.hasOwnProperty.call(updates, 'status')) items.push({ type: 'update', text: t('strategyDetail.changeText.updateStatus', { value: statusLabel(updates.status) }) })
    if (Object.prototype.hasOwnProperty.call(updates, 'parameters')) items.push({ type: 'update', text: t('strategyDetail.changeText.updateParameters', { value: formatChangeValue(updates.parameters) }) })
  }
  for (const plan of proposal?.changes?.plans_add || []) items.push({ type: 'add', text: t('strategyDetail.changeText.addStep', { seq: plan.seq || '?', value: describePlan(plan) }) })
  for (const plan of proposal?.changes?.plans_update || []) items.push({ type: 'update', text: t('strategyDetail.changeText.updateStep', { target: planTarget(plan), value: describePlanPatch(plan) }) })
  for (const plan of proposal?.changes?.plans_delete || []) items.push({ type: 'delete', text: t('strategyDetail.changeText.deleteStep', { target: plan.seq ? `${t('strategyDetail.changeText.planStep', { seq: plan.seq })}${t('strategyDetail.generatePlan')}` : t('strategyDetail.changeText.planById', { id: plan.id }) }) })
  return items
}

async function sendChatMessage() {
  const message = chatInput.value.trim()
  if (!message || chatLoading.value || chatApplying.value) return

  chatMessages.value.push(createChatMessage('user', message))
  chatInput.value = ''
  chatLoading.value = true
  scrollChatToBottom()

  try {
    const res = await api(`/api/strategies/${route.params.id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('strategyDetail.chatFailed'))

    const proposal = json.data || {}
    const messageText = proposal.interpretation || proposal.summary || (proposal.understood ? t('strategyDetail.generatedSuggestion') : t('strategyDetail.beSpecific'))
    chatMessages.value.push(createChatMessage('ai', messageText, {
      proposal,
      proposalStatus: proposal.understood && hasProposalChanges(proposal) ? 'pending' : 'none',
    }))
  } catch (e) {
    toast.error(e.message)
    chatMessages.value.push(createChatMessage('ai', e.message || t('strategyDetail.chatFailed')))
  } finally {
    chatLoading.value = false
    scrollChatToBottom()
  }
}

async function confirmStrategyChanges(message) {
  if (!isProposalPending(message) || chatApplying.value) return
  chatApplying.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/chat/apply`, {
      method: 'POST',
      body: JSON.stringify({ changes: message.proposal.changes }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('strategyDetail.applyFailed'))

    message.proposalStatus = 'applied'
    await loadData()
    toast.success(t('strategyDetail.appliedSuccess'))
  } catch (e) {
    toast.error(e.message)
  } finally {
    chatApplying.value = false
  }
}
function cancelStrategyChanges(message) {
  if (!message?.proposal) return
  message.proposalStatus = 'cancelled'
}
function handleChatKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendChatMessage()
  }
}

async function loadData() {
  loading.value = true
  try {
    const [res, pres, bres, rres] = await Promise.all([
      api(`/api/strategies/${route.params.id}`),
      api(`/api/plans?strategy_id=${route.params.id}`),
      api(`/api/strategies/${route.params.id}/backtest-results`),
      api(`/api/strategies/${route.params.id}/reviews`),
    ])
    const json = await res.json()
    const pjson = await pres.json()
    const bjson = await bres.json()
    const rjson = await rres.json()
    if (json.data) strategy.value = json.data
    plans.value = pjson.data || []
    backtestResults.value = (bjson.data || []).map(normalizeBacktest)
    reviews.value = (rjson.data || []).map(normalizeReview)
    stressResults.value = []
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

async function generatePlan() {
  generating.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/generate-plan`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      plans.value = json.data || []
      backtestResults.value = []
      stressResults.value = []
      toast.success(t('strategyDetail.planGenerated'))
    } else {
      toast.error(t('strategyDetail.generateFailed', { message: json.error }))
    }
  } catch (e) {
    toast.error(e.message)
  }
  generating.value = false
}

async function runBacktestAction() {
  backtesting.value = true
  backtestLoading.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/backtest`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      const result = normalizeBacktest(json.data)
      backtestResults.value = [result, ...backtestResults.value.filter(item => item.id !== result.id)]
      toast.success(t('strategyDetail.backtestDone'))
    } else {
      toast.error(json.error || t('strategyDetail.backtestFailed'))
    }
  } catch (e) {
    toast.error(e.message)
  }
  backtesting.value = false
  backtestLoading.value = false
}

async function runStressTestAction() {
  stressTesting.value = true
  stressLoading.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/stress-test`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      stressResults.value = json.data || []
      toast.success(t('strategyDetail.stressDone'))
    } else {
      toast.error(json.error || t('strategyDetail.stressFailed'))
    }
  } catch (e) {
    toast.error(e.message)
  }
  stressTesting.value = false
  stressLoading.value = false
}

async function runReviewAction() {
  reviewing.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}/review`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      const review = normalizeReview(json.data)
      reviews.value = [review, ...reviews.value.filter(item => item.id !== review.id)]
      showReviewHistory.value = false
      toast.success(t('strategyDetail.reviewDone'))
    } else {
      toast.error(json.error || t('strategyDetail.reviewFailed'))
    }
  } catch (e) {
    toast.error(e.message)
  }
  reviewing.value = false
}

async function confirmDelete() {
  const ok = await confirm({
    title: t('strategyDetail.deleteStrategy'),
    message: t('strategyDetail.deleteMessage', { name: strategy.value?.name || '' }),
    confirmText: t('strategyDetail.delete'),
    icon: 'delete',
    danger: true,
  })
  if (ok) doDelete()
}

async function doDelete() {
  deleting.value = true
  try {
    const res = await api(`/api/strategies/${route.params.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      toast.success(t('strategyDetail.deleted'))
      router.push('/strategies')
    } else {
      toast.error(json.error || t('strategyDetail.deleteFailed'))
    }
  } catch (e) {
    toast.error(e.message)
  }
  deleting.value = false
  showDeleteConfirm.value = false
}

function onAIRegenDone() {
  showAIRegenerate.value = false
  toast.success(t('strategyDetail.updated'))
  loadData()
}

watch(() => [chatMessages.value.length, chatLoading.value, showChatDrawer.value], () => {
  if (showChatDrawer.value) scrollChatToBottom()
})

onUnmounted(() => {
  mobilePageActions.clearActions()
})

onMounted(loadData)
</script>

<style scoped>
.info-list { font-size: 14px; }
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }
.detail-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); margin-bottom: 8px; }

.line-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  margin: 2px 4px 2px 0;
}
.line-tag.buy { background: rgba(34,197,94,0.1); color: var(--green); }
.line-tag.sell { background: rgba(239,68,68,0.1); color: var(--red); }
.param-card-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.param-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  background: var(--bg);
}
.param-card-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.param-card-meta {
  color: var(--text-dim);
  font-size: 13px;
}

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

.backtest-loading {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.backtest-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.backtest-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.trade-log {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.trade-log summary,
.review-details summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--text-dim);
}
.trade-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.trade-log-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
}
.trade-log-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.trade-log-time { font-size: 12px; color: var(--text-muted); }
.trade-log-body {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--text-dim);
}
.stress-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.stress-card {
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 12px;
  padding: 14px;
  background: var(--bg);
}
.stress-card.positive { border-left-color: var(--market-positive); }
.stress-card.negative { border-left-color: var(--market-negative); }
.stress-card.neutral { border-left-color: #f59e0b; }
.stress-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
.stress-title { font-size: 14px; font-weight: 700; }
.stress-stats {
  display: grid;
  gap: 8px;
}
.stress-stat {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}
.stress-label { color: var(--text-muted); }
.review-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.review-date { font-size: 12px; color: var(--text-muted); }
.review-loading {
  text-align: center;
  padding: 24px;
}
.review-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.review-summary {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.6;
}
.review-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}
.review-score { white-space: nowrap; }
.review-section-block { margin-top: 16px; }
.review-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-dim);
  line-height: 1.7;
}
.review-details {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.review-pre {
  margin: 12px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: var(--text-dim);
  background: var(--bg-soft, rgba(148, 163, 184, 0.08));
  border-radius: 10px;
  padding: 12px;
}
.review-context {
  margin-top: 12px;
  line-height: 1.7;
  color: var(--text-dim);
}
.text-link {
  margin-top: 14px;
  background: none;
  border: none;
  padding: 0;
  color: var(--blue);
  cursor: pointer;
  font-size: 13px;
}
.review-history {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.review-history-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
}
.review-history-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.review-history-summary {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.6;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 65vh;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}
.chat-empty {
  border: 1px dashed var(--border);
  border-radius: 12px;
  padding: 16px;
  color: var(--text-dim);
  line-height: 1.7;
}
.chat-empty p { margin: 0; }
.chat-msg {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chat-msg.user { align-items: flex-end; }
.chat-msg.ai { align-items: flex-start; }
.chat-bubble {
  max-width: 88%;
  padding: 12px 14px;
  border-radius: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg.user .chat-bubble {
  background: var(--blue);
  color: #fff;
  border-bottom-right-radius: 6px;
}
.chat-msg.ai .chat-bubble {
  background: var(--bg);
  border: 1px solid var(--border);
  border-bottom-left-radius: 6px;
}
.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.chat-input textarea {
  flex: 1;
  min-height: 88px;
  resize: none;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  font: inherit;
  color: var(--text);
  background: var(--bg);
}
.changes-card {
  width: min(100%, 420px);
  background: var(--bg-soft, rgba(59, 130, 246, 0.08));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 12px 14px;
}
.changes-summary {
  font-weight: 600;
  margin-bottom: 8px;
}
.changes-interpretation {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 10px;
}
.changes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.change-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--text-dim);
}
.change-indicator {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
}
.change-indicator.add { background: rgba(34, 197, 94, 0.12); color: var(--green); }
.change-indicator.update { background: rgba(59, 130, 246, 0.12); color: var(--blue); }
.change-indicator.delete { background: rgba(239, 68, 68, 0.12); color: var(--red); }
.changes-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.changes-status {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .backtest-loading, .backtest-stats, .stress-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .backtest-loading, .backtest-stats, .stress-grid { grid-template-columns: 1fr; }
  .trade-log-top, .backtest-meta, .info-row, .stress-head, .stress-stat, .review-top, .review-title-row, .review-history-top { align-items: flex-start; flex-wrap: wrap; }
  .chat-input { flex-direction: column; align-items: stretch; }
  .chat-bubble, .changes-card { max-width: 100%; width: 100%; }
  .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .info-row .info-label { font-size: 12px; }
  .chat-panel { min-height: 50vh; }
  .chat-input textarea { min-height: 60px; font-size: 16px; }
  .changes-actions { flex-wrap: wrap; }
  .changes-actions .btn { flex: 1; min-width: 0; }
}

</style>
