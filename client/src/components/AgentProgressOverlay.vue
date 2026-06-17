<template>
  <Teleport to="body">
    <Transition name="agent-overlay">
      <div v-if="visible" class="agent-overlay" @click.self.prevent @touchmove.prevent>
        <div class="agent-panel" :class="{ 'has-error': !!error, 'is-done': isDone }">

          <!-- Header -->
          <div class="agent-panel-header">
            <div class="agent-icon-title">
              <span class="header-icon">{{ isDone ? '✅' : error ? '❌' : '🧠' }}</span>
              <span class="header-title">{{ t('aiStrategyGenerator.agentWorking') }}</span>
            </div>
            <div class="header-right">
              <div v-if="!isDone && !error" class="header-spinner"></div>
              <button v-if="!isDone && !error" class="btn-cancel" @click="$emit('cancel')">
                {{ t('aiStrategyGenerator.cancelGenerate') }}
              </button>
            </div>
          </div>

          <!-- Error state -->
          <div v-if="error" class="error-body">
            <div class="error-msg">{{ error }}</div>
            <button class="btn-close-error" @click="$emit('close')">{{ t('common.close') }}</button>
          </div>

          <!-- Progress steps -->
          <div v-else class="steps-body">
            <div
              v-for="s in steps"
              :key="s.id"
              class="step-row"
              :class="s.status"
            >
              <span class="step-status-icon">
                <span v-if="s.status === 'done'" class="icon-done">✓</span>
                <span v-else-if="s.status === 'active'" class="icon-active"></span>
                <span v-else class="icon-pending"></span>
              </span>
              <span class="step-name">{{ stepLabel(s.id) }}</span>
              <span v-if="s.detail" class="step-detail-text">{{ s.detail }}</span>
            </div>

            <!-- Overall progress bar -->
            <div class="overall-progress">
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :style="{ width: overallPct + '%' }"
                  :class="{ 'fill-done': isDone }"
                ></div>
              </div>
              <span class="progress-pct">{{ overallPct }}%</span>
            </div>

            <!-- Data quality indicator -->
            <div v-if="dataQualityScore != null" class="quality-strip">
              <span class="qs-label">{{ t('aiStrategyGenerator.dataQuality') }}</span>
              <span class="qs-badge" :style="{ color: dqColor, borderColor: dqColor, backgroundColor: dqColor + '1f' }">
                {{ dataQualityLabel }} · {{ Math.round(dataQualityScore * 100) }}%
              </span>
            </div>

            <!-- Done state CTA -->
            <div v-if="isDone" class="done-cta">
              <div class="done-summary">
                <span v-if="evalScore != null" class="done-score">
                  {{ t('aiStrategyGenerator.evalScore') }}
                  <b :style="{ color: gradeColor }">{{ Math.round(evalScore * 100) }}</b>/100
                  <span class="done-grade" :style="{ background: gradeColor + '22', color: gradeColor }">{{ grade }}</span>
                </span>
              </div>
              <button class="btn-view-result" @click="$emit('close')">
                {{ t('aiStrategyGenerator.viewResult') }} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineEmits(['close', 'cancel'])

const props = defineProps({
  visible: Boolean,
  steps: { type: Array, default: () => [] },
  error: { type: String, default: '' },
  dataQualityScore: { type: Number, default: null },
  evalScore: { type: Number, default: null },
  grade: { type: String, default: null },
})

const isDone = computed(() => !props.error && props.steps.length > 0 && props.steps.every(s => s.status === 'done'))

const overallPct = computed(() => {
  if (!props.steps.length) return 0
  const done = props.steps.filter(s => s.status === 'done').length
  const active = props.steps.filter(s => s.status === 'active').length
  return Math.round((done + active * 0.5) / props.steps.length * 100)
})

const dqColor = computed(() => {
  const s = props.dataQualityScore
  if (s == null) return 'var(--text-dim)'
  if (s >= 0.7) return '#22c55e'
  if (s >= 0.4) return '#f59e0b'
  return '#ef4444'
})

