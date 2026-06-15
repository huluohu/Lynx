<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title">设置</h1>
    </div>

    <div class="settings-container">
      <!-- 资讯配置 -->
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">资讯抓取</span>
          <button class="save-btn" :class="{ changed: dirty.news }" @click="saveGroup('news')">
            {{ saveState.news === 'saved' ? '✓ 已保存' : '保存' }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">刷新间隔</span>
              <span class="setting-desc">自动抓取新资讯的频率</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="5" v-model="form.news_refresh_interval" @input="dirty.news = true" />
              <span class="setting-unit">分钟</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">自动缓存详情</span>
              <span class="setting-desc">刷新后自动抓取文章全文内容</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form.news_auto_cache" true-value="true" false-value="false" @change="dirty.news = true" /><span class="slider"></span></label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">每批缓存数量</span>
              <span class="setting-desc">每次自动缓存的最大文章数</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" max="20" v-model="form.news_cache_batch_size" @input="dirty.news = true" />
              <span class="setting-unit">条</span>
            </div>
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">内置数据源</span>
            <div class="source-chips">
              <label v-for="src in builtinNewsSources" :key="src.key" class="source-chip" :class="{ active: enabledSources.includes(src.key) }">
                <input type="checkbox" :value="src.key" v-model="enabledSources" @change="dirty.news = true" />
                {{ src.label }}
              </label>
            </div>
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">自定义 RSS 源</span>
            <div v-if="customSources.length" class="custom-sources-list">
              <div v-for="cs in customSources" :key="cs.id" class="custom-source-item">
                <span class="custom-source-name">{{ cs.name }}</span>
                <span class="custom-source-url">{{ cs.url }}</span>
                <button class="btn-tiny danger" @click="deleteCustomSource(cs.id)">✕</button>
              </div>
            </div>
            <div class="add-source-row">
              <input class="setting-input-full" v-model="newSource.name" placeholder="名称" style="flex:1" />
              <input class="setting-input-full" v-model="newSource.url" placeholder="RSS URL" style="flex:2" />
              <button class="btn btn-sm" @click="addCustomSource" :disabled="!newSource.name || !newSource.url">添加</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 行情刷新 -->
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">行情与监控</span>
          <button class="save-btn" :class="{ changed: dirty.market }" @click="saveGroup('market')">
            {{ saveState.market === 'saved' ? '✓ 已保存' : '保存' }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">行情自动刷新间隔</span>
              <span class="setting-desc">前端自动请求最新行情（0=手动刷新）</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="0" v-model="form.market_refresh_interval" @input="dirty.market = true" />
              <span class="setting-unit">分钟</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">汇率缓存时长</span>
              <span class="setting-desc">USD/CNY 汇率的缓存有效期</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" v-model="form.rate_cache_duration" @input="dirty.market = true" />
              <span class="setting-unit">分钟</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">策略监控间隔</span>
              <span class="setting-desc">定时检查策略触发条件</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" v-model="form.strategy_monitor_interval" @input="dirty.market = true" />
              <span class="setting-unit">分钟</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">市场信号有效期</span>
              <span class="setting-desc">AI 生成的市场信号默认有效时长</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" v-model="form.signal_valid_hours" @input="dirty.market = true" />
              <span class="setting-unit">小时</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">价格异动阈值</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="decimal" step="0.1" v-model="form.price_alert_threshold" @input="dirty.market = true" />
              <span class="setting-unit">%</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">计划接近提醒阈值</span>
              <span class="setting-desc">价格距触发线在此范围内时提醒</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" v-model="form.plan_approaching_pct" @input="dirty.market = true" />
              <span class="setting-unit">%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 通知渠道 -->
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">消息推送</span>
          <button class="save-btn" :class="{ changed: dirty.push }" @click="saveGroup('push')">
            {{ saveState.push === 'saved' ? '✓ 已保存' : '保存' }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">启用推送</span>
              <span class="setting-desc">触发通知时推送到外部服务</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form.push_enabled" true-value="true" false-value="false" @change="dirty.push = true" /><span class="slider"></span></label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">推送渠道</span>
            </div>
            <select class="form-select" v-model="form.push_webhook_type" @change="dirty.push = true" style="max-width:160px">
              <option value="wecom">企业微信机器人</option>
              <option value="serverchan">Server酱</option>
              <option value="pushplus">PushPlus</option>
              <option value="bark">Bark</option>
              <option value="custom">自定义 Webhook</option>
            </select>
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">Webhook URL</span>
            <input class="setting-input-full" type="url" v-model="form.push_webhook_url" :placeholder="webhookPlaceholder" @input="dirty.push = true" />
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">测试推送</span>
              <span class="setting-desc">发送测试消息验证配置</span>
            </div>
            <button class="btn btn-sm" @click="testPush" :disabled="testingPush || !form.push_webhook_url">{{ testingPush ? '发送中...' : '发送测试' }}</button>
          </div>
        </div>
        <div class="settings-group-footer">支持企业微信群机器人、Server酱、PushPlus、Bark 等推送渠道。配置 Webhook URL 后即可接收实时通知。</div>
      </div>

      <!-- 通知事件 -->
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">通知事件</span>
        </div>
        <div class="settings-card">
          <div v-for="evt in notifyEvents" :key="evt.key" class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ evt.label }}</span>
              <span v-if="evt.desc" class="setting-desc">{{ evt.desc }}</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form[evt.key]" true-value="true" false-value="false" @change="saveKey(evt.key, form[evt.key])" /><span class="slider"></span></label>
          </div>
        </div>
      </div>

      <!-- AI 配置 -->
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">AI 策略生成</span>
          <button class="save-btn" :class="{ changed: dirty.ai }" @click="saveGroup('ai')">
            {{ saveState.ai === 'saved' ? '✓ 已保存' : '保存' }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">API 地址</span>
            <input class="setting-input-full" type="url" v-model="form.ai_api_url" placeholder="https://api.openai.com/v1/chat/completions" @input="dirty.ai = true" />
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">API Key</span>
            <input class="setting-input-full" type="password" v-model="form.ai_api_key" placeholder="sk-..." @input="dirty.ai = true" />
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">模型名称</span>
            </div>
            <input class="setting-input" type="text" v-model="form.ai_model" placeholder="gpt-4o-mini" style="width:160px" @input="dirty.ai = true" />
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">分析模型</span>
              <span class="setting-desc">Agent 研判用的模型（可选更强的模型）</span>
            </div>
            <input class="setting-input" type="text" v-model="form.agent_analysis_model" placeholder="同上" style="width:160px" @input="dirty.ai = true" />
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">搜索 API 地址 <span class="setting-desc">(可选，增强市场资讯获取)</span></span>
            <input class="setting-input-full" type="url" v-model="form.agent_search_api_url" placeholder="https://api.search.example/v1/search" @input="dirty.ai = true" />
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">搜索 API Key</span>
            <input class="setting-input-full" type="password" v-model="form.agent_search_api_key" placeholder="可选" @input="dirty.ai = true" />
          </div>
        </div>
        <div class="settings-group-footer">支持 OpenAI 兼容接口。策略 Agent 会先进行市场研判再生成操盘计划。搜索 API 可增强外部数据能力（可选）。</div>
      </div>

      <!-- 账号与安全 -->
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">账号与安全</span>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">登录凭据</span>
              <span class="setting-desc">通过环境变量 AUTH_USERNAME / AUTH_PASSWORD 配置</span>
            </div>
          </div>
          <div class="setting-item" @click="doLogout" style="cursor:pointer">
            <span class="setting-label" style="color:var(--red)">退出登录</span>
            <span style="color:var(--text-muted)">›</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { api } from '../utils/api.js'

const router = useRouter()
const authStore = useAuthStore()
const form = reactive({
  refresh_interval: '60',
  market_refresh_interval: '5',
  rate_cache_duration: '60',
  strategy_monitor_interval: '5',
  signal_valid_hours: '24',
  news_refresh_interval: '30',
  news_sources_enabled: 'coindesk,cointelegraph,coingecko',
  news_auto_cache: 'true',
  news_cache_batch_size: '5',
  price_alert_threshold: '2',
  plan_approaching_pct: '5',
  ai_api_url: '',
  ai_api_key: '',
  ai_model: '',
  agent_analysis_model: '',
  agent_search_api_url: '',
  agent_search_api_key: '',
  push_enabled: 'true',
  push_webhook_type: 'wecom',
  push_webhook_url: '',
  notify_plan_triggered: 'true',
  notify_plan_approaching: 'false',
  notify_stop_loss: 'true',
  notify_price_swing: 'true',
  notify_trade_executed: 'false',
})

const dirty = reactive({ market: false, ai: false, news: false, push: false })
const saveState = reactive({ market: '', ai: '', news: '', push: '' })
const enabledSources = ref(['coindesk', 'cointelegraph', 'coingecko'])
const customSources = ref([])
const newSource = reactive({ name: '', url: '' })
const testingPush = ref(false)

const webhookPlaceholder = computed(() => {
  const map = {
    wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
    serverchan: 'https://sctapi.ftqq.com/xxx.send',
    pushplus: 'https://www.pushplus.plus/send',
    bark: 'https://api.day.app/xxx',
    custom: 'https://your-webhook.example.com/notify',
  }
  return map[form.push_webhook_type] || map.custom
})

const builtinNewsSources = [
  { key: 'coindesk', label: 'CoinDesk' },
  { key: 'cointelegraph', label: 'CoinTelegraph' },
  { key: 'coingecko', label: 'CoinGecko Trending' },
]

const notifyEvents = [
  { key: 'notify_plan_triggered', label: '计划触发', desc: '操盘计划价格条件达成' },
  { key: 'notify_plan_approaching', label: '计划接近', desc: '价格接近触发条件' },
  { key: 'notify_stop_loss', label: '止损告警', desc: '价格触及止损线' },
  { key: 'notify_price_swing', label: '价格异动', desc: '超过阈值的价格波动' },
  { key: 'notify_trade_executed', label: '交易执行', desc: '交易操作完成通知' },
]

const groupKeys = {
  market: ['refresh_interval', 'market_refresh_interval', 'rate_cache_duration', 'strategy_monitor_interval', 'signal_valid_hours', 'price_alert_threshold', 'plan_approaching_pct'],
  ai: ['ai_api_url', 'ai_api_key', 'ai_model', 'agent_analysis_model', 'agent_search_api_url', 'agent_search_api_key'],
  news: ['news_refresh_interval', 'news_sources_enabled', 'news_auto_cache', 'news_cache_batch_size'],
  push: ['push_enabled', 'push_webhook_type', 'push_webhook_url'],
}

async function load() {
  try {
    const res = await api('/api/settings')
    const json = await res.json()
    if (!json.success) return
    for (const [k, v] of Object.entries(json.data)) {
      if (k in form) {
        form[k] = v
      }
    }
    // Parse enabled sources
    if (form.news_sources_enabled) {
      enabledSources.value = form.news_sources_enabled.split(',').map(s => s.trim()).filter(Boolean)
    }
  } catch {}
  // Load custom sources
  try {
    const res = await api('/api/news/sources')
    const json = await res.json()
    customSources.value = json.data || []
  } catch {}
}

async function saveGroup(group) {
  const keys = groupKeys[group]
  if (!keys) return
  // Sync enabledSources back to form for news group
  if (group === 'news') {
    form.news_sources_enabled = enabledSources.value.join(',')
  }
  try {
    const payload = {}
    for (const key of keys) payload[key] = form[key]
    const res = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) })
    const json = await res.json()
    if (!json.success) { alert('保存失败'); return }
    dirty[group] = false
    saveState[group] = 'saved'
    setTimeout(() => { saveState[group] = '' }, 2000)
  } catch (e) { alert('保存失败: ' + e.message) }
}

