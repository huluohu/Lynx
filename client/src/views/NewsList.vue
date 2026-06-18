<template>
  <PullRefreshView :onRefresh="refresh">
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('newsList.title') }}</h1>
      <div class="page-header-right">
        <div class="page-header-meta">
          <span v-if="lastUpdated" class="page-header-meta-item">{{ t('newsList.updatedAt', { time: fmtUpdateTime(lastUpdated) }) }}</span>
        </div>
        <div class="desktop-only">
          <div class="page-header-actions">
            <button class="btn btn-sm" @click="cacheAll" :disabled="caching" v-if="pendingCacheCount > 0">
              {{ caching ? t('newsList.caching') : t('newsList.cacheAction', { count: pendingCacheCount }) }}
            </button>
            <button class="btn btn-sm btn-inline-icon" @click="refresh" :disabled="refreshing">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              <span>{{ refreshing ? t('newsList.refreshing') : t('common.refresh') }}</span>
            </button>
          </div>
        </div>
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
          <span v-if="!n.read" class="badge badge-buy" style="font-size:10px;flex-shrink:0;margin-left:8px">{{ t('newsList.newBadge') }}</span>
        </div>
        <div v-if="n.summary" class="news-summary">{{ n.summary }}</div>
        <div class="news-meta">
          <span v-if="n.source" class="news-source">{{ n.source }}</span>
          <span>{{ formatTime(n.published_at) }}</span>
          <span class="cache-badge" :class="'cache-' + (n.cache_status || 'pending')">{{ cacheLabel(n.cache_status) }}</span>
          <a v-if="n.url" :href="n.url" target="_blank" @click.stop class="news-link">{{ t('newsList.readOriginal') }}</a>
        </div>
      </div>
      <div v-if="total > news.length" style="text-align:center;padding:12px">
        <button class="btn btn-sm" @click="loadMore">{{ t('newsList.loadMore') }}</button>
      </div>
    </div>

    <div v-else class="card empty">
      <div class="empty-icon"><AppIcon name="news" size="34" /></div>
      <p>{{ t('newsList.empty') }}</p>
      <p style="font-size:12px;color:var(--text-dim);margin-top:8px">{{ t('newsList.emptyHint') }}</p>
    </div>

    <AppDrawer v-model="detailDrawerOpen" :title="displayNewsTitle || t('newsList.detailTitle')" mobileHeight="fixed">
      <div v-if="detailLoading" class="news-detail-loading">
        <div class="skeleton skeleton-text long"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
      <div v-else-if="selectedNews" class="news-detail">
        <div class="news-detail-meta">
          <span v-if="selectedNews.source" class="news-source">{{ selectedNews.source }}</span>
          <span>{{ formatClockTime(selectedNews.published_at, { second: '2-digit' }) }}</span>
          <span class="cache-badge cache-cached">{{ cacheLabel(selectedNews.cache_status) }}</span>
        </div>
        <div class="news-detail-actions">
          <select class="form-select news-translate-select" v-model="translateTarget" :disabled="translating">
            <option value="auto">{{ t('newsList.translateAuto') }}</option>
            <option value="简体中文">{{ t('newsList.translateToZh') }}</option>
            <option value="English">{{ t('newsList.translateToEn') }}</option>
          </select>
          <button v-if="!translatedNews" class="btn btn-sm" type="button" @click="translateSelectedNews" :disabled="translating">
            {{ translating ? t('newsList.translatingProgress', { count: translatedChunkCount }) : t('newsList.translate') }}
          </button>
          <button v-else class="btn btn-sm" type="button" @click="restoreOriginalNews" :disabled="translating">{{ t('newsList.restoreOriginal') }}</button>
        </div>
        <div v-if="translationInfo" class="translation-info">{{ translationInfo }}</div>
        <div v-if="translating || translatedTotalChunks" class="translation-progress">
          <div class="translation-progress-bar"><span :style="{ width: translationProgressPct + '%' }"></span></div>
          <span>{{ translationProgressText }}</span>
        </div>
        <div class="news-detail-content">
          <p v-if="translating && translatedNews && !displayNewsContent" class="translation-placeholder">{{ t('newsList.translationWaiting') }}</p>
          <template v-for="(block, index) in formattedDetailBlocks" :key="index">
            <h3 v-if="block.type === 'heading'">{{ block.text }}</h3>
            <ul v-else-if="block.type === 'list'">
              <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
            </ul>
            <p v-else>{{ block.text }}</p>
          </template>
        </div>
        <a v-if="selectedNews.url" :href="selectedNews.url" target="_blank" class="btn news-detail-original">{{ t('newsList.readOriginal') }}</a>
      </div>
    </AppDrawer>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { formatRelativeTimeFromNow, formatTime as formatClockTime } from '../utils/formatters.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import PullRefreshView from '../components/PullRefreshView.vue'
