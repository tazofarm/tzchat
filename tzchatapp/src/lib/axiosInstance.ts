// src/lib/axiosInstance.ts
// ------------------------------------------------------
// ✅ 단일 axios 인스턴스 + http 래퍼 (세션/JWT 병행)
// - baseURL = ORIGIN(도메인/포트)만 사용 (/api 붙이지 않음)
// - 각 호출부는 `${API_PREFIX}/...` 사용 (⚠️ 단, 아래 인터셉터가 자동 보정해 줌)
// - 인터셉터/로깅/withCredentials 일원화
// - ✅ JWT(Bearer) 지원: setAuthToken()으로 주입 시 자동 Authorization 헤더
// - 하위호환: default export = api (axios 인스턴스)
//            named export = { api, http, API_PREFIX, getApiBaseURL, setAuthToken, clearAuthToken, getAuthToken }
// ------------------------------------------------------

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';

// ===== ENV =====
// 우선순위: VITE_API_BASE_URL → VITE_API_ORIGIN → (브라우저 origin 폴백)
const ENV_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_ORIGIN as string | undefined) ??
  '';

// (export 제거) — 마지막에 일괄 export
const API_PREFIX = (import.meta.env.VITE_API_PREFIX || '/api') as string;

// JWT 로컬 스토리지 키(선택)
const JWT_STORAGE_KEY =
  (import.meta.env.VITE_JWT_STORAGE_KEY as string | undefined) || 'tzchat.jwt';

// 브라우저 환경 폴백(개발 중 base 미설정 사고 방지)
function computeFallbackBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

const RESOLVED_BASE =
  (ENV_BASE && String(ENV_BASE).trim()) || computeFallbackBase();

if (!RESOLVED_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Axios][INIT][WARN] baseURL이 설정되지 않았습니다. ' +
      '상대경로 요청이 개발 서버로 향할 수 있습니다. ' +
      'VITE_API_BASE_URL 또는 VITE_API_ORIGIN을 설정하세요.'
  );
}

// ===== Getter =====
const getApiBaseURL = () => RESOLVED_BASE;

// ===== JWT In-Memory Holder (옵션) =====
let AUTH_TOKEN: string | null = null;

