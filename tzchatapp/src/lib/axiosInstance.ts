// src/lib/axiosInstance.ts
// ------------------------------------------------------
// ✅ 최종본(보수적):
// - 기존 import 형태를 최대한 유지하면서도
// - 내부적으로는 api.ts의 "단일 axios 인스턴스"만 사용
// - 새 axios.create(...) 절대 생성하지 않음 → 설정/인터셉터 일관성 보장
// ------------------------------------------------------
import { api, getApiBaseURL } from './api';

// 과거 코드 호환을 위해 같은 이름으로 별칭 부여
const axiosInstance = api;

// 기본(default) + 명명(named) 동시 제공 (레거시/신규 둘 다 커버)
export default axiosInstance;
export { axiosInstance, api, getApiBaseURL };