import AppDrawer from '../components/AppDrawer.vue'
import AppIcon from '../components/AppIcon.vue'

const toast = useToast()
const { t } = useI18n()
const news = ref([])
const total = ref(0)
const loading = ref(true)
const refreshing = ref(false)
const caching = ref(false)
const page = ref(0)
const PAGE_SIZE = 20
const lastUpdated = ref(null)
const mobilePageActions = useMobilePageActions()
const detailDrawerOpen = ref(false)
const detailLoading = ref(false)
const selectedNews = ref(null)
const translatedNews = ref(null)
const translating = ref(false)
const translateTarget = ref('auto')
const translatedChunkCount = ref(0)
const translatedTotalChunks = ref(0)
const translationInfo = ref('')

const pendingCacheCount = computed(() => news.value.filter(n => n.cache_status === 'pending' && n.url).length)
const displayNewsTitle = computed(() => translatedNews.value?.title || selectedNews.value?.title || '')
const displayNewsContent = computed(() => translatedNews.value?.content || translatedNews.value?.summary || selectedNews.value?.content || selectedNews.value?.summary || '')
const formattedDetailBlocks = computed(() => formatArticleBlocks(displayNewsContent.value))
const translationProgressPct = computed(() => translatedTotalChunks.value ? Math.min(100, Math.round(translatedChunkCount.value / translatedTotalChunks.value * 100)) : (translating.value ? 8 : 0))
const translationProgressText = computed(() => translatedTotalChunks.value
  ? t('newsList.translationProgress', { done: translatedChunkCount.value, total: translatedTotalChunks.value })
  : t('newsList.translationPreparing'))

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
      toast.success(t('newsList.refreshSuccess'))
    } else {
      toast.error(json.error || t('newsList.refreshFailed'))
    }
  } catch (e) {
    toast.error(t('newsList.refreshFailedWithMessage', { message: e.message }))
  } finally {
    refreshing.value = false
  }
}

async function openNews(n) {
  translatedNews.value = null
  translatedChunkCount.value = 0
  translatedTotalChunks.value = 0
  translationInfo.value = ''
  if (!n.read) {
    api(`/api/news/${n.id}`, { method: 'PUT' })
    n.read = 1
  }
  if (n.cache_status === 'cached') {
    detailDrawerOpen.value = true
    detailLoading.value = true
    selectedNews.value = { ...n }
    try {
      const res = await api(`/api/news/${n.id}/content`)
      const json = await res.json()
      if (json.data) selectedNews.value = { ...n, ...json.data, cache_status: json.data.cache_status || n.cache_status }
    } catch (e) {
      toast.error(e.message)
    }
    detailLoading.value = false
    return
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

async function translateSelectedNews() {
  if (!selectedNews.value?.id || translating.value) return
  translating.value = true
  translatedChunkCount.value = 0
  translatedTotalChunks.value = 0
  translationInfo.value = ''
  translatedNews.value = { title: selectedNews.value.title, summary: selectedNews.value.summary || '', content: '' }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/news/${selectedNews.value.id}/translate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ target_language: translateTarget.value }),
      signal: controller.signal,
    })
    if (!res.ok || !res.body) throw new Error(t('newsList.translateFailed'))
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) handleTranslationEvent(line)
    }
    if (buffer.trim()) handleTranslationEvent(buffer)
  } catch (error) {
    toast.error(error.name === 'AbortError' ? t('newsList.translateTimeout') : (error.message || t('newsList.translateFailed')))
  } finally {
    clearTimeout(timeout)
    translating.value = false
  }
}

function restoreOriginalNews() {
  translatedNews.value = null
  translatedChunkCount.value = 0
  translatedTotalChunks.value = 0
  translationInfo.value = ''
}

function handleTranslationEvent(line) {
  if (!line?.trim()) return
  let event
  try { event = JSON.parse(line) } catch { return }
  if (event.event === 'error') throw new Error(event.error || t('newsList.translateFailed'))
  if (event.event === 'start') {
    translationInfo.value = t('newsList.translationDirection', { source: event.source_language || '-', target: event.target_language || '-' })
    return
  }
  if (event.event === 'meta') {
    translatedNews.value = { ...(translatedNews.value || {}), ...event.data, content: '' }
    translationInfo.value = t('newsList.translationDirection', { source: event.data.source_language || '-', target: event.data.target_language || '-' })
    return
  }
  if (event.event === 'chunk_start') {
    translatedTotalChunks.value = Number(event.total || translatedTotalChunks.value || 0)
    translationInfo.value = t('newsList.translationChunkProgress', { current: Number(event.index || 0) + 1, total: event.total || '-' })
    return
  }
  if (event.event === 'chunk') {
    translatedTotalChunks.value = Number(event.total || translatedTotalChunks.value || 0)
    translatedChunkCount.value = Math.max(translatedChunkCount.value, Number(event.index || 0) + 1)
    const prefix = translatedNews.value?.content ? '\n\n' : ''
    translatedNews.value = { ...(translatedNews.value || {}), content: `${translatedNews.value?.content || ''}${prefix}${event.text || ''}` }
    if (event.warnings?.length) translationInfo.value = t('newsList.translationPartialWarning')
    return
  }
  if (event.event === 'done') {
    translatedNews.value = event.data || translatedNews.value
    translatedChunkCount.value = event.data?.chunks || translatedChunkCount.value
    translatedTotalChunks.value = event.data?.chunks || translatedTotalChunks.value
    if (event.data?.warnings?.length) translationInfo.value = t('newsList.translationPartialWarning')
    else translationInfo.value = t('newsList.translationDone')
  }
}

