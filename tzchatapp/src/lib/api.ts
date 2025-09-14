// src/lib/api.ts
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
  type AxiosRequestConfig,
} from 'axios'

/**
 * ✅ 현재 로그인 실패 원인 정리
 * - 프론트는 JWT 단일 가정(withCredentials:false), 백엔드는 세션 쿠키 기반 → /me 비로그인
 * - 일부 환경에서 baseURL이 https://localhost 로 굳어지는 오염 가능성
 *
 * ✅ 조치 (안전 복구)
 * 1) 기본을 "쿠키 세션 + JWT 병행" 으로 전환:
 *    - axios 기본값 withCredentials = true (쿠키 항상 전송)
 *    - 응답에 token이 있으면 로컬 저장 → Authorization 헤더도 병행
 * 2) baseURL 강제 가드 강화:
 *    - capacitor://, http(s)://localhost/*, 8081(dev-remote) 등에서는 REMOTE_DEFAULT_API 강제
 *    - (🔧 NEW) origin 폴백 단계에서도 localhost/127.0.0.1 이면 원격 강제
 * 3) 모든 요청에서 baseURL/withCredentials 재보정 + 상세 로그
 */

export const API_PREFIX = '/api'
const BUILD_ID = 'api.ts@MIXED-AUTH-RECOVERY:v3.2' // 🔧 bump

const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'
const REMOTE_DEFAULT_API = 'https://tzchat.tazocode.com/api'

// === 유틸 ===
const stripTrailingSlashes = (s: string) => (s || '').replace(/\/+$/g, '')
const stripLeadingApi = (p: string) => (p || '').replace(/^\/api(?=\/|$)/i, '')
const ensureLeadingSlash = (u: string) => (u?.startsWith('/') ? u : '/' + (u || ''))
const isHttpAbs = (u: string) => /^https?:\/\//i.test(u || '')
const isLocalLike = (u: string) =>
  /(localhost|127\.0\.0\.1)(:\d+)?/i.test(String(u || '')) || /:8081$/i.test(String(u || ''))

const isBrowser = typeof window !== 'undefined'
const pageOrigin = isBrowser ? window.location.origin : '(no-window)'
const isCapacitor = isBrowser && /^capacitor:\/\//i.test(pageOrigin)

function getModeLabel() {
  const mode = (import.meta as any)?.env?.MODE as string | undefined
  const viteMode = (import.meta as any)?.env?.VITE_MODE as string | undefined
  return (viteMode && viteMode.trim()) || mode || '(unknown)'
}

/** .env → baseURL 해석 + 앱/프로덕션 안전장치 */
function resolveBaseURL(): string {
  const mode = getModeLabel()
  let envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
  envBase = envBase?.trim()

  // === Capacitor 앱: 무조건 원격 HTTPS 절대 URL만 허용 ===
  if (isCapacitor) {
    if (!envBase || !isHttpAbs(envBase) || isLocalLike(envBase)) {
      console.error('[HTTP][CFG] Capacitor 환경 → 원격 기본 API로 강제', {
        mode, envBase, forced: REMOTE_DEFAULT_API, pageOrigin,
      })
      return REMOTE_DEFAULT_API
    }
    return stripTrailingSlashes(envBase)
  }

  // === 8081(dev-remote) 개발 페이지에서 자주 나는 실수 방지 ===
  const on8081 = isBrowser && /^http:\/\/localhost:8081$/i.test(pageOrigin)
  if (on8081 && (mode === 'dev-remote' || !envBase || isLocalLike(envBase))) {
    console.error('[HTTP][CFG] 8081(dev-remote) → 원격 기본으로 강제', {
      mode, envBase, forced: REMOTE_DEFAULT_API,
    })
    return REMOTE_DEFAULT_API
  }

  // === dev-remote 모드: ENV 우선, 없거나 로컬이면 원격 강제 ===
  if (mode === 'dev-remote') {
    if (!envBase || isLocalLike(envBase)) {
      console.error('[HTTP][CFG] dev-remote ENV 비었거나 로컬 → 원격 기본 강제', {
        envBase, forced: REMOTE_DEFAULT_API,
      })
      return REMOTE_DEFAULT_API
    }
    return stripTrailingSlashes(envBase)
  }

  // === 기타 모드: ENV가 있으면 사용하되 로컬/비HTTP면 원격 강제 ===
  if (envBase && envBase.length) {
    if (!isHttpAbs(envBase) || isLocalLike(envBase)) {
      console.error('[HTTP][CFG] 기타 모드 ENV가 비HTTP/로컬 → 원격 기본 강제', {
        mode, envBase, forced: REMOTE_DEFAULT_API,
      })
      return REMOTE_DEFAULT_API
    }
    return stripTrailingSlashes(envBase)
  }

  // === 최후 폴백(브라우저 웹 전용): origin + '/api'
  try {
    if (isBrowser && window.location?.origin) {
      const origin = window.location.origin
      // 🔧 NEW: 폴백 오리진이 localhost/127인 경우 원격 강제
      if (isLocalLike(origin)) {
        console.error('[HTTP][CFG] origin 폴백이 localhost/127 → 원격 기본 강제', {
          origin, forced: REMOTE_DEFAULT_API,
        })
        return REMOTE_DEFAULT_API
      }
      // 비-HTTP 오리진(예: capacitor://)은 차단하고 원격으로
      if (!/^https?:\/\//i.test(origin)) {
        console.error('[HTTP][CFG] non-HTTP origin 폴백 차단 → 원격 기본 강제', {
          origin, forced: REMOTE_DEFAULT_API,
        })
        return REMOTE_DEFAULT_API
      }
      return `${stripTrailingSlashes(origin)}/api`
    }
  } catch {}

  // Node 등 비브라우저 환경의 마지막 폴백(개발용)
  return REMOTE_DEFAULT_API
}

