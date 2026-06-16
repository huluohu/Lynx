import { isRef, onBeforeUnmount, watch } from 'vue'

const state = {
  count: 0,
  scrollY: 0,
  bodyStyle: null,
}

function isLockedSource(source) {
  return Boolean(isRef(source) ? source.value : source)
}

function lockDocumentScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  if (state.count === 0) {
    const { body, documentElement } = document
    state.scrollY = window.scrollY
    state.bodyStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }

    documentElement.classList.add('scroll-lock-root')
    body.classList.add('scroll-lock-body')
    body.style.position = 'fixed'
    body.style.top = `-${state.scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
  }

  state.count += 1
}

function unlockDocumentScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || state.count === 0) return

  state.count -= 1
  if (state.count > 0) return

  const { body, documentElement } = document
  const previous = state.bodyStyle || {
    position: '',
    top: '',
    left: '',
    right: '',
    width: '',
    overflow: '',
  }

  body.style.position = previous.position
  body.style.top = previous.top
  body.style.left = previous.left
  body.style.right = previous.right
  body.style.width = previous.width
  body.style.overflow = previous.overflow
  body.classList.remove('scroll-lock-body')
  documentElement.classList.remove('scroll-lock-root')
  window.scrollTo(0, state.scrollY)
  state.bodyStyle = null
  state.scrollY = 0
}

export function useDocumentScrollLock(source) {
  let active = false

  watch(
    () => isLockedSource(source),
    (next) => {
      if (next === active) return
      active = next
      if (next) {
        lockDocumentScroll()
      } else {
        unlockDocumentScroll()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (!active) return
    active = false
    unlockDocumentScroll()
  })
}
