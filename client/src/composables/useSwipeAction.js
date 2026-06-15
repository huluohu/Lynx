import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 列表项左滑露出操作按钮 composable
 * @param {Ref<HTMLElement>} itemRef - 列表项元素 ref
 * @param {Object} options
 * @param {number} options.actionWidth - 操作区域宽度，默认 80
 * @param {number} options.threshold - 触发展开的最小滑动距离，默认 40
 * @param {Function} options.onOpen - 展开回调
 * @param {Function} options.onClose - 关闭回调
 */
export function useSwipeAction(itemRef, options = {}) {
  const {
    actionWidth = 80,
    threshold = 40,
    onOpen,
    onClose,
  } = options

  const offsetX = ref(0)
  const isOpen = ref(false)

  let startX = 0
  let startY = 0
  let currentOffset = 0
  let lockedAxis = null
  let isDragging = false

  function handleTouchStart(e) {
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    currentOffset = offsetX.value
    lockedAxis = null
    isDragging = false
  }

  function handleTouchMove(e) {
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    const absDx = Math.abs(deltaX)
    const absDy = Math.abs(deltaY)

    // Determine axis lock
    if (!lockedAxis && (absDx > 8 || absDy > 8)) {
      lockedAxis = absDx > absDy ? 'horizontal' : 'vertical'
    }

    // Only handle horizontal swipes
    if (lockedAxis !== 'horizontal') return

    isDragging = true
    e.preventDefault()

    let newOffset = currentOffset + deltaX
    // Clamp: no right swipe beyond 0, no left swipe beyond actionWidth
    newOffset = Math.max(-actionWidth, Math.min(0, newOffset))
    offsetX.value = newOffset
  }

  function handleTouchEnd() {
    if (!isDragging) return

    // Snap open or closed based on threshold
    if (offsetX.value < -threshold) {
      offsetX.value = -actionWidth
      if (!isOpen.value) {
        isOpen.value = true
        onOpen?.()
      }
    } else {
      offsetX.value = 0
      if (isOpen.value) {
        isOpen.value = false
        onClose?.()
      }
    }
    isDragging = false
  }

  function close() {
    offsetX.value = 0
    isOpen.value = false
  }

  function open() {
    offsetX.value = -actionWidth
    isOpen.value = true
  }

  onMounted(() => {
    const el = itemRef?.value
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    const el = itemRef?.value
    if (!el) return
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
  })

  return { offsetX, isOpen, close, open }
}
