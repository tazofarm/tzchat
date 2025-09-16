// src/lib/api.ts
// -------------------------------------------------------------
// 🌐 ENV 우선 (정적 직접 접근)
// - 1순위: .env.* 의 VITE_API_BASE_URL (절대주소 권장; 뒤에 /api 붙이지 않음)
// - 2순위: 브라우저 오리진 (개발 편의용 폴백)
// - withCredentials, JWT Authorization 헤더 자동 부착
// - ✅ 규칙: 실제 호출 시 경로는 항상 '/api/...' 로 명시
// -------------------------------------------------------------
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
  type AxiosRequestConfig,
} from 'axios'

// ====== 🔑 ENV (정적 직접 접근) ======
const {
  MODE: VITE_BUILD_MODE,
  VITE_MODE,
  VITE_API_BASE_URL,
} = import.meta.env as any

const MODE = String(VITE_MODE || VITE_BUILD_MODE || '')

// --------------------- utils ---------------------
function stripTrailingSlashes(u: string) { return (u || '').replace(/\/+$/, '') }
function ensureLeadingSlash(p: string) { return p.startsWith('/') ? p : `/${p}` }
function isHttpAbs(u: string) { return /^https?:\/\//i.test(u || '') }
function joinUrl(base: string, path: string) {
  const b = stripTrailingSlashes(base || '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

// 토큰 유틸
const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'
function getAuthToken(): string | null { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export function setAuthToken(tok: string | null) { try { tok ? localStorage.setItem(TOKEN_KEY, tok) : localStorage.removeItem(TOKEN_KEY) } catch {} }
export function clearAuthToken() { setAuthToken(null) }

// ------------------ baseURL 계산 ------------------
// ❗️여기서는 절대로 '/api'를 덧붙이지 않습니다.
function computeBaseURL(): string {
  const raw = String(VITE_API_BASE_URL || '').trim()
  if (raw) {
    // 절대경로면 그대로, 상대경로면 브라우저 오리진 기준으로 붙여 사용
    if (isHttpAbs(raw)) return stripTrailingSlashes(raw)
    try {
      const origin = `${window.location.protocol}//${window.location.host}`
      return stripTrailingSlashes(joinUrl(origin, raw))
    } catch {
      // 브라우저 컨텍스트가 아닐 때를 대비한 폴백
      return stripTrailingSlashes(raw)
    }
  }

  // dev-remote에서 env 주입이 실패하면 여기로 내려옵니다.
  let origin = ''
  try { origin = `${window.location.protocol}//${window.location.host}` } catch {}
  const fallback = origin || 'http://localhost:2000'
  console.warn('[CFG][api] VITE_API_BASE_URL 미설정/형식불량 → 폴백 사용', { MODE, origin: fallback })
  return stripTrailingSlashes(fallback)
}

const ENV_BASE = computeBaseURL()
const USE_COOKIES = true

// ------------------ Axios 인스턴스 ----------------
export const api = axios.create({
  baseURL: ENV_BASE,                 // ← 뒤에 '/api' 를 붙이지 않습니다.
  withCredentials: USE_COOKIES,
  headers: { 'Content-Type': 'application/json' },
})

console.log('%c[HTTP][CFG]', 'color:#0a0;font-weight:bold', {
  MODE,
  VITE_API_BASE_URL: VITE_API_BASE_URL || '(from env)',
  finalBaseURL: ENV_BASE,
  withCredentials: USE_COOKIES,
})

// 요청 인터셉터: 토큰 부착
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken()
  if (token) {
    config.headers = config.headers || {}
    ;(config.headers as any).Authorization = `Bearer ${token}`
  }
  return config
})

// 응답 인터셉터: 에러 로깅
api.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    const status = err.response?.status
    const url = (err.config as any)?.url
    console.warn('[HTTP][ERR]', {
      status,
      url,
      message: err.message,
      isAxiosError: (err as any).isAxiosError,
      data: err.response?.data
    })
    return Promise.reject(err)
  }
)

// ------------------ 경로 정규화 래퍼 ----------------
// ✅ 더 이상 '/api'를 제거하지 않습니다. 호출부에서 항상 '/api/...' 를 넘기세요.
type HttpResponse<T = any> = Promise<AxiosResponse<T>>
function norm(p: string) { return ensureLeadingSlash(p || '/') }

export const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url) // e.g. '/api/users'
    console.log('[HTTP][REQ]', { method: 'GET', url: joinUrl(ENV_BASE, path), params: config?.params, withCredentials: USE_COOKIES })
    return api.get<T>(path, config)
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[HTTP][REQ]', { method: 'POST', url: joinUrl(ENV_BASE, path), params: config?.params, data, withCredentials: USE_COOKIES })
    return api.post<T>(path, data, config)
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[HTTP][REQ]', { method: 'PUT', url: joinUrl(ENV_BASE, path), params: config?.params, data, withCredentials: USE_COOKIES })
    return api.put<T>(path, data, config)
  },
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[HTTP][REQ]', { method: 'PATCH', url: joinUrl(ENV_BASE, path), params: config?.params, data, withCredentials: USE_COOKIES })
    return api.patch<T>(path, data, config)
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[HTTP][REQ]', { method: 'DELETE', url: joinUrl(ENV_BASE, path), params: config?.params, withCredentials: USE_COOKIES })
    return api.delete<T>(path, config)
  },
}

// ------------------ 인증 편의 함수 ----------------
// ✅ 모든 엔드포인트는 명시적으로 '/api/...' 사용
export const auth = {
  async login(body: { username: string; password: string }) {
    const res = await api.post('/api/login', body)
    const token = (res?.data as any)?.token ?? (res?.data as any)?.data?.token ?? null
    if (token) setAuthToken(token)
    return res
  },
  me() { return api.get('/api/me') },
  async logout() {
    try { await api.post('/api/logout') } finally { clearAuthToken() }
  },
}

export default api
export const AuthAPI = auth
