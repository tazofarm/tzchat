// src/lib/axiosInstance.ts
// ------------------------------------------------------
// ✅ 단일 axios 인스턴스 + http 래퍼
// - baseURL = ORIGIN(도메인/포트)만 사용 (/api 붙이지 않음)
// - 각 호출부는 `${API_PREFIX}/...` 사용
// - 인터셉터/로깅/withCredentials 일원화
// - 하위호환: default export = api (axios 인스턴스)
//            named export = { api, http, API_PREFIX, getApiBaseURL }
// ------------------------------------------------------

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// ===== ENV =====
const ORIGIN = import.meta.env.VITE_API_ORIGIN as string;            // 예: http://localhost:2000
const API_PREFIX = (import.meta.env.VITE_API_PREFIX || '/api') as string;
const getApiBaseURL = () => ORIGIN;

// ===== Axios Instance =====
const api: AxiosInstance = axios.create({
  baseURL: ORIGIN,        // ❗ '/api' 금지 → /api/api 방지
  withCredentials: true,  // 세션/쿠키 전달
  timeout: 15000,
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
const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('🌐[HTTP][GET]', url, config || {});
    return api.get<T>(url, config);
  },
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('🌐[HTTP][POST]', url, { data, ...(config || {}) });
    return api.post<T>(url, data, config);
  },
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('🌐[HTTP][PUT]', url, { data, ...(config || {}) });
    return api.put<T>(url, data, config);
  },
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('🌐[HTTP][PATCH]', url, { data, ...(config || {}) });
    return api.patch<T>(url, data, config);
  },
  delete<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    console.log('🌐[HTTP][DELETE]', url, config || {});
    return api.delete<T>(url, config);
  },
};

// ===== Exports =====
// 레거시 호환: default 로 axios 인스턴스 제공 (import axios from '@/lib/axiosInstance')
export default api;
// 신규/혼용 가능: 필요한 경우 http 래퍼/상수도 사용 가능
export { api, http, API_PREFIX, getApiBaseURL };
