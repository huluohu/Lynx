<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">资讯</h1>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span v-if="lastUpdated" class="update-hint">{{ fmtUpdateTime(lastUpdated) }} 更新</span>
        <button class="btn btn-sm" @click="cacheAll" :disabled="caching" v-if="pendingCacheCount > 0">
          {{ caching ? '缓存中...' : `缓存 (${pendingCacheCount})` }}
        </button>
        <button class="btn btn-sm btn-inline-icon" @click="refresh" :disabled="refreshing">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>{{ refreshing ? '刷新中...' : '刷新' }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="card">
      <div v-for="i in 4" :key="i" style="padding:14px 0;border-bottom:1px solid var(--border)">
        <div class="skeleton skeleton-text long"></div>
        <div class="skeleton skeleton-text short" style="margin-top:6px"></div>
      </div>
    </div>

    <div class="card" v-else-if="news.length">
      <div v-for="n in news" :key="n.id" class="news-item" @click="openNews(n)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span class="news-title" :class="{ read: n.read }">{{ n.title }}</span>
          <span v-if="!n.read" class="badge badge-buy" style="font-size:10px;flex-shrink:0;margin-left:8px">NEW</span>
        </div>
        <div v-if="n.summary" class="news-summary">{{ n.summary }}</div>
        <div class="news-meta">
          <span v-if="n.source" class="news-source">{{ n.source }}</span>
          <span>{{ formatTime(n.published_at) }}</span>
          <span class="cache-badge" :class="'cache-' + (n.cache_status || 'pending')">{{ cacheLabel(n.cache_status) }}</span>
          <a v-if="n.url" :href="n.url" target="_blank" @click.stop class="news-link">查看原文 ↗</a>
        </div>
      </div>
      <div v-if="total > news.length" style="text-align:center;padding:12px">
        <button class="btn btn-sm" @click="loadMore">加载更多</button>
      </div>
    </div>

    <div v-else class="card empty">
      <div class="empty-icon">📰</div>
      <p>暂无资讯</p>
      <p style="font-size:12px;color:var(--text-dim);margin-top:8px">点击刷新按钮获取最新资讯</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const toast = useToast()
const news = ref([])
const total = ref(0)
const loading = ref(true)
const refreshing = ref(false)
const caching = ref(false)
const page = ref(0)
const PAGE_SIZE = 20
const lastUpdated = ref(null)

const pendingCacheCount = computed(() => news.value.filter(n => n.cache_status === 'pending' && n.url).length)

async function loadData() {
  try {
    const res = await api(`/api/news?limit=${PAGE_SIZE}&offset=0`)
    const json = await res.json()
    news.value = json.data || []
    total.value = json.total || 0
    page.value = 1
    lastUpdated.value = new Date()
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  const offset = page.value * PAGE_SIZE
  const res = await api(`/api/news?limit=${PAGE_SIZE}&offset=${offset}`)
  const json = await res.json()
  if (json.data?.length) {
    news.value.push(...json.data)
    page.value++
  }
}

async function refresh() {
  refreshing.value = true
  try {
    const res = await api('/api/news/refresh', { method: 'POST' })
    const json = await res.json()
    await loadData()
    if (json.success) {
      const msg = json.message || '刷新完成'
      toast.success(msg)
    } else {
      toast.error(json.error || '刷新失败')
    }
  } catch (e) {
    toast.error('刷新失败: ' + e.message)
  } finally {
    refreshing.value = false
  }
}

function openNews(n) {
  if (!n.read) {
    api(`/api/news/${n.id}`, { method: 'PUT' })
    n.read = 1
  }
  // Lazy cache: trigger content fetch if pending
  if (n.cache_status === 'pending' && n.url) {
    n.cache_status = 'fetching'
    api(`/api/news/${n.id}/content`).then(r => r.json()).then(json => {
      if (json.data) n.cache_status = json.data.cache_status || 'failed'
    }).catch(() => { n.cache_status = 'failed' })
  }
  if (n.url) window.open(n.url, '_blank')
}

async function cacheAll() {
  caching.value = true
  try {
    const res = await api('/api/news/cache-batch', { method: 'POST', body: JSON.stringify({ limit: 10 }) })
    const json = await res.json()
    if (json.success) {
      toast.success(`已缓存 ${json.cached} 条`)
      await loadData()
    } else {
      toast.error('缓存失败')
    }
  } catch (e) {
    toast.error(e.message)
  }
  caching.value = false
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return ts.slice(0, 10)
}
function fmtUpdateTime(d) {
  if (!d) return ''
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function cacheLabel(status) {
  return { cached: '已缓存', fetching: '缓存中', failed: '缓存失败', pending: '待缓存' }[status || 'pending'] || '待缓存'
}

onMounted(loadData)
</script>

<style scoped>
.update-hint { font-size: 11px; color: var(--text-muted); }
.btn-inline-icon { display: inline-flex; align-items: center; gap: 6px; }
.btn-inline-icon svg { width: 14px; height: 14px; flex-shrink: 0; }
.news-item {
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}
.news-item:last-child { border-bottom: none; }
.news-item:hover { background: var(--bg-hover, rgba(0,0,0,0.02)); }
.news-title { font-weight: 600; line-height: 1.4; }
.news-title.read { color: var(--text-dim); font-weight: 400; }
.news-summary { font-size: 12px; color: var(--text-dim); margin-bottom: 6px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.news-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 12px; align-items: center; }
.news-source { background: var(--bg-dim, #f0f0f0); padding: 1px 6px; border-radius: 3px; }
.news-link { color: var(--primary); text-decoration: none; }
.news-link:hover { text-decoration: underline; }
.cache-badge { font-size: 10px; padding: 1px 5px; border-radius: 3px; }
.cache-cached { background: rgba(34,197,94,0.1); color: var(--green); }
.cache-fetching { background: rgba(59,130,246,0.1); color: var(--primary); }
.cache-failed { background: rgba(239,68,68,0.1); color: var(--red); }
.cache-pending { background: var(--bg-dim, #f0f0f0); color: var(--text-muted); }
.btn-sm { font-size: 12px; padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); cursor: pointer; }
.btn-sm:hover { background: var(--bg-hover, #f5f5f5); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
