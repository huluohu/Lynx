import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

/**
 * 右滑返回上一页（从屏幕左侧边缘开始）
 * @param {Object} options
 * @param {number} options.edgeWidth - 左侧边缘检测区域宽度，默认 24px
 * @param {number} options.threshold - 触发返回的最小滑动距离，默认 80px
 */
export function useSwipeBack(options = {}) {
  const { edgeWidth = 24, threshold = 80 } = options
  const router = useRouter()

  let startX = 0
  let startY = 0
  let isEdgeSwipe = false
  let lockedAxis = null

  function onTouchStart(e) {
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    isEdgeSwipe = startX <= edgeWidth
    lockedAxis = null
  }

  function onTouchMove(e) {
    if (!isEdgeSwipe) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    if (!lockedAxis && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      lockedAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
    }

    // Only respond to horizontal swipes from edge
    if (lockedAxis === 'horizontal' && deltaX > 0) {
      e.preventDefault()
    }
  }

  function onTouchEnd(e) {
    if (!isEdgeSwipe) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - startX

    if (lockedAxis === 'horizontal' && deltaX >= threshold) {
      router.back()
    }

    isEdgeSwipe = false
    lockedAxis = null
  }

  // Only enable on mobile
  function isMobile() {
    return window.innerWidth <= 768
  }

  function onStart(e) { if (isMobile()) onTouchStart(e) }
  function onMove(e) { if (isMobile()) onTouchMove(e) }
  function onEnd(e) { if (isMobile()) onTouchEnd(e) }

  onMounted(() => {
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
  })

  onUnmounted(() => {
    document.removeEventListener('touchstart', onStart)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
  })
}
