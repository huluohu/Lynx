import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router.js'
import App from './App.vue'
import i18n from './i18n/index.js'
import { usePreferencesStore } from './stores/preferences.js'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(router)
usePreferencesStore(pinia).initialize()
app.mount('#app')
