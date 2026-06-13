<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1>📊 投资规划</h1>
        <p>登录以继续</p>
      </div>
      <form @submit.prevent="doLogin">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input class="form-input" v-model="username" placeholder="admin" autocomplete="username" />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input class="form-input" type="password" v-model="password" placeholder="••••••" autocomplete="current-password" />
        </div>
        <div v-if="error" class="login-error">{{ error }}</div>
        <button type="submit" class="btn btn-primary login-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function doLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  }
  loading.value = false
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg);
}
.login-card {
  width: 380px;
  max-width: 90vw;
  padding: 40px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
}
.login-header {
  text-align: center;
  margin-bottom: 28px;
}
.login-header h1 { font-size: 28px; margin-bottom: 8px; }
.login-header p { color: var(--text-dim); font-size: 14px; }
.login-btn { width: 100%; margin-top: 20px; padding: 12px; font-size: 15px; }
.login-error {
  padding: 10px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: var(--red);
  font-size: 13px;
  margin-top: 12px;
}
</style>
