<template>
  <div>
    <div class="page-header"><h1 class="page-title">📰 资讯</h1></div>

    <div class="card" v-if="news.length">
      <div v-for="n in news" :key="n.id" style="padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer" @click="markRead(n)">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:600" :style="{ color: n.read ? 'var(--text-dim)' : 'var(--text)' }">{{ n.title }}</span>
          <span v-if="!n.read" class="badge badge-buy" style="font-size:10px">NEW</span>
        </div>
        <div v-if="n.summary" style="font-size:12px;color:var(--text-dim)">{{ n.summary }}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;display:flex;gap:12px">
          <span>{{ n.source }}</span>
          <span>{{ n.published_at }}</span>
          <a v-if="n.url" :href="n.url" target="_blank" @click.stop>查看原文</a>
        </div>
      </div>
    </div>
    <div v-else class="card empty"><div class="empty-icon">📰</div><p>暂无资讯</p></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const news = ref([])
async function fetch() {
  const res = await fetch('/api/news')
  const json = await res.json()
  news.value = json.data || []
}
async function markRead(n) {
  if (n.read) return
  await fetch(`/api/news/${n.id}`, { method: 'PUT' })
  n.read = 1
}
onMounted(fetch)
</script>
