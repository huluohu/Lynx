<template>
  <div class="app-layout">
    <!-- Menu toggle (mobile) -->
    <button class="menu-toggle" @click="sidebarOpen = !sidebarOpen">☰</button>

    <!-- Overlay (mobile) -->
    <div class="sidebar-overlay" :class="{ show: sidebarOpen }" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">
        <span>🧭 投资罗盘</span>
        <button class="sidebar-logout" @click="doLogout" title="退出登录">🚪</button>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">概览</div>
        <router-link to="/" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">📊</span> 仪表盘
          <span v-if="unreadCount" class="nav-badge">{{ unreadCount }}</span>
        </router-link>

        <div class="nav-section">管理</div>
        <router-link to="/assets" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">💰</span> 资产
        </router-link>
        <router-link to="/holdings" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">📦</span> 持仓
        </router-link>
        <router-link to="/history" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">📝</span> 交易记录
        </router-link>

        <div class="nav-section">策略</div>
        <router-link to="/strategies" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">🎯</span> 策略
        </router-link>
        <router-link to="/plans" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">📋</span> 操盘计划
        </router-link>

        <div class="nav-section">市场</div>
        <router-link to="/market" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">📈</span> 行情
        </router-link>
        <router-link to="/news" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">📰</span> 资讯
        </router-link>

        <div class="nav-section">系统</div>
        <router-link to="/settings" class="nav-item" @click="sidebarOpen=false">
          <span class="icon">⚙️</span> 设置
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <span style="font-size:11px;color:var(--text-muted)">{{ authStore.username }}</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main">
      <router-view />
    </main>

    <!-- Mobile Bottom Nav -->
    <nav class="mobile-nav">
      <div class="mobile-nav-inner">
        <router-link to="/" class="mobile-nav-item"><span class="icon">📊</span>概览</router-link>
        <router-link to="/assets" class="mobile-nav-item"><span class="icon">💰</span>资产</router-link>
        <router-link to="/market" class="mobile-nav-item"><span class="icon">📈</span>行情</router-link>
        <router-link to="/strategies" class="mobile-nav-item"><span class="icon">🎯</span>策略</router-link>
        <router-link to="/settings" class="mobile-nav-item"><span class="icon">⚙️</span>设置</router-link>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.js'

const router = useRouter()
const authStore = useAuthStore()
const sidebarOpen = ref(false)
const unreadCount = ref(0)
let pollTimer

async function fetchUnread() {
  try {
    const res = await fetch('/api/notifications/unread-count', { headers: authStore.getHeaders() })
    const json = await res.json()
    if (json.success) unreadCount.value = json.data.count
  } catch { /* ignore */ }
}

function doLogout() {
  authStore.logout()
  router.push('/login')
}

onMounted(() => {
  fetchUnread()
  pollTimer = setInterval(fetchUnread, 30000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})
</script>

<style scoped>
.sidebar-brand {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-logout {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.sidebar-logout:hover { opacity: 1; }
.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
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
</style>
