<template>
  <div class="about-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('settings.about.title') }}</h1>
      <button
        class="about-refresh-button"
        :title="loading ? t('common.refreshing') : t('common.refresh')"
        @click="loadSystemInfo"
        :disabled="loading"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        <span>{{ loading ? t('common.refreshing') : t('common.refresh') }}</span>
      </button>
    </div>

    <div class="card">
      <div v-if="error" class="alert">{{ error }}</div>
      <div v-for="item in aboutItems" :key="item.key" class="about-row">
        <span class="about-label">{{ item.label }}</span>
        <span class="about-value">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '../stores/preferences.js'
import { api } from '../utils/api.js'

const { t } = useI18n()
const preferencesStore = usePreferencesStore()
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const loading = ref(false)
const error = ref('')
const systemInfo = ref(null)

const aboutItems = computed(() => [
  { key: 'version', label: t('settings.about.version'), value: appVersion || t('settings.about.unavailable') },
  { key: 'serverVersion', label: t('settings.about.serverVersion'), value: systemInfo.value?.serverVersion || t('settings.about.unavailable') },
  { key: 'dataDirectory', label: t('settings.about.dataDirectory'), value: systemInfo.value?.dataDirectory || t('settings.about.unavailable') },
  { key: 'databasePath', label: t('settings.about.databasePath'), value: systemInfo.value?.databasePath || t('settings.about.unavailable') },
  { key: 'timezone', label: t('settings.about.timezone'), value: systemInfo.value?.timezone || t('settings.about.unavailable') },
  { key: 'language', label: t('settings.about.language'), value: t(`preferences.languages.${preferencesStore.language}`) },
  { key: 'theme', label: t('settings.about.theme'), value: t(`preferences.themes.${preferencesStore.theme}`) },
])

async function loadSystemInfo() {
  loading.value = true
  error.value = ''
  try {
    const res = await api('/api/system/info')
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('common.unknownError'))
    systemInfo.value = json.data
  } catch (err) {
    error.value = t('settings.about.loadFailed', { message: err.message })
  } finally {
    loading.value = false
  }
}

onMounted(loadSystemInfo)
</script>

<style scoped>
.about-page {
  max-width: 720px;
}

.about-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.about-row:last-child {
  border-bottom: none;
}

.about-refresh-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.about-refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.about-refresh-button svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.about-label {
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 600;
}

.about-value {
  font-size: 14px;
  color: var(--text);
  word-break: break-all;
}

@media (max-width: 768px) {
  .about-refresh-button {
    min-height: 36px;
    padding: 0 10px;
  }
}
</style>
