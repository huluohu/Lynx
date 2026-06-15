import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from './stores/auth.js'

const routes = [
  { path: '/login', name: 'Login', component: () => import('./views/Login.vue'), meta: { public: true } },
  { path: '/', name: 'Dashboard', component: () => import('./views/Dashboard.vue') },
  { path: '/assets', name: 'Assets', component: () => import('./views/AssetList.vue') },
  { path: '/assets/add', name: 'AssetAdd', component: () => import('./views/AssetForm.vue') },
  { path: '/assets/:id', name: 'AssetDetail', component: () => import('./views/AssetDetail.vue') },
  { path: '/holdings', name: 'Holdings', component: () => import('./views/HoldingList.vue') },
  { path: '/strategies', name: 'Strategies', component: () => import('./views/StrategyList.vue') },
  { path: '/strategies/create', name: 'StrategyCreate', component: () => import('./views/StrategyForm.vue') },
  { path: '/strategies/:id/edit', name: 'StrategyEdit', component: () => import('./views/StrategyForm.vue') },
  { path: '/strategies/:id', name: 'StrategyDetail', component: () => import('./views/StrategyDetail.vue') },
  { path: '/plans', name: 'Plans', component: () => import('./views/PlanList.vue') },
  { path: '/market', name: 'Market', component: () => import('./views/MarketView.vue') },
  { path: '/news', name: 'News', component: () => import('./views/NewsList.vue') },
  { path: '/history', name: 'History', component: () => import('./views/HistoryList.vue') },
  { path: '/alerts', name: 'Alerts', component: () => import('./views/AlertHistory.vue') },
  { path: '/settings', name: 'Settings', component: () => import('./views/Settings.vue') },
  { path: '/:pathMatch(.*)*', name: 'NotFound', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  linkActiveClass: 'router-link-active',
  linkExactActiveClass: 'router-link-exact-active',
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.public) return next()
  if (!auth.isLoggedIn) return next('/login')
  next()
})

export default router