// === 토큰 헬퍼 ===
export function getAuthToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setAuthToken(token?: string | null) {
  try {
    if (token && token.trim()) {
      localStorage.setItem(TOKEN_KEY, token)
      console.log('[AUTH][SET]', { hasToken: true, len: token.length })
    } else {
      localStorage.removeItem(TOKEN_KEY)
      console.log('[AUTH][SET]', { hasToken: false })
    }
  } catch {}
}
export function clearAuthToken() {
  try { localStorage.removeItem(TOKEN_KEY); console.log('[AUTH][CLR]', { ok: true }) } catch {}
}

// === 구성값 ===
const ENV_BASE = resolveBaseURL()

// ✅ 복구 포인트: 기본은 "쿠키 세션 사용(true) + JWT 병행"
const USE_COOKIES = true

export const api = axios.create({
  baseURL: ENV_BASE,
  withCredentials: USE_COOKIES,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

console.log('%c[HTTP][CFG][BANNER]', 'color:#0a0;font-weight:bold', {
  BUILD_ID,
  MODE: (import.meta as any)?.env?.MODE,
  VITE_MODE: (import.meta as any)?.env?.VITE_MODE,
  VITE_API_BASE_URL: (import.meta as any)?.env?.VITE_API_BASE_URL,
  baseURL: api.defaults.baseURL,
  pageOrigin,
  isCapacitor,
  USE_COOKIES,
})

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  // baseURL, withCredentials 오염 방지(항상 재보정)
  if (cfg.baseURL !== ENV_BASE) {
    console.warn('[HTTP][CFG] normalize baseURL', { from: cfg.baseURL, to: ENV_BASE })
    ;(cfg as any).baseURL = ENV_BASE
  }
  if (api.defaults.baseURL !== ENV_BASE) api.defaults.baseURL = ENV_BASE

  // ✅ 항상 쿠키 동반
  if (cfg.withCredentials !== true) {
    (cfg as any).withCredentials = true
  }

  // URL 정규화
  let u = cfg.url || '/'
  // 절대 로컬 URL은 상대경로로 축약
  if (u && isHttpAbs(u) && isLocalLike(u)) {
    try {
      const abs = new URL(u)
      u = abs.pathname + (abs.search || '')
    } catch {
      u = u.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '')
    }
  }
  if (u.startsWith('/api')) u = stripLeadingApi(u)
  u = ensureLeadingSlash(u)
  cfg.url = u

  // JWT 토큰 주입(있으면 병행)
  const token = getAuthToken()
  if (token) {
    ;(cfg.headers as any) = { ...(cfg.headers as any), Authorization: `Bearer ${token}` }
  }

  // 로그(민감정보 마스킹)
  let safeData: any = cfg.data
  if (safeData && typeof safeData === 'object') {
    try {
      const clone: any = { ...(safeData as any) }
      if ('password' in clone) clone.password = '(hidden)'
      if ('pw' in clone) clone.pw = '(hidden)'
      safeData = clone
    } catch {}
  }
  console.log('[HTTP][REQ]', {
    method: (cfg.method || 'get').toUpperCase(),
    url: `${cfg.baseURL || ''}${cfg.url}`,
    params: cfg.params,
    data: safeData,
    withCredentials: cfg.withCredentials,
  })

  return cfg
})

api.interceptors.response.use(
  (res: AxiosResponse) => {
    console.log('[HTTP][RES]', {
      status: res.status,
      url: res.config?.url,
      size: typeof res.data === 'string' ? res.data.length : undefined,
    })
    return res
  },
  (err: AxiosError) => {
    const status = err.response?.status
    const data = err.response?.data
    const url = err.config?.url
    console.log('[HTTP][ERR]', { status, url, message: err.message, isAxiosError: true, data })
    if (status === 401) clearAuthToken()
    return Promise.reject(err)
  },
)

type HttpResponse<T = any> = Promise<AxiosResponse<T>>
function norm(p: string) { return ensureLeadingSlash(stripLeadingApi(p || '/')) }

export const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[API][REQ]', { method: 'GET', path, base: api.defaults.baseURL })
    return api.get<T>(path, config)
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[API][REQ]', { method: 'POST', path, base: api.defaults.baseURL, hasBody: !!data })
    return api.post<T>(path, data, config)
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[API][REQ]', { method: 'PUT', path, base: api.defaults.baseURL, hasBody: !!data })
    return api.put<T>(path, data, config)
  },
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[API][REQ]', { method: 'PATCH', path, base: api.defaults.baseURL, hasBody: !!data })
    return api.patch<T>(path, data, config)
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
    console.log('[API][REQ]', { method: 'DELETE', path, base: api.defaults.baseURL })
    return api.delete<T>(path, config)
  },
}

// === 인증 API: 세션/쿠키 + JWT 병행 지원 ===
export const AuthAPI = {
  async login(payload: { username: string; password: string }) {
    // 서버가 { token } 또는 { data: { token } } 를 줄 수도 있고, 오직 쿠키만 줄 수도 있음
    const res = await api.post('/login', payload)
    const token =
      (res?.data as any)?.token ??
      (res?.data as any)?.data?.token ??
      null
    if (token) setAuthToken(token) // JWT가 오면 저장(병행)
    return res
  },
  me() { return api.get('/me') }, // 세션 쿠키 동반 + JWT 병행
  async logout() {
    try { await api.post('/logout') } finally { clearAuthToken() }
  },
}

export default api
