// src/lib/api.ts
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
  type AxiosRequestConfig,
} from 'axios'

export const API_PREFIX = '/api'
const BUILD_ID = 'api.ts@ENV-FIRST+DEV-REMOTE-GUARD:v2.2'

const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'
const REMOTE_DEFAULT_API = 'https://tzchat.duckdns.org/api'

const stripTrailingSlashes = (s: string) => (s || '').replace(/\/+$/g, '')
const stripLeadingApi = (p: string) => (p || '').replace(/^\/api(?=\/|$)/i, '')
const ensureLeadingSlash = (u: string) => (u.startsWith('/') ? u : '/' + u)
const isHttpAbs = (u: string) => /^https?:\/\//i.test(u)
const isLocalLike = (u: string) =>
  /(localhost|127\.0\.0\.1)|:8081/i.test(String(u || ''))

function getModeLabel() {
  const mode = (import.meta as any)?.env?.MODE as string | undefined
  const viteMode = (import.meta as any)?.env?.VITE_MODE as string | undefined
  return (viteMode && viteMode.trim()) || mode || '(unknown)'
}

/** .env → baseURL 해석 + dev-remote/8081 안전장치 */
function resolveBaseURL(): string {
  const mode = getModeLabel()
  let envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
  envBase = envBase?.trim()

  // 0) 개발기 8081에서 dev-remote 의도일 때도 보호:
  // - 페이지 오리진이 http://localhost:8081 이고
  // - envBase가 비었거나 로컬 느낌이면
  // => 원격 기본으로 강제 (실수/미적용을 막음)
  const on8081 =
    typeof window !== 'undefined' &&
    /^http:\/\/localhost:8081$/i.test(window.location.origin)

  if (on8081 && (mode === 'dev-remote' || !envBase || isLocalLike(envBase))) {
    console.error(
      '[HTTP][CFG] 8081 오리진에서 dev-remote 의도 감지 → 원격 기본으로 강제',
      { mode, envBase, forced: REMOTE_DEFAULT_API }
    )
    return REMOTE_DEFAULT_API
  }

  // 1) dev-remote: ENV 최우선, 없거나 로컬이면 원격으로 강제
  if (mode === 'dev-remote') {
    if (!envBase || isLocalLike(envBase)) {
      console.error(
        '[HTTP][CFG] dev-remote인데 ENV 비었거나 로컬 → 원격 기본으로 강제',
        { envBase, forced: REMOTE_DEFAULT_API }
      )
      return REMOTE_DEFAULT_API
    }
    return stripTrailingSlashes(envBase)
  }

  // 2) 다른 모드: ENV가 있으면 사용
  if (envBase && envBase.length) {
    return stripTrailingSlashes(envBase)
  }

  // 3) 최후 폴백
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${stripTrailingSlashes(window.location.origin)}/api`
    }
  } catch {}
  return 'http://localhost:2000/api'
}

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

const ENV_BASE = resolveBaseURL()

export const api = axios.create({
  baseURL: ENV_BASE,
  withCredentials: true,
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
  pageOrigin: typeof window !== 'undefined' ? window.location.origin : '(no-window)',
})

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  // baseURL 오염 방지
  if (cfg.baseURL !== ENV_BASE) {
    console.warn('[HTTP][CFG] normalize baseURL', { from: cfg.baseURL, to: ENV_BASE })
    ;(cfg as any).baseURL = ENV_BASE
  }
  if (api.defaults.baseURL !== ENV_BASE) {
    api.defaults.baseURL = ENV_BASE
  }

  // URL 정규화
  let u = cfg.url || '/'
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

  // 토큰 주입
  const token = getAuthToken()
  if (token) {
    ;(cfg.headers as any) = { ...(cfg.headers as any), Authorization: `Bearer ${token}` }
  }

  // 로그
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

export const AuthAPI = {
  async login(payload: { username: string; password: string }) {
    const res = await api.post('/login', payload)
    const token = (res?.data as any)?.token ?? (res?.data as any)?.data?.token ?? null
    if (token) setAuthToken(token)
    return res
  },
  me() { return api.get('/me') },
  async logout() { try { await api.post('/logout') } finally { clearAuthToken() } },
}

export default api
