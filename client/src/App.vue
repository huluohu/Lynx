<template>
  <div class="app-layout" v-if="authStore.isLoggedIn">
    <AppToast />
    <!-- Menu toggle (mobile) -->
    <button class="menu-toggle" @click="sidebarOpen = !sidebarOpen">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
    </button>

    <!-- Overlay (mobile) -->
    <div class="sidebar-overlay" :class="{ show: sidebarOpen }" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">
        <span class="brand-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>
          投资罗盘
        </span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">概览</div>
        <router-link to="/" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          仪表盘
          <span v-if="unreadCount" class="nav-badge">{{ unreadCount }}</span>
        </router-link>

        <div class="nav-section">管理</div>
        <router-link to="/assets" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11l3-3 3 3"/></svg>
          资产
        </router-link>
        <router-link to="/holdings" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
          持仓
        </router-link>
        <router-link to="/history" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          交易记录
        </router-link>
        <router-link to="/alerts" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
          提醒
          <span v-if="unreadCount" class="nav-badge">{{ unreadCount }}</span>
        </router-link>

        <div class="nav-section">策略</div>
        <router-link to="/strategies" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          策略
        </router-link>
        <router-link to="/plans" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          操盘计划
        </router-link>

        <div class="nav-section">市场</div>
        <router-link to="/market" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          行情
        </router-link>
        <router-link to="/signals" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 12h3l2 5 4-10 3 7 2-4h4"/></svg>
          市场信号
        </router-link>
        <router-link to="/news" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M18 18h-8M18 10h-8"/></svg>
          资讯
        </router-link>

        <div class="nav-section">系统</div>
        <router-link to="/settings" class="nav-item" @click="sidebarOpen=false">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          设置
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <span class="sidebar-user">{{ authStore.username }}</span>
        <button class="sidebar-logout" @click="confirmLogout" title="退出登录">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          退出
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main">
      <router-view />
    </main>

    <!-- Mobile Bottom Nav -->
    <nav class="mobile-nav">
      <div class="mobile-nav-inner">
        <router-link to="/" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span>概览</span>
        </router-link>
        <router-link to="/holdings" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
          <span>持仓</span>
        </router-link>
        <router-link to="/market" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>行情</span>
        </router-link>
        <router-link to="/strategies" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          <span>策略</span>
        </router-link>
        <button class="mobile-nav-item" @click="moreMenuOpen = true">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          <span>更多</span>
        </button>
      </div>
    </nav>

    <!-- More Menu (mobile) -->
    <Teleport to="body">
      <Transition name="slide-up">
        <div v-if="moreMenuOpen" class="action-sheet-overlay" @click="moreMenuOpen = false">
          <div class="action-sheet" @click.stop>
            <router-link to="/assets" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11l3-3 3 3"/></svg>
              资产
            </router-link>
            <router-link to="/history" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              交易记录
            </router-link>
            <router-link to="/alerts" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
              提醒
              <span v-if="unreadCount" class="nav-badge" style="margin-left:auto">{{ unreadCount }}</span>
            </router-link>
            <router-link to="/signals" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 12h3l2 5 4-10 3 7 2-4h4"/></svg>
              市场信号
            </router-link>
            <router-link to="/news" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M18 18h-8M18 10h-8"/></svg>
              资讯
            </router-link>
            <router-link to="/plans" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              操盘计划
            </router-link>
            <router-link to="/settings" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              设置
            </router-link>
            <div class="action-sheet-cancel" @click="moreMenuOpen = false">取消</div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
  <div v-else>
    <AppToast />
    <router-view />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.js'
import { api } from './utils/api.js'
import AppToast from './components/AppToast.vue'

const router = useRouter()
const authStore = useAuthStore()
const sidebarOpen = ref(false)
const moreMenuOpen = ref(false)
const unreadCount = ref(0)
let pollTimer

async function fetchUnread() {
  if (!authStore.isLoggedIn) return
  try {
    const res = await api('/api/notifications/unread-count')
    const json = await res.json()
    if (json.success) unreadCount.value = json.data.count
  } catch { /* ignore */ }
}

function doLogout() {
  authStore.logout()
  router.push('/login')
}

function confirmLogout() {
  if (confirm('确定要退出登录吗？')) {
    doLogout()
  }
}

function startPolling() {
  fetchUnread()
  pollTimer = setInterval(fetchUnread, 30000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) startPolling()
  else { stopPolling(); unreadCount.value = 0 }
})

onMounted(() => {
  if (authStore.isLoggedIn) startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}
.brand-logo svg { color: var(--primary); }
.sidebar-brand {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-logout {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
  color: var(--text-muted);
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-family: inherit;
  border-radius: 4px;
}
.sidebar-logout:hover { opacity: 1; color: var(--red); }
.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sidebar-user {
  font-size: 12px;
  color: var(--text-muted);
}
.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.nav-badge {
  margin-left: auto;
  background: var(--red);
  color: #fff;
  font-size: 10px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
button.mobile-nav-item {
  background: none;
  border: none;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
</style>
