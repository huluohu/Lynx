import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 通用触摸滑动检测 composable
 * @param {Ref<HTMLElement>} elRef - 目标元素的 ref
 * @param {Object} options
 * @param {number} options.threshold - 最小滑动距离(px)，默认 30
 * @param {number} options.velocityThreshold - 最小速度(px/ms)，默认 0.3
 * @param {Function} options.onSwipeStart - 滑动开始回调 ({ x, y })
 * @param {Function} options.onSwipeMove - 滑动中回调 ({ deltaX, deltaY, dirX, dirY })
 * @param {Function} options.onSwipeEnd - 滑动结束回调 ({ direction, deltaX, deltaY, velocity })
 * @param {string[]} options.lockDirection - 锁定方向后忽略其他方向 ['horizontal'|'vertical']
 */
export function useSwipe(elRef, options = {}) {
  const {
    threshold = 30,
    velocityThreshold = 0.3,
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
    lockDirection = null,
  } = options

  const isSwiping = ref(false)
  const direction = ref(null) // 'left'|'right'|'up'|'down'

  let startX = 0
  let startY = 0
  let startTime = 0
  let lockedAxis = null // 'horizontal' | 'vertical' | null

  function handleTouchStart(e) {
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    startTime = Date.now()
    lockedAxis = null
    isSwiping.value = false
    direction.value = null
    onSwipeStart?.({ x: startX, y: startY })
  }

  function handleTouchMove(e) {
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    const absDx = Math.abs(deltaX)
    const absDy = Math.abs(deltaY)

    // Determine axis lock on first significant move
    if (!lockedAxis && (absDx > 8 || absDy > 8)) {
      lockedAxis = absDx > absDy ? 'horizontal' : 'vertical'
    }

    // If lockDirection is specified, only respond to that axis
    if (lockDirection && lockedAxis && lockDirection !== lockedAxis) {
      return
    }

    if (absDx > threshold || absDy > threshold) {
      isSwiping.value = true
    }

    const dirX = deltaX > 0 ? 'right' : 'left'
    const dirY = deltaY > 0 ? 'down' : 'up'

    onSwipeMove?.({ deltaX, deltaY, dirX, dirY, lockedAxis, event: e })
  }

  function handleTouchEnd(e) {
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    const elapsed = Date.now() - startTime
    const absDx = Math.abs(deltaX)
    const absDy = Math.abs(deltaY)

    const velocity = Math.max(absDx, absDy) / elapsed

    let dir = null
    if (absDx > absDy && absDx > threshold) {
      dir = deltaX > 0 ? 'right' : 'left'
    } else if (absDy > absDx && absDy > threshold) {
      dir = deltaY > 0 ? 'down' : 'up'
    }

    // Check velocity for quick flicks (lower distance threshold)
    if (!dir && velocity > velocityThreshold) {
      if (absDx > absDy) {
        dir = deltaX > 0 ? 'right' : 'left'
      } else {
        dir = deltaY > 0 ? 'down' : 'up'
      }
    }

    direction.value = dir
    isSwiping.value = false

    onSwipeEnd?.({ direction: dir, deltaX, deltaY, velocity, elapsed })
  }

  onMounted(() => {
    const el = elRef?.value || elRef
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    const el = elRef?.value || elRef
    if (!el) return
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
  })

  return { isSwiping, direction }
}
