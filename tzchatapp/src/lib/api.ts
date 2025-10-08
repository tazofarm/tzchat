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
    if (isHttpAbs(raw)) return stripTrailingSlashes(raw)
    try {
      const origin = `${window.location.protocol}//${window.location.host}`
      return stripTrailingSlashes(joinUrl(origin, raw))
    } catch {
      return stripTrailingSlashes(raw)
    }
  }
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

// [추가] 안전 리다이렉트 유틸 (router 순환참조 방지)
function safeRedirect(path: string) {
  try {
    import('@/router').then(({ default: router }) => {
      if (router.currentRoute.value.fullPath !== path) router.replace(path)
    }).catch(() => {
      if (window.location.pathname !== path) window.location.href = path
    })
  } catch {
    if (window.location.pathname !== path) window.location.href = path
  }
}

// 요청 인터셉터: 토큰 부착
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAuthToken()
  if (token) {
    config.headers = config.headers || {}
    ;(config.headers as any).Authorization = `Bearer ${token}`
  }
  return config
})

// 응답 인터셉터: 401/423 처리 + 로깅
api.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    const status = err.response?.status
    const data: any = err.response?.data
    const code = data?.code || data?.errorCode
    const url = (err.config as any)?.url || ''

    // 🔹 공개 API 예외 처리
    const isPublic =
      url.startsWith('/api/terms/') ||
      url.startsWith('/api/login') ||
      url.startsWith('/api/health')

    // 401: 인증 만료/부재 → 로그인으로
    if (status === 401 && !isPublic) {
      const current = window.location.pathname + window.location.search
      safeRedirect(`/login?redirect=${encodeURIComponent(current)}`)
    }

    // 423: 탈퇴신청 상태 → 전용 페이지로
    if (status === 423 || code === 'PENDING_DELETION') {
      safeRedirect('/account/deletion-pending')
    }

    // (공통) 에러 로깅
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
type HttpResponse<T = any> = Promise<AxiosResponse<T>>
function norm(p: string) { return ensureLeadingSlash(p || '/') }

export const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    const path = norm(url)
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

// ------------------ 약관/동의/관리자 API ----------------
// ✅ 서버(routes/legal/termsPublicRouter.js) 스펙에 맞춤.
// 문서 조회(terms)와 동의 저장(consents)을 /api/terms 하위로 통일.

// 활성 문서 (조회)
export const getActiveTerms = () => http.get('/api/terms/active')
export const getActiveTermBySlug = (slug: string) => {
  const s = encodeURIComponent(String(slug || ''))
  return http.get(`/api/terms/${s}/active`)
}
// 버전 목록 (조회)
export const getTermVersions = (slug: string) => {
  const s = encodeURIComponent(String(slug || ''))
  return http.get(`/api/terms/${s}/versions`)
}

// ===== 타입 정의 (추가) =====
export type PendingConsentItem = { slug: string; title?: string; isRequired?: boolean }
export type AgreementStatusResponse = { data: { pending: PendingConsentItem[] } }

/**
 * AgreementPage용 상태 조회
 * ✅ 1순위: /api/terms/agreements/status (정확한 pending만 제공)
 * 🔁 폴백1: /agreements/list 에서 pending === true 인 항목만 사용
 * 🔁 폴백2: 구버전(/require-consent + /active) 조합
 * 반환 형식(고정): { data: { pending: PendingConsentItem[] } }
 */
export const getAgreementStatus = async (): Promise<AgreementStatusResponse> => {
  // 1) 최신 엔드포인트: 정확한 pending
  try {
    const { data } = await http.get('/api/terms/agreements/status')
    const pending: PendingConsentItem[] = data?.data?.pending ?? []
    return { data: { pending } }
  } catch (e) {
    console.warn('[agreements] status 미가용 → list로 폴백')
  }

  // 2) 폴백1: list 사용 + pending=true 필터
  try {
    const { data } = await http.get('/api/terms/agreements/list')
    const items: any[] = data?.data?.items ?? []
    const pending: PendingConsentItem[] = items
      .filter(i => i?.pending === true)
      .map(i => ({
        slug: i.slug,
        title: i.title,
        isRequired: !!(i.isRequired ?? i.defaultRequired),
      }))
    return { data: { pending } }
  } catch (e) {
    console.warn('[agreements] list 미가용 → require-consent로 폴백')
  }

  // 3) 폴백2: 구버전(필수만 표시됨)
  const [reqRes, actRes] = await Promise.all([
    http.get('/api/terms/require-consent'),
    http.get('/api/terms/active'),
  ])
  const requiredSlugs: string[] = reqRes.data?.requiredSlugs ?? []
  const actives: any[] = actRes.data?.data ?? []
  const bySlug: Record<string, any> = {}
  for (const a of actives) if (!bySlug[a.slug]) bySlug[a.slug] = a
  const pending: PendingConsentItem[] = requiredSlugs.map(slug => ({
    slug,
    title: bySlug[slug]?.title,
    isRequired: !!bySlug[slug]?.defaultRequired,
  }))
  return { data: { pending } }
}

/**
 * 다건 동의 저장
 * ✅ 1순위: /api/terms/agreements/accept 배치 저장
 * 🔁 폴백: slug별 활성버전 조회 후 /api/terms/consents 개별 저장
 */
export const acceptAgreements = async (slugs: string[]) => {
  try {
    await http.post('/api/terms/agreements/accept', { slugs })
    return { ok: true }
  } catch (e) {
    console.warn('[agreements] accept 배치 미가용 → consents 개별 저장으로 폴백')
    const tasks = slugs.map(async (slug) => {
      const s = encodeURIComponent(String(slug || ''))
      const { data } = await http.get(`/api/terms/${s}/active`)
      const version = data?.data?.version ?? data?.version
      if (!version) throw new Error(`활성 버전을 찾을 수 없습니다: ${slug}`)
      await http.post('/api/terms/consents', { slug, version, optedIn: true })
    })
    await Promise.all(tasks)
    return { ok: true }
  }
}

// ----- Admin: 약관 새 버전 발행 -----
export const adminCreateTerms = (payload: {
  slug: string
  title: string
  version: string
  content: string
  kind: 'page' | 'consent'
  defaultRequired?: boolean
  effectiveAt?: string
}) => http.post('/api/admin/terms', payload)

// 목록 조회
export const adminListTerms = (q?: { slug?: string; active?: 'true' | 'false'; kind?: 'page' | 'consent' }) =>
  http.get('/api/admin/terms', { params: q })

export default api
export const AuthAPI = auth
