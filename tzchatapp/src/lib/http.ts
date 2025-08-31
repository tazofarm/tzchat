// src/lib/http.ts
// ------------------------------------------------------
// ✅ 얇은 HTTP 헬퍼 래퍼
// - 내부는 항상 axios 단일 인스턴스(api.ts)만 사용
// - 공통 옵션/로깅/쿠키(withCredentials)는 api.ts 인터셉터에서 처리
// ------------------------------------------------------
import api from './axiosInstance';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

// 공통 반환 타입(선택)
export type HttpResponse<T = any> = Promise<AxiosResponse<T>>;

const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): HttpResponse<T> {
    // url은 '/path' 형태 권장(api.ts에서 baseURL이 이미 .../api)
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

export default http;
export { http };
