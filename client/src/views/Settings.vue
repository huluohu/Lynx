<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">⚙️ 系统设置</h1>
    </div>

    <div class="grid-2">
      <!-- 通用 -->
      <div class="card">
        <div class="section-title">🔄 刷新 & 提醒</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">刷新间隔 (秒)</label>
            <input class="form-input" type="number" v-model="form.refresh_interval" />
          </div>
          <div class="form-group">
            <label class="form-label">价格异动阈值 (%)</label>
            <input class="form-input" type="number" step="0.1" v-model="form.price_alert_threshold" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">计划接近提醒阈值 (%)</label>
          <input class="form-input" type="number" v-model="form.plan_approaching_pct" />
          <span style="font-size:11px;color:var(--text-muted)">价格距触发线在此范围内时显示提醒</span>
        </div>
      </div>

      <!-- 通知 -->
      <div class="card">
        <div class="section-title">🔔 通知偏好</div>
        <div class="setting-toggle">
          <div class="toggle-label">
            <span>微信通知</span>
            <span style="font-size:11px;color:var(--text-muted)">触发时通过微信推送</span>
          </div>
          <label class="switch"><input type="checkbox" v-model="form.wechat_notify" true-value="true" false-value="false" @change="saveKey('wechat_notify', form.wechat_notify)" /><span class="slider"></span></label>
        </div>
        <div class="setting-toggle">
          <div class="toggle-label">
            <span>Web 通知</span>
            <span style="font-size:11px;color:var(--text-muted)">触发时浏览器弹窗</span>
          </div>
          <label class="switch"><input type="checkbox" v-model="form.webpush_notify" true-value="true" false-value="false" @change="saveKey('webpush_notify', form.webpush_notify)" /><span class="slider"></span></label>
        </div>
        <div class="section-title" style="margin-top:16px;font-size:12px">通知事件</div>
        <div v-for="evt in notifyEvents" :key="evt.key" class="setting-toggle">
          <div class="toggle-label">
            <span>{{ evt.label }}</span>
          </div>
          <label class="switch"><input type="checkbox" v-model="form[evt.key]" true-value="true" false-value="false" @change="saveKey(evt.key, form[evt.key])" /><span class="slider"></span></label>
        </div>
      </div>

      <!-- 认证 -->
      <div class="card">
        <div class="section-title">🔐 安全</div>
        <p style="font-size:13px;color:var(--text-dim);margin-bottom:16px">用户名和密码通过环境变量 <code>AUTH_USERNAME</code> / <code>AUTH_PASSWORD</code> 设置</p>
        <button class="btn btn-danger" @click="doLogout">退出登录</button>
      </div>
    </div>

    <div v-if="saved" class="save-toast">✅ 已保存</div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const authStore = useAuthStore()
const saved = ref(false)
const form = reactive({
  refresh_interval: '60',
  price_alert_threshold: '2',
  plan_approaching_pct: '5',
  wechat_notify: 'true',
  webpush_notify: 'true',
  notify_plan_triggered: 'true',
  notify_plan_approaching: 'false',
  notify_stop_loss: 'true',
  notify_price_swing: 'true',
  notify_trade_executed: 'false',
})

const notifyEvents = [
  { key: 'notify_plan_triggered', label: '计划触发' },
  { key: 'notify_plan_approaching', label: '计划接近' },
  { key: 'notify_stop_loss', label: '止损告警' },
  { key: 'notify_price_swing', label: '价格异动' },
  { key: 'notify_trade_executed', label: '交易执行' },
]

async function load() {
  try {
    const res = await fetch('/api/settings', { headers: authStore.getHeaders() })
    const json = await res.json()
    if (!json.success) return
    for (const [k, v] of Object.entries(json.data)) {
      if (k in form) form[k] = v
    }
  } catch (e) { /* ignore */ }
}

async function saveKey(key, value) {
  try {
    await fetch(`/api/settings/${key}`, {
      method: 'PUT',
      headers: authStore.getHeaders(),
      body: JSON.stringify({ value })
    })
    showSaved()
  } catch { /* ignore */ }
}

let toastTimer
function showSaved() {
  saved.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => saved.value = false, 1500)
}

function doLogout() {
  authStore.logout()
  router.push('/login')
}

onMounted(load)
</script>

<style scoped>
.setting-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.setting-toggle:last-child { border-bottom: none; }
.toggle-label { display: flex; flex-direction: column; gap: 2px; }

/* Switch */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: var(--border); border-radius: 24px; transition: 0.3s; }
.slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
.switch input:checked + .slider { background: var(--blue); }
.switch input:checked + .slider::before { transform: translateX(20px); }

.save-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--green);
  color: #fff;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 999;
}
</style>
