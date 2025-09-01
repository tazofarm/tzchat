// src/lib/http.ts
// ------------------------------------------------------
// ✅ 얇은 프록시: axiosInstance.ts 재사용
// - 이미 http.ts로 import 바꾼 파일과의 호환 유지
// ------------------------------------------------------
import apiDefault, { api, http, API_PREFIX, getApiBaseURL } from './axiosInstance';

export default http;           // default = http wrapper
export { http, api, API_PREFIX, getApiBaseURL }; // named 동일 노출

// 하위호환(혹시 default를 axios로 기대하는 코드가 있으면 이 줄로 커버 가능)
// export default api;
