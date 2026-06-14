import router from '../router.js'
import { useAuthStore } from '../stores/auth.js'

/**
 * 封装 fetch，自动注入 Authorization header，处理 401 跳转登录
 */
export async function api(url, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    // Clear both localStorage and Pinia store
    const authStore = useAuthStore()
    authStore.logout()
    router.push('/login')
    throw new Error('登录已过期')
  }

  return res
}
