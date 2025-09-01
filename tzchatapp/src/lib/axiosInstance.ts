// src/lib/axiosInstance.ts
// ------------------------------------------------------
// ✅ 단일 axios 인스턴스 + http 래퍼
// - baseURL = ORIGIN(도메인/포트)만 사용 (/api 붙이지 않음)
// - 각 호출부는 `${API_PREFIX}/...` 사용
// - 인터셉터/로깅/withCredentials 일원화
// - 하위호환: default export = api (axios 인스턴스)
//            named export = { api, http, API_PREFIX, getApiBaseURL }
// ------------------------------------------------------

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';

// ===== ENV =====
// 우선순위: VITE_API_BASE_URL → VITE_API_ORIGIN → (브라우저 origin 폴백)
// dev:remote / build:app:remote 에서는 cross-env로 VITE_API_BASE_URL 주입
const ENV_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_ORIGIN as string | undefined) ??
  '';

// (export 제거) — 마지막에 일괄 export
const API_PREFIX = (import.meta.env.VITE_API_PREFIX || '/api') as string;

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
  // baseURL 누락시 상대경로가 개발서버(예: :8081)로 향하는 문제를 눈에 띄게 경고
  // 실제 동작은 유지(로그로만 경고)
  // 글자색은 기본(검정) 가독성 유지
  // eslint-disable-next-line no-console
  console.warn(
    '[Axios][INIT][WARN] baseURL이 설정되지 않았습니다. ' +
      '상대경로 요청이 개발 서버로 향할 수 있습니다. ' +
      'VITE_API_BASE_URL 또는 VITE_API_ORIGIN을 설정하세요.'
  );
}

// ===== Getter (export 제거; 맨 아래에서 일괄 export) =====
const getApiBaseURL = () => RESOLVED_BASE;

// ===== Axios Instance =====
const api: AxiosInstance = axios.create({
  baseURL: RESOLVED_BASE, // ❗ '/api' 금지 → /api/api 방지
  withCredentials: true,  // 세션/쿠키 전달
  timeout: 15000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// 초기 설정 로그
console.log('[Axios][INIT]', {
  baseURL: RESOLVED_BASE,
  API_PREFIX,
  mode: import.meta.env.MODE,
});

// ===== Interceptors (logging) =====
api.interceptors.request.use(
  (config) => {
    console.log('✅ [Axios][REQ]', {
      baseURL: config.baseURL,
      url: config.url,
      method: config.method,
      withCredentials: config.withCredentials,
      headers: config.headers,
      params: config.params,
      data: config.data,
    });
    if (!config.baseURL) {
      console.warn(
        '⚠️ [Axios][REQ][WARN] config.baseURL이 비어 있습니다. ' +
          '상대경로가 로컬 개발 서버로 갈 수 있습니다.'
      );
    }
    return config;
  },
  (error) => {
    console.error('❌ [Axios][REQ:ERR]', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => {
    console.log('✅ [Axios][RES]', {
      status: res.status,
      url: res.config?.url,
      data: res.data,
    });
    return res;
  },
  (err: AxiosError) => {
    console.error('❌ [Axios][RES:ERR]', {
      message: err.message,
      code: err.code,
      url: err.config?.url,
      method: err.config?.method,
      status: err.response?.status ?? 'NO_STATUS',
      data: err.response?.data,
    });
    return Promise.reject(err);
  }
);

// ===== Types =====
export type HttpResponse<T = any> = Promise<AxiosResponse<T>>;

// ===== http Wrapper =====
// 모든 호출부는 `${API_PREFIX}/...` 형태로 전달하세요.
// 예) http.post(`${API_PREFIX}/login`, payload)
const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('🌐[HTTP][GET]', url, config || {});
    return api.get<T>(url, config);
  },
  post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): HttpResponse<T> {
    console.log('🌐[HTTP][POST]', url, { data, ...(config || {}) });
    return api.post<T>(url, data, config);
  },
  put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): HttpResponse<T> {
    console.log('🌐[HTTP][PUT]', url, { data, ...(config || {}) });
    return api.put<T>(url, data, config);
  },
  patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): HttpResponse<T> {
    console.log('🌐[HTTP][PATCH]', url, { data, ...(config || {}) });
    return api.patch<T>(url, data, config);
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('🌐[HTTP][DELETE]', url, config || {});
    return api.delete<T>(url, config);
  },
};

// ===== Exports (단 한 번만 export) =====
export default api;                             // 레거시: default 로 axios 인스턴스 제공
export { api, http, API_PREFIX, getApiBaseURL } // named export 병행