async function saveKey(key, value) {
  try {
    const res = await api(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value })
    })
    const json = await res.json()
    if (!json.success) { alert(`保存失败: ` + (json.error || '未知错误')) }
  } catch (e) { alert('保存失败: ' + e.message) }
}

async function addCustomSource() {
  if (!newSource.name || !newSource.url) return
  try {
    const res = await api('/api/news/sources', { method: 'POST', body: JSON.stringify({ name: newSource.name, url: newSource.url }) })
    const json = await res.json()
    if (!json.success) { alert(json.error || '添加失败'); return }
    newSource.name = ''
    newSource.url = ''
    const r2 = await api('/api/news/sources')
    customSources.value = (await r2.json()).data || []
  } catch (e) { alert(e.message) }
}

async function deleteCustomSource(id) {
  try {
    await api(`/api/news/sources/${id}`, { method: 'DELETE' })
    customSources.value = customSources.value.filter(s => s.id !== id)
  } catch {}
}

function doLogout() {
  authStore.logout()
  router.push('/login')
}

async function testPush() {
  testingPush.value = true
  try {
    // Save push settings first
    await saveGroup('push')
    const res = await api('/api/notifications/test-push', { method: 'POST' })
    const json = await res.json()
    if (json.success) alert('✅ 测试推送已发送，请检查接收端')
    else alert('❌ 推送失败: ' + (json.error || '未知错误'))
  } catch (e) { alert('❌ 推送失败: ' + e.message) }
  testingPush.value = false
}

