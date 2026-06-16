<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <img src="/logo.svg" alt="Lynx" class="login-logo" />
        <h1>L¥NX</h1>
        <p>{{ t('login.subtitle') }}</p>
      </div>
      <form @submit.prevent="doLogin">
        <div class="form-group">
          <label class="form-label">{{ t('login.username') }}</label>
          <input class="form-input" v-model="username" placeholder="admin" autocomplete="username" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('login.password') }}</label>
          <input class="form-input" type="password" v-model="password" placeholder="••••••" autocomplete="current-password" />
        </div>
        <label class="remember-me">
          <input type="checkbox" v-model="rememberMe" />
          <span>{{ t('login.remember') }}</span>
        </label>
        <div v-if="error" class="login-error">{{ error }}</div>
        <button type="submit" class="btn btn-primary login-btn" :disabled="loading">
          {{ loading ? t('login.submitting') : t('login.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const rememberMe = ref(localStorage.getItem('rememberMe') === 'true')

async function doLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value, rememberMe.value)
    localStorage.setItem('rememberMe', rememberMe.value)
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
.login-logo {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  margin-bottom: 12px;
}
.login-header h1 { font-size: 24px; margin-bottom: 8px; }
.login-header p { color: var(--text-dim); font-size: 14px; }
.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
}
.remember-me input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}
.login-btn { width: 100%; margin-top: 20px; padding: 12px; font-size: 15px; }
.login-error {
  padding: 10px 14px;
  background: var(--danger-soft);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  color: var(--red);
  font-size: 13px;
  margin-top: 12px;
}
</style>
