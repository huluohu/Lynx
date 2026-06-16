import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../utils/api.js'

export const useNotificationsStore = defineStore('notifications', () => {
  const unreadCount = ref(0)
  const changeToken = ref(0)

  async function fetchUnreadCount() {
    const res = await api('/api/notifications/unread-count')
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error || 'Load failed')
    }
    unreadCount.value = json.data.count || 0
    return unreadCount.value
  }

  async function notifyChanged({ refreshUnread = true } = {}) {
    changeToken.value = Date.now()
    if (refreshUnread) {
      try {
        await fetchUnreadCount()
      } catch {
        // Keep current badge value on transient failures.
      }
    }
  }

  function reset() {
    unreadCount.value = 0
    changeToken.value = 0
  }

  return {
    unreadCount,
    changeToken,
    fetchUnreadCount,
    notifyChanged,
    reset,
  }
})
