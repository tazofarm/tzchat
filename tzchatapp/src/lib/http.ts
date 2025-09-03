// src/lib/http.ts
// ------------------------------------------------------
// ✅ 얇은 프록시 + JWT 헤더 자동 첨부 헬퍼
// - 기존 axiosInstance 재사용(호환 유지)
// - JWT(Bearer) 토큰을 로컬 스토리지와 메모리에 보관/첨부
// - httpOnly 쿠키 세션과 병행: withCredentials=true 보장
// - 로그 규격 적용: [HTTP]/[AUTH]
// ------------------------------------------------------
import apiDefault, { api, http, API_PREFIX, getApiBaseURL } from './axiosInstance';

// ------------------------------------------------------
// 공통 설정: 쿠키 세션 병행 위해 withCredentials 강제
// ------------------------------------------------------
try {
  // axios 인스턴스가 제공하는 기본 옵션에 withCredentials 강제
  (apiDefault as any).defaults && ((apiDefault as any).defaults.withCredentials = true);
  (api as any).defaults && ((api as any).defaults.withCredentials = true);
  (http as any).defaults && ((http as any).defaults.withCredentials = true);
  // 디버그 로그
  // eslint-disable-next-line no-console
  console.log('[HTTP][CFG] withCredentials=true (쿠키 병행 전송 활성화)');
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.warn('[HTTP][CFG] withCredentials 설정 중 경고:', e?.message);
}

// ------------------------------------------------------
// JWT 토큰 관리(메모리 + WebStorage 동기화)
// - 앱/웹 공용: 로그인 응답의 token을 setAuthToken(token, true)로 저장
// - 보안상 콘솔에는 토큰 전문을 남기지 않음
// ------------------------------------------------------
const STORAGE_KEY = 'tzchat.jwt';

let _authToken: string | null = null;

function safeMask(token: string) {
  if (!token) return '';
  return token.length <= 12 ? token[0] + '***' : token.slice(0, 4) + '***' + token.slice(-4);
}

export function getAuthToken(): string | null {
  // 메모리에 없고 브라우저 환경이면 storage에서 복원
  if (!_authToken && typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v) {
        _authToken = v;
        // eslint-disable-next-line no-console
        console.log('[AUTH][DBG] 토큰 복원(localStorage)', { mask: safeMask(v) });
      }
    } catch (_) {}
  }
  return _authToken;
}

export function setAuthToken(token: string | null, persist = true) {
  _authToken = token || null;
  // eslint-disable-next-line no-console
  console.log('[AUTH][SET]', { hasToken: !!token, mask: token ? safeMask(token) : null, persist });

  if (typeof window !== 'undefined') {
    try {
      if (persist && token) window.localStorage.setItem(STORAGE_KEY, token);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // storage 접근 불가(예: 사파리 프라이빗) 시 무시
    }
  }
}

export function clearAuthToken() {
  setAuthToken(null, false);
}

// ------------------------------------------------------
// 인터셉터: Authorization 자동 첨부
// - 이미 명시된 Authorization이 있으면 건드리지 않음
// - 요청/응답 로그(경량) 출력
// ------------------------------------------------------
let _ejectIds: { req?: number; res?: number } = {};

export function attachAuthInterceptors() {
  // 중복 연결 방지
  if (_ejectIds.req != null || _ejectIds.res != null) return;

  const instance = (http as any) || (api as any) || apiDefault;

  const reqId = instance.interceptors.request.use(
    (config: any) => {
      const token = getAuthToken();
      if (token && !config.headers?.Authorization) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      // eslint-disable-next-line no-console
      console.log('[HTTP][REQ]', {
        method: (config.method || 'get').toUpperCase(),
        url: config.url,
        hasToken: !!token || !!config.headers?.Authorization,
        origin: getApiBaseURL?.() || 'n/a',
      });
      return config;
    },
    (error: any) => {
      // eslint-disable-next-line no-console
      console.log('[HTTP][ERR]', { step: 'request', message: error?.message });
      return Promise.reject(error);
    }
  );

  const resId = instance.interceptors.response.use(
    (res: any) => {
      // eslint-disable-next-line no-console
      console.log('[HTTP][RES]', {
        url: res?.config?.url,
        status: res?.status,
        size: (() => {
          try {
            const s = JSON.stringify(res?.data);
            return s ? s.length : 0;
          } catch { return 0; }
        })(),
      });
      return res;
    },
    (error: any) => {
      const status = error?.response?.status;
      const url = error?.config?.url;
      // eslint-disable-next-line no-console
      console.warn('[HTTP][ERR]', { step: 'response', status, url, message: error?.message });

      // 401 처리 가이드: 토큰 무효 시 선택적으로 토큰 제거(자동 로그아웃 UX는 앱/웹에서 결정)
      if (status === 401) {
        // noop by default; 앱/웹에서 라우팅/알림 처리
        // clearAuthToken(); // ← 필요 시 활성화
      }
      return Promise.reject(error);
    }
  );

  _ejectIds = { req: reqId, res: resId };
  // eslint-disable-next-line no-console
  console.log('[HTTP][CFG] 인터셉터 연결 완료', _ejectIds);
}

export function detachAuthInterceptors() {
  const instance = (http as any) || (api as any) || apiDefault;
  try {
    if (_ejectIds.req != null) instance.interceptors.request.eject(_ejectIds.req as number);
    if (_ejectIds.res != null) instance.interceptors.response.eject(_ejectIds.res as number);
    // eslint-disable-next-line no-console
    console.log('[HTTP][CFG] 인터셉터 해제 완료');
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[HTTP][CFG] 인터셉터 해제 중 경고:', e?.message);
  } finally {
    _ejectIds = {};
  }
}

// 초기 부팅 시점에 기본 연결(필요시 앱에서 재연결 가능)
attachAuthInterceptors();

// ------------------------------------------------------
// 기존 호환 export
// ------------------------------------------------------
export default http; // default = http wrapper
export { http, api, API_PREFIX, getApiBaseURL };
