import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router.js'
import App from './App.vue'
import i18n from './i18n/index.js'
import { usePreferencesStore } from './stores/preferences.js'
import './style.css'

function applyDisplayMode() {
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true
  document.documentElement.dataset.displayMode = standalone ? 'standalone' : 'browser'
}

function preventPageZoom() {
  document.addEventListener('gesturestart', event => event.preventDefault(), { passive: false })
  document.addEventListener('gesturechange', event => event.preventDefault(), { passive: false })
  document.addEventListener('gestureend', event => event.preventDefault(), { passive: false })
  document.addEventListener('touchmove', event => {
    if (event.touches?.length > 1) event.preventDefault()
  }, { passive: false })
  window.addEventListener('wheel', event => {
    if (event.ctrlKey) event.preventDefault()
  }, { passive: false })
}

applyDisplayMode()
preventPageZoom()

const standaloneMediaQuery = window.matchMedia?.('(display-mode: standalone)')
standaloneMediaQuery?.addEventListener?.('change', applyDisplayMode)
standaloneMediaQuery?.addListener?.(applyDisplayMode)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(router)
usePreferencesStore(pinia).initialize()
app.mount('#app')