async function cacheAll() {
  caching.value = true
  try {
    const res = await api('/api/news/cache-batch', { method: 'POST', body: JSON.stringify({ limit: 10 }) })
    const json = await res.json()
    if (json.success) {
      toast.success(t('newsList.cacheSuccess', { count: json.cached }))
      await loadData()
    } else {
      toast.error(json.error || t('newsList.cacheFailed'))
    }
  } catch (e) {
    toast.error(e.message)
  }
  caching.value = false
}

function formatTime(ts) {
  return formatRelativeTimeFromNow(ts)
}
function fmtUpdateTime(d) {
  return formatClockTime(d)
}
function cacheLabel(status) {
  return {
    cached: t('newsList.cacheStatus.cached'),
    fetching: t('newsList.cacheStatus.fetching'),
    failed: t('newsList.cacheStatus.failed'),
    pending: t('newsList.cacheStatus.pending'),
  }[status || 'pending'] || t('newsList.cacheStatus.pending')
}

function formatArticleBlocks(content) {
  const lines = String(content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)

  const blocks = []
  let listItems = []
  const flushList = () => {
    if (listItems.length) {
      blocks.push({ type: 'list', items: listItems })
      listItems = []
    }
  }

  for (const line of lines) {
    const listMatch = line.match(/^[-*•]\s+(.+)/)
    if (listMatch) {
      listItems.push(listMatch[1])
      continue
    }
    flushList()
    const heading = line.length <= 42 && !/[。.!?！？]$/.test(line)
    blocks.push({ type: heading ? 'heading' : 'paragraph', text: line })
  }
  flushList()
  return blocks
}

watchEffect(() => {
  mobilePageActions.setActions([
    pendingCacheCount.value > 0 ? {
      key: 'cache-news',
      label: caching.value ? t('newsList.caching') : t('newsList.cacheAction', { count: pendingCacheCount.value }),
      disabled: caching.value,
      onSelect: cacheAll,
    } : null,
    {
      key: 'refresh-news',
      label: refreshing.value ? t('newsList.refreshing') : t('common.refresh'),
      disabled: refreshing.value,
      onSelect: refresh,
    },
  ])
})

onMounted(loadData)

onUnmounted(() => {
  mobilePageActions.clearActions()
})
</script>

<style scoped>
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
.news-detail-loading { padding: 8px 0; }
.news-detail { display: flex; flex-direction: column; gap: 14px; }
.news-detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--text-muted); font-size: 12px; }
.news-detail-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px; }
.news-translate-select { width: auto; min-width: 140px; font-size: 12px; padding: 5px 8px; }
.translation-info { color: var(--text-muted); font-size: 12px; margin-top: -6px; }
.translation-progress { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 12px; }
.translation-progress-bar { flex: 1; height: 4px; border-radius: 999px; background: var(--bg-dim); overflow: hidden; }
.translation-progress-bar span { display: block; height: 100%; border-radius: inherit; background: var(--primary); transition: width 0.2s ease; }
.translation-placeholder { color: var(--text-muted); font-style: italic; }
.news-detail-content { color: var(--text-dim); line-height: 1.75; font-size: 14px; }
.news-detail-content h3 { margin: 18px 0 8px; color: var(--text); font-size: 16px; line-height: 1.45; }
.news-detail-content h3:first-child { margin-top: 0; }
.news-detail-content p { margin: 0 0 12px; }
.news-detail-content ul { margin: 0 0 12px; padding-left: 20px; }
.news-detail-content li { margin-bottom: 6px; }
.news-detail-original { align-self: flex-start; margin-top: 4px; text-decoration: none; }
.btn-sm { font-size: 12px; padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); cursor: pointer; }
.btn-sm:hover { background: var(--bg-hover, #f5f5f5); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
  .news-meta { flex-wrap: wrap; gap: 6px; font-size: 12px; }
  .news-title { font-size: 15px; }
  .news-item { padding: 16px 0; }
  .btn-inline-icon { min-height: 36px; padding: 8px 12px; font-size: 13px; }
  .btn-sm { min-height: 36px; padding: 8px 12px; font-size: 13px; }
}
</style>
