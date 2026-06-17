import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from './stores/auth.js'

const routes = [
  { path: '/login', name: 'Login', component: () => import('./views/Login.vue'), meta: { public: true } },
  { path: '/', name: 'Dashboard', component: () => import('./views/Dashboard.vue'), meta: { titleKey: 'dashboard.title' } },
  { path: '/assets', name: 'Assets', component: () => import('./views/AssetList.vue'), meta: { titleKey: 'assetList.title' } },
  { path: '/assets/add', name: 'AssetAdd', component: () => import('./views/AssetForm.vue'), meta: { titleKey: 'assets.addTitle' } },
  { path: '/assets/:id', name: 'AssetDetail', component: () => import('./views/AssetDetail.vue'), meta: { titleKey: 'assetDetail.assetDetails' } },
  { path: '/holdings', name: 'Holdings', component: () => import('./views/HoldingList.vue'), meta: { titleKey: 'holdings.title' } },
  { path: '/strategies', name: 'Strategies', component: () => import('./views/StrategyList.vue'), meta: { titleKey: 'strategyList.title' } },
  { path: '/strategies/compare', name: 'StrategyCompare', component: () => import('./views/StrategyCompare.vue'), meta: { titleKey: 'strategyCompare.title' } },
  { path: '/strategies/create', name: 'StrategyCreate', component: () => import('./views/StrategyForm.vue'), meta: { titleKey: 'strategyForm.createTitle' } },
  { path: '/strategies/:id/edit', name: 'StrategyEdit', component: () => import('./views/StrategyForm.vue'), meta: { titleKey: 'strategyForm.editTitle' } },
  { path: '/strategies/:id', name: 'StrategyDetail', component: () => import('./views/StrategyDetail.vue'), meta: { titleKey: 'strategyDetail.title' } },
  { path: '/plans', name: 'Plans', component: () => import('./views/PlanList.vue'), meta: { titleKey: 'plans.title' } },
  { path: '/market', name: 'Market', component: () => import('./views/MarketView.vue'), meta: { titleKey: 'marketView.title' } },
  { path: '/market/:assetId', name: 'MarketDetail', component: () => import('./views/MarketDetail.vue'), meta: { titleKey: 'marketDetail.title' } },
  { path: '/signals', name: 'MarketSignals', component: () => import('./views/MarketSignals.vue'), meta: { titleKey: 'signals.title' } },
  { path: '/news', name: 'News', component: () => import('./views/NewsList.vue'), meta: { titleKey: 'newsList.title' } },
  { path: '/history', name: 'History', component: () => import('./views/HistoryList.vue'), meta: { titleKey: 'history.title' } },
  { path: '/alerts', name: 'Alerts', component: () => import('./views/AlertHistory.vue'), meta: { titleKey: 'alertHistory.title' } },
  { path: '/settings', name: 'Settings', component: () => import('./views/Settings.vue'), meta: { titleKey: 'settings.title' } },
  { path: '/about', name: 'About', component: () => import('./views/About.vue'), meta: { titleKey: 'settings.about.title' } },
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
