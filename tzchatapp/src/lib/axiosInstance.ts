// src/lib/axiosInstance.ts
// -------------------------------------------------------------
// ✅ 단일 인스턴스 래퍼(호환 유지 버전)
// - 실제 axios 인스턴스 생성/환경처리는 src/lib/api.ts 에서만 수행
// - 이 파일은 기존 코드 호환을 위한 얇은 래퍼 + URL 보정만 담당
// - 목표: /api 경로 이중 접두(/api/api) 방지 + 로그 일원화
//
// [내부 정책]
// 1) baseURL은 api.ts에서 ".../api"까지 포함해 설정됨.
// 2) 여기서는 호출 URL이 '/api/...' 로 들어오면 자동으로 제거해 중복을 방지.
//    예) http.get('/api/me')  → 내부적으로 api.get('/me')
// 3) 외부 API는 기존과 동일하게 유지:
//    - default export = axios 인스턴스(api)
//    - named export = { api, http, API_PREFIX, getApiBaseURL, setAuthToken, clearAuthToken, getAuthToken }
//
// [로그 규격 예시]
// console.log('[API][REQ]', { path, method, base, from, prefixed, ... })
// console.log('[API][RES]', { path, status, ms? })
// console.log('[API][ERR]', { path, status, code, message, preview })
// -------------------------------------------------------------

import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  api as coreApi,
  getApiBaseURL,
  setAuthToken as setAuthTokenCore,
  clearToken as clearAuthTokenCore,
  getAuthToken as getAuthTokenCore,
} from './api';

// ===== 상수/유틸 =====
const API_PREFIX = '/api';

/** 선행 슬래시 보장 */
function ensureLeadingSlash(u: string) {
  return u.startsWith('/') ? u : '/' + u;
}

/** '/api' 이중 접두 방지용 정규화
 * - 절대 URL(http/https)은 그대로 둠
 * - '/api' 또는 '/api/...' 로 시작하면 1회 제거
 * - 그 외에는 선행 슬래시만 보장
 */
function normalizeUrlForCore(raw?: string): { url: string; stripped: boolean } {
  let u = raw || '';
  if (/^https?:\/\//i.test(u)) return { url: u, stripped: false };

  u = ensureLeadingSlash(u || '');
  if (u === API_PREFIX) return { url: '/', stripped: true }; // '/api' → '/'
  if (u.startsWith(API_PREFIX + '/')) return { url: u.slice(API_PREFIX.length), stripped: true };

  return { url: u, stripped: false };
}

// ===== http Wrapper =====
// - 모든 메서드는 URL을 보정(normalizeUrlForCore)한 뒤 coreApi 호출
// - 응답/에러 로그는 간단 요약(상세 로그는 coreApi 인터셉터에 위임)
type HttpResponse<T = any> = Promise<AxiosResponse<T>>;

const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    const { url: fixed, stripped } = normalizeUrlForCore(url);
    console.log('[API][REQ]', {
      path: fixed,
      method: 'GET',
      base: getApiBaseURL(),
      from: url,
      prefixed: stripped,
    });
    return coreApi.get<T>(fixed, config);
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const { url: fixed, stripped } = normalizeUrlForCore(url);
    console.log('[API][REQ]', {
      path: fixed,
      method: 'POST',
      base: getApiBaseURL(),
      from: url,
      prefixed: stripped,
      hasBody: !!data,
    });
    return coreApi.post<T>(fixed, data, config);
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const { url: fixed, stripped } = normalizeUrlForCore(url);
    console.log('[API][REQ]', {
      path: fixed,
      method: 'PUT',
      base: getApiBaseURL(),
      from: url,
      prefixed: stripped,
      hasBody: !!data,
    });
    return coreApi.put<T>(fixed, data, config);
  },
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    const { url: fixed, stripped } = normalizeUrlForCore(url);
    console.log('[API][REQ]', {
      path: fixed,
      method: 'PATCH',
      base: getApiBaseURL(),
      from: url,
      prefixed: stripped,
      hasBody: !!data,
    });
    return coreApi.patch<T>(fixed, data, config);
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    const { url: fixed, stripped } = normalizeUrlForCore(url);
    console.log('[API][REQ]', {
      path: fixed,
      method: 'DELETE',
      base: getApiBaseURL(),
      from: url,
      prefixed: stripped,
    });
    return coreApi.delete<T>(fixed, config);
  },
};

// ===== Re-Exports =====
// - 레거시 호환: default export = coreApi (axios 인스턴스)
// - named export 제공
export default coreApi;
export {
  // 인스턴스 및 래퍼
  coreApi as api,
  http,
  // 상수/유틸
  API_PREFIX,
  getApiBaseURL,
  // 토큰 제어(코어 위임)
  setAuthTokenCore as setAuthToken,
  clearAuthTokenCore as clearAuthToken,
  getAuthTokenCore as getAuthToken,
};
