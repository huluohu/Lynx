import { useAuthStore } from '../stores/auth.js'
import router from '../router.js'

/**
 * 封装 fetch，自动注入 Authorization header，处理 401 跳转登录
 */
export async function api(url, options = {}) {
  const auth = useAuthStore()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    auth.logout()
    router.push('/login')
    throw new Error('登录已过期')
  }

  return res
}
