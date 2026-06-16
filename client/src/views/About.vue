<template>
  <div class="about-page">
    <div class="page-header page-header-mobile-empty">
      <h1 class="page-title">{{ t('settings.about.title') }}</h1>
      <div class="page-header-right">
        <div class="page-header-actions">
          <button
            class="btn btn-inline-icon"
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
      </div>
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
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '../stores/preferences.js'
import { api } from '../utils/api.js'
import { appVersion } from '../utils/appVersion.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'

const { t } = useI18n()
const preferencesStore = usePreferencesStore()
const loading = ref(false)
const error = ref('')
const systemInfo = ref(null)
const mobilePageActions = useMobilePageActions()

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

watchEffect(() => {
  mobilePageActions.setActions([
    {
      key: 'refresh-about',
      label: loading.value ? t('common.refreshing') : t('common.refresh'),
      disabled: loading.value,
      onSelect: loadSystemInfo,
    },
  ])
})

onMounted(loadSystemInfo)

onUnmounted(() => {
  mobilePageActions.clearActions()
})
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

.btn-inline-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-inline-icon svg {
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

</style>