const dataQualityLabel = computed(() => {
  const s = props.dataQualityScore
  if (s == null) return ''
  if (s >= 0.7) return t('aiStrategyGenerator.dataQualityGood')
  if (s >= 0.4) return t('aiStrategyGenerator.dataQualityFair')
  return t('aiStrategyGenerator.dataQualityLowShort')
})

const gradeColor = computed(() => ({
  A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444',
}[props.grade] || 'var(--text-dim)'))

function stepLabel(id) {
  return t(`aiStrategyGenerator.progress.${id}`, id)
}
</script>

<style scoped>
/* Full-screen backdrop — non-dismissible */
.agent-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;        /* bottom-sheet on mobile */
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  padding: env(safe-area-inset-bottom, 0);
}

/* Desktop: center card */
@media (min-width: 769px) {
  .agent-overlay {
    align-items: center;
  }
  .agent-panel {
    border-radius: 16px !important;
    width: 420px !important;
    max-width: calc(100vw - 32px) !important;
  }
}

.agent-panel {
  width: 100%;
  max-width: 100vw;
  background: var(--bg-card, #1a1f2e);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  overflow: hidden;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.4);
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

/* Header */
.agent-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--border);
  gap: 10px;
}
.agent-icon-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.header-icon { font-size: 20px; flex-shrink: 0; }
.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Spinner */
.header-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Cancel button */
.btn-cancel {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-cancel:hover { border-color: #ef4444; color: #ef4444; }
.btn-cancel:active { background: rgba(239,68,68,0.08); }


/* Error body */
.error-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.error-msg {
  font-size: 14px;
  color: #ef4444;
  line-height: 1.6;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  padding: 12px 14px;
}
.btn-close-error {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  cursor: pointer;
}

/* Steps body */
.steps-body {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Step rows */
.step-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background 0.2s, opacity 0.3s;
}
.step-row.pending { opacity: 0.35; }
.step-row.active  { opacity: 1; background: rgba(59,130,246,0.07); }
.step-row.done    { opacity: 0.75; }

.step-status-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-done {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #22c55e;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-active {
  width: 18px;
  height: 18px;
  border: 2px solid var(--primary, #3b82f6);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: block;
}
.icon-pending {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: block;
}

.step-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  flex: 1;
  min-width: 0;
}
.step-detail-text {
  font-size: 11px;
  color: var(--text-dim);
  text-align: right;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Overall progress bar */
.overall-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 0 10px;
}
.progress-track {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--primary, #3b82f6);
  border-radius: 2px;
  transition: width 0.5s ease;
}
.progress-fill.fill-done { background: #22c55e; }
.progress-pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  min-width: 32px;
  text-align: right;
}

/* Data quality indicator */
.quality-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 0;
  font-size: 12px;
}
.qs-label { color: var(--text-dim); white-space: nowrap; }
.qs-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 9px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-weight: 700;
  line-height: 1;
}

/* Done CTA */
.done-cta {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}
.done-summary {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.done-score {
  font-size: 13px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 5px;
}
.done-score b { font-size: 18px; }
.done-grade {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 8px;
  font-weight: 700;
}
.btn-view-result {
  padding: 10px 18px;
  border-radius: 10px;
  background: var(--primary, #3b82f6);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}
.btn-view-result:active { opacity: 0.8; }

/* Transition */
.agent-overlay-enter-active { transition: opacity 0.25s ease; }
.agent-overlay-leave-active { transition: opacity 0.2s ease; }
.agent-overlay-enter-from, .agent-overlay-leave-to { opacity: 0; }
.agent-overlay-enter-active .agent-panel,
.agent-overlay-leave-active .agent-panel {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.agent-overlay-enter-from .agent-panel,
.agent-overlay-leave-to .agent-panel {
  transform: translateY(40px);
}
@media (min-width: 769px) {
  .agent-overlay-enter-from .agent-panel,
  .agent-overlay-leave-to .agent-panel {
    transform: scale(0.96) translateY(8px);
  }
}
</style>
