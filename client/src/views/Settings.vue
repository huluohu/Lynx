<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title">⚙️ 设置</h1>
    </div>

    <div class="settings-container">
      <!-- 行情刷新 -->
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">行情刷新</span>
          <button class="save-btn" :class="{ changed: dirty.market }" @click="saveGroup('market')">
            {{ saveState.market === 'saved' ? '✓ 已保存' : '保存' }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">刷新间隔</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" v-model="form.refresh_interval" @input="dirty.market = true" />
              <span class="setting-unit">秒</span>
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
          <span class="settings-group-title">通知渠道</span>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">微信通知</span>
              <span class="setting-desc">触发时通过微信推送</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form.wechat_notify" true-value="true" false-value="false" @change="saveKey('wechat_notify', form.wechat_notify)" /><span class="slider"></span></label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">浏览器通知</span>
              <span class="setting-desc">触发时浏览器弹窗</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form.webpush_notify" true-value="true" false-value="false" @change="saveKey('webpush_notify', form.webpush_notify)" /><span class="slider"></span></label>
          </div>
        </div>
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
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { api } from '../utils/api.js'

const router = useRouter()
const authStore = useAuthStore()
const form = reactive({
  refresh_interval: '60',
  price_alert_threshold: '2',
  plan_approaching_pct: '5',
  ai_api_url: '',
  ai_api_key: '',
  ai_model: '',
  agent_analysis_model: '',
  agent_search_api_url: '',
  agent_search_api_key: '',
  wechat_notify: 'true',
  webpush_notify: 'true',
  notify_plan_triggered: 'true',
  notify_plan_approaching: 'false',
  notify_stop_loss: 'true',
  notify_price_swing: 'true',
  notify_trade_executed: 'false',
})

const dirty = reactive({ market: false, ai: false })
const saveState = reactive({ market: '', ai: '' })

const notifyEvents = [
  { key: 'notify_plan_triggered', label: '计划触发', desc: '操盘计划价格条件达成' },
  { key: 'notify_plan_approaching', label: '计划接近', desc: '价格接近触发条件' },
  { key: 'notify_stop_loss', label: '止损告警', desc: '价格触及止损线' },
  { key: 'notify_price_swing', label: '价格异动', desc: '超过阈值的价格波动' },
  { key: 'notify_trade_executed', label: '交易执行', desc: '交易操作完成通知' },
]

const groupKeys = {
  market: ['refresh_interval', 'price_alert_threshold', 'plan_approaching_pct'],
  ai: ['ai_api_url', 'ai_api_key', 'ai_model', 'agent_analysis_model', 'agent_search_api_url', 'agent_search_api_key'],
}

async function load() {
  try {
    const res = await api('/api/settings')
    const json = await res.json()
    if (!json.success) return
    for (const [k, v] of Object.entries(json.data)) {
      if (k in form) {
        // Don't overwrite password fields with masked values
        if ((k === 'ai_api_key' || k === 'agent_search_api_key') && v && v.startsWith('****')) {
          form[k] = v // show masked placeholder
        } else {
          form[k] = v
        }
      }
    }
  } catch {}
}

async function saveGroup(group) {
  const keys = groupKeys[group]
  if (!keys) return
  try {
    for (const key of keys) {
      const res = await api(`/api/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: form[key] })
      })
      const json = await res.json()
      if (!json.success) { alert(`保存失败 (${key}): ` + (json.error || '未知错误')); return }
    }
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

function doLogout() {
  authStore.logout()
  router.push('/login')
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
</style>
