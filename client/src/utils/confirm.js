import { ref, createApp, h, nextTick } from 'vue'

// 全局确认弹窗状态
const state = ref({
  visible: false,
  title: '确认操作',
  message: '确定要执行此操作吗？',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  icon: null, // 'delete' | 'logout' | 'warning' | null
  resolve: null,
})

export function useConfirmState() {
  return state
}

/**
 * 程序化确认弹窗
 * @param {Object|string} options - 配置对象或消息字符串
 * @returns {Promise<boolean>}
 */
export function useConfirm() {
  return function confirm(options) {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise((resolve) => {
      state.value = {
        visible: true,
        title: opts.title || '确认操作',
        message: opts.message || '确定要执行此操作吗？',
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        danger: opts.danger ?? false,
        icon: opts.icon || null,
        resolve,
      }
    })
  }
}

export function resolveConfirm(result) {
  if (state.value.resolve) {
    state.value.resolve(result)
  }
  state.value.visible = false
  state.value.resolve = null
}
