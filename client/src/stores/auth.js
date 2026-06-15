import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const username = ref(localStorage.getItem('username') || '')
  const isLoggedIn = ref(!!token.value)

  async function login(user, pass, rememberMe = false) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass, rememberMe })
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '登录失败')
    token.value = json.data.token
    username.value = json.data.username
    isLoggedIn.value = true
    localStorage.setItem('token', json.data.token)
    localStorage.setItem('username', json.data.username)
  }

  function logout() {
    token.value = ''
    username.value = ''
    isLoggedIn.value = false
    localStorage.removeItem('token')
    localStorage.removeItem('username')
  }

  function getHeaders() {
    return { 'Authorization': `Bearer ${token.value}`, 'Content-Type': 'application/json' }
  }

  return { token, username, isLoggedIn, login, logout, getHeaders }
})
