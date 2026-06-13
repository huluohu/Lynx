import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'success', duration = 2500) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    if (type !== 'loading') {
      setTimeout(() => remove(id), duration)
    }
    return id
  }

  function remove(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(msg) { return show(msg, 'success') }
  function error(msg) { return show(msg, 'error', 3500) }
  function info(msg) { return show(msg, 'info') }

  return { toasts, show, remove, success, error, info }
}