function loadTokenFromStorage(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage?.getItem(JWT_STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}
function persistToken(token: string | null) {
  try {
    if (typeof window === 'undefined') return;
    if (token) window.localStorage?.setItem(JWT_STORAGE_KEY, token);
    else window.localStorage?.removeItem(JWT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

// 초기 로드 시 저장소에서 복구(선택)
AUTH_TOKEN = loadTokenFromStorage();

// 외부에서 사용할 토큰 제어 함수(선택 사용)
function setAuthToken(token: string) {
  AUTH_TOKEN = token || null;
  persistToken(AUTH_TOKEN);
  console.log('[AUTH][RES]', { step: 'setAuthToken', hasToken: !!AUTH_TOKEN });
}
function clearAuthToken() {
  AUTH_TOKEN = null;
  persistToken(null);
  console.log('[AUTH][RES]', { step: 'clearAuthToken' });
}
function getAuthToken() {
  return AUTH_TOKEN;
}

// ===== URL 보정 유틸 =====
function ensureLeadingSlash(u: string) {
  return u.startsWith('/') ? u : '/' + u;
}
function normalizePrefix(p: string) {
  const pref = p.startsWith('/') ? p : '/' + p;
  return pref.endsWith('/') ? pref.slice(0, -1) : pref;
}
const PREFIX = normalizePrefix(API_PREFIX);

// 상대경로 요청을 `${API_PREFIX}`로 자동 보정
function normalizeRequestUrl(raw?: string): { url: string; prefixed: boolean } {
  let u = raw || '';
  // 절대 URL(http/https)은 그대로 둠
  if (/^https?:\/\//i.test(u)) return { url: u, prefixed: false };
  // 빈 값 또는 해시/쿼리만 오는 경우 방어
  if (!u || u.startsWith('?') || u.startsWith('#')) {
    const fixed = `${PREFIX}${ensureLeadingSlash(u || '')}`;
    return { url: fixed, prefixed: true };
  }
  // 항상 선행 슬래시
  u = ensureLeadingSlash(u);
  // 이미 프리픽스가 붙어 있으면 그대로
  if (u === PREFIX || u.startsWith(PREFIX + '/')) {
    return { url: u, prefixed: false };
  }
  // 그 외에는 프리픽스 부착
  return { url: `${PREFIX}${u}`, prefixed: true };
}

// ===== Axios Instance =====
const api: AxiosInstance = axios.create({
  baseURL: RESOLVED_BASE, // ❗ '/api' 금지 → /api/api 방지 (프리픽스는 url에서 처리)
  withCredentials: true,  // 세션/쿠키(JWT 쿠키 포함) 전달
  timeout: 15000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// 초기 설정 로그
console.log('[API][RES]', {
  path: 'axios:init',
  baseURL: RESOLVED_BASE,
  API_PREFIX: PREFIX,
  mode: import.meta.env.MODE,
  jwtInMemory: !!AUTH_TOKEN,
});

// ===== Interceptors (logging + JWT + URL 보정) =====
api.interceptors.request.use(
  (config) => {
    const originalUrl = config.url || '';

    // 1) URL 자동 프리픽스 보정
    const { url, prefixed } = normalizeRequestUrl(originalUrl);
    config.url = url;

    // 2) Authorization 미설정 & 인메모리 토큰 존재 시 자동 주입
    if (AUTH_TOKEN) {
      const h: any = config.headers || (config.headers = {} as any);
      if (typeof h.set === 'function') {
        if (!h.get('Authorization')) h.set('Authorization', `Bearer ${AUTH_TOKEN}`);
      } else {
        if (!h.Authorization) h.Authorization = `Bearer ${AUTH_TOKEN}`;
      }
    }

    // Authorization 프리뷰(보안을 위해 값은 숨김)
    let hasAuthHeader = false;
    try {
      const h: any = config.headers;
      hasAuthHeader =
        typeof h?.get === 'function' ? !!h.get('Authorization') : !!h?.Authorization;
    } catch { /* noop */ }

    console.log('[API][REQ]', {
      path: config.url,
      method: config.method,
      base: config.baseURL,
      withCredentials: config.withCredentials,
      prefixed,
      from: originalUrl,
      headersPreview: { Authorization: hasAuthHeader ? '***' : undefined },
      params: config.params,
      hasBody: !!config.data,
    });

    if (!config.baseURL) {
      console.warn('[API][WARN]', {
        path: config.url,
        message: 'config.baseURL이 비어 있어 상대경로가 현재 오리진으로 전송될 수 있습니다.',
      });
    }
    return config;
  },
  (error) => {
    console.log('[API][ERR]', { step: 'request', message: (error as any)?.message });
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => {
    console.log('[API][RES]', {
      path: res.config?.url,
      status: res.status,
      ms: (res as any)?.elapsedTime,
      preview:
        typeof res.data === 'object'
          ? JSON.stringify(res.data).slice(0, 200)
          : String(res.data).slice(0, 200),
    });
    return res;
  },
  (err: AxiosError) => {
    console.log('[API][ERR]', {
      path: err.config?.url,
      method: err.config?.method,
      status: err.response?.status ?? 'NO_STATUS',
      code: err.code,
      message: err.message,
      preview:
        typeof err.response?.data === 'object'
          ? JSON.stringify(err.response.data).slice(0, 200)
          : String(err.response?.data || '').slice(0, 200),
    });

    if (err.response?.status === 401) {
      console.warn('[AUTH][ERR]', { step: 'response', code: 401, message: 'Unauthorized' });
    }

    return Promise.reject(err);
  }
);

// ===== Types =====
export type HttpResponse<T = any> = Promise<AxiosResponse<T>>;

// ===== http Wrapper =====
// 모든 호출부는 `${API_PREFIX}/...` 형태로 전달하세요.
// (단, 실수로 '/me'처럼 주더라도 인터셉터가 자동으로 `${API_PREFIX}`를 붙여줍니다.)
const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('[API][REQ]', { path: url, method: 'GET' });
    return api.get<T>(url, config);
  },
  post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): HttpResponse<T> {
    console.log('[API][REQ]', { path: url, method: 'POST' });
    return api.post<T>(url, data, config);
  },
  put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): HttpResponse<T> {
    console.log('[API][REQ]', { path: url, method: 'PUT' });
    return api.put<T>(url, data, config);
  },
  patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): HttpResponse<T> {
    console.log('[API][REQ]', { path: url, method: 'PATCH' });
    return api.patch<T>(url, data, config);
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('[API][REQ]', { path: url, method: 'DELETE' });
    return api.delete<T>(url, config);
  },
};

// ===== Exports =====
export default api; // 레거시: default 로 axios 인스턴스 제공
export {
  api,
  http,
  API_PREFIX,
  getApiBaseURL,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
};
