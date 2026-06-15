import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 下拉刷新 composable
 * @param {Object} options
 * @param {Ref<HTMLElement>} options.containerRef - 滚动容器（默认使用 document）
 * @param {Function} options.onRefresh - 刷新回调，应返回 Promise
 * @param {number} options.threshold - 触发刷新的下拉距离，默认 60
 * @param {number} options.maxPull - 最大下拉距离，默认 120
 */
export function usePullRefresh(options = {}) {
  const {
    containerRef = null,
    onRefresh,
    threshold = 60,
    maxPull = 120,
  } = options

  const pullDistance = ref(0)
  const isPulling = ref(false)
  const isRefreshing = ref(false)

  let startY = 0
  let pulling = false

  function canPull() {
    // Only allow pull when scrolled to top
    const el = containerRef?.value || document.documentElement
    return el.scrollTop <= 0
  }

  function handleTouchStart(e) {
    if (isRefreshing.value) return
    startY = e.touches[0].clientY
    pulling = false
  }

  function handleTouchMove(e) {
    if (isRefreshing.value) return
    if (!canPull()) {
      pulling = false
      pullDistance.value = 0
      return
    }

    const deltaY = e.touches[0].clientY - startY
    if (deltaY <= 0) {
      pulling = false
      pullDistance.value = 0
      isPulling.value = false
      return
    }

    // Apply resistance curve
    const resistance = 0.4
    const distance = Math.min(deltaY * resistance, maxPull)

    if (distance > 10) {
      pulling = true
      isPulling.value = true
      pullDistance.value = distance
      e.preventDefault()
    }
  }

  async function handleTouchEnd() {
    if (!pulling || isRefreshing.value) {
      pullDistance.value = 0
      isPulling.value = false
      return
    }

    if (pullDistance.value >= threshold && onRefresh) {
      isRefreshing.value = true
      pullDistance.value = threshold * 0.6 // Stay at indicator position
      try {
        await onRefresh()
      } catch (e) {
        // ignore
      }
      isRefreshing.value = false
    }

    pullDistance.value = 0
    isPulling.value = false
    pulling = false
  }

  onMounted(() => {
    const el = containerRef?.value || document
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    const el = containerRef?.value || document
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
  })

  return { pullDistance, isPulling, isRefreshing }
}
