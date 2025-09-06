// src/lib/http.ts
// ------------------------------------------------------
// ✅ 얇은 프록시 + 코어 재사용(단일 소스 정리판)
// - 토큰/인터셉터/URL 보정은 src/lib/api.ts 및 src/lib/axiosInstance.ts 에서만 수행
// - 이 파일은 얇은 래퍼와 호환용 export/로그만 담당
// - withCredentials 강제 유지, attach/detach는 no-op(코어에 위임)
// ------------------------------------------------------
import apiDefault, {
  api,
  http as coreHttp,
  API_PREFIX,
  getApiBaseURL,
  // 코어 토큰 제어기 재사용(단일 소스)
  setAuthToken as setAuthTokenCore,
  clearAuthToken as clearAuthTokenCore,
  getAuthToken as getAuthTokenCore,
} from './axiosInstance';

// ------------------------------------------------------
// 공통 설정: 쿠키 세션 병행 위해 withCredentials 강제
// ------------------------------------------------------
try {
  (apiDefault as any)?.defaults && ((apiDefault as any).defaults.withCredentials = true);
  (api as any)?.defaults && ((api as any).defaults.withCredentials = true);
  // coreHttp는 함수 모음이므로 defaults 없음
  // 디버그 로그
  console.log('[HTTP][CFG]', {
    step: 'init',
    withCredentials: true,
    base: getApiBaseURL?.(),
    prefix: API_PREFIX,
  });
} catch (e: any) {
  console.warn('[HTTP][CFG]', { step: 'init-warn', message: e?.message });
}

// ------------------------------------------------------
// 호환용 no-op 인터셉터 훅
// - 실제 인터셉터는 api.ts에서 이미 연결됨
// - 기존 코드가 호출할 수 있으므로 형태만 유지
// ------------------------------------------------------
export function attachAuthInterceptors() {
  console.log('[HTTP][CFG]', { step: 'attachInterceptors', note: 'handled in core(api.ts)' });
}
export function detachAuthInterceptors() {
  console.log('[HTTP][CFG]', { step: 'detachInterceptors', note: 'handled in core(api.ts)' });
}

// ------------------------------------------------------
// 토큰 제어: 코어 함수에 위임(단일화)
// ------------------------------------------------------
export const setAuthToken = setAuthTokenCore;
export const clearAuthToken = clearAuthTokenCore;
export const getAuthToken = getAuthTokenCore;

// ------------------------------------------------------
// 얇은 http 래퍼: 코어 http를 그대로 노출(로그는 코어에서 상세 출력)
// - 필요 시 여기에서 추가 로그를 얹을 수 있으나 중복을 피하기 위해 유지
// ------------------------------------------------------
const http = {
  get: coreHttp.get,
  post: coreHttp.post,
  put: coreHttp.put,
  patch: coreHttp.patch,
  delete: coreHttp.delete,
};

// ------------------------------------------------------
// 기존 호환 export
// ------------------------------------------------------
export default http; // default = http wrapper(얇은 프락시)
export { http, api, API_PREFIX, getApiBaseURL };