onMounted(load)
</script>

<style scoped>
.settings-page {
  max-width: 640px;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.settings-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  margin-bottom: 8px;
}

.settings-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.save-btn {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.save-btn.changed {
  background: var(--blue);
  color: #fff;
  animation: pulse-once 0.3s ease;
}
@keyframes pulse-once {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.settings-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  min-height: 48px;
}
.setting-item:last-child {
  border-bottom: none;
}

.setting-item-vertical {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}

.setting-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.3;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.setting-input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  text-align: right;
}
.setting-input:focus {
  outline: none;
  border-color: var(--blue);
}

.setting-input-full {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}
.setting-input-full:focus {
  outline: none;
  border-color: var(--blue);
}

.setting-unit {
  font-size: 13px;
  color: var(--text-dim);
  min-width: 20px;
}

.settings-group-footer {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 16px 0;
  line-height: 1.4;
}

/* Switch */
.switch { position: relative; display: inline-block; width: 44px; height: 26px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: var(--border); border-radius: 26px; transition: 0.3s; }
.slider::before { content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.switch input:checked + .slider { background: var(--green, #34c759); }
.switch input:checked + .slider::before { transform: translateX(18px); }

@media (max-width: 768px) {
  .settings-page { max-width: 100%; }
  .setting-input { width: 70px; font-size: 16px; }
  .setting-input-full { font-size: 16px; }
  .setting-item { padding: 16px; }
}

/* Source chips */
.source-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.source-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 20px; font-size: 13px; cursor: pointer; background: var(--bg); border: 1px solid var(--border); transition: all 0.2s; }
.source-chip input { display: none; }
.source-chip.active { background: var(--blue); color: #fff; border-color: var(--blue); }

/* Custom sources */
.custom-sources-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.custom-source-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg); border-radius: 8px; font-size: 13px; }
.custom-source-name { font-weight: 500; }
.custom-source-url { color: var(--text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.btn-tiny { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 4px; }
.btn-tiny.danger:hover { color: var(--red); background: rgba(239,68,68,0.1); }
.add-source-row { display: flex; gap: 8px; align-items: center; }
.add-source-row .setting-input-full { padding: 8px 10px; font-size: 13px; }
</style>
