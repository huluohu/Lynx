import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../utils/api.js'

const SETTINGS_CACHE_TTL_MS = 30 * 1000

export const useRuntimeSettingsStore = defineStore('runtime-settings', () => {
  const values = ref({})
  const lastSyncedAt = ref(0)
  let syncInFlight = null

  async function syncFromServer({ force = false } = {}) {
    if (!force && Object.keys(values.value || {}).length > 0 && Date.now() - lastSyncedAt.value < SETTINGS_CACHE_TTL_MS) {
      return values.value
    }
    if (syncInFlight) return syncInFlight

    syncInFlight = (async () => {
      try {
        const res = await api('/api/settings')
        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error || 'Load failed')
        }
        values.value = { ...values.value, ...json.data }
        lastSyncedAt.value = Date.now()
        return values.value
      } finally {
        syncInFlight = null
      }
    })()

    return syncInFlight
  }

  function mergeValues(partial = {}) {
    values.value = { ...values.value, ...partial }
    return values.value
  }

  function getNumber(key, fallback = 0) {
    const value = Number(values.value[key])
    return Number.isFinite(value) ? value : fallback
  }

  function getBoolean(key, fallback = false) {
    const value = values.value[key]
    if (value == null || value === '') return fallback
    return String(value) === 'true'
  }

  return {
    values,
    lastSyncedAt,
    syncFromServer,
    mergeValues,
    getNumber,
    getBoolean,
  }
})
