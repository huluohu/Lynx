import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../utils/api.js'

export const useRuntimeSettingsStore = defineStore('runtime-settings', () => {
  const values = ref({})

  async function syncFromServer() {
    const res = await api('/api/settings')
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error || 'Load failed')
    }
    values.value = { ...values.value, ...json.data }
    return values.value
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
    syncFromServer,
    mergeValues,
    getNumber,
    getBoolean,
  }
})
