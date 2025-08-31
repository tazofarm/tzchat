// src/lib/api.ts
// ------------------------------------------------------
// ✅ 혼성콘텐츠 방지 + 개발/앱 모두 커버 (최신 정리판)
// 우선순위:
//   0) localStorage override (DEV_API_BASE_URL_OVERRIDE)
//   1) .env VITE_API_BASE_URL  ← ★ 앱/웹/원격-dev 모두 여기서 해결
//   2) Capacitor 감지 시(.env 없을 때만) 개발 기본값(:2000)로 폴백
//   3) HTTPS 페이지: 같은 오리진 + /api
//   4) 개발(HTTP): http://<host>:2000/api
//   5) 그 외: 현재 오리진 + /api
//
// - 모든 경우 baseURL은 최종적으로 ".../api" 형식이 되도록 normalize
// - axios withCredentials = true (세션 쿠키 전송 필수)
// - 요청/응답 인터셉터에 상세 로그 추가 (디버깅 강화)
// ------------------------------------------------------
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

const OVERRIDE_KEY = 'DEV_API_BASE_URL_OVERRIDE'; // 로컬 테스트용 강제 baseURL 저장 키

/** 끝 슬래시 제거 + '/api' 1회 보장 */
function normalize(base: string): string {
  let u = (base || '').trim();

  // 공백/빈문자열 방어
  if (!u) return '/api';

  // 중복 슬래시 정리
  u = u.replace(/\/+$/g, '');

  // 이미 /api 로 끝나면 유지, 아니면 추가
  if (!/\/api$/i.test(u)) u = `${u}/api`;

  return u;
}

/** 최종 baseURL 결정 로직 */
function resolveBaseURL(): string {
  // 0) 로컬 오버라이드(테스트용) — 가장 먼저 체크
  try {
    const ls = localStorage.getItem(OVERRIDE_KEY);
    if (ls && ls.trim()) {
      const over = normalize(ls);
      console.log('[api] ⚠️ localStorage override 사용:', over);
      return over;
    }
  } catch {
    // SSR 등 localStorage 미존재시 무시
  }

  // 1) .env 최우선 (요청하신 4가지 모드에서 모두 이 경로로 해결됨)
  const ENV_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (ENV_BASE && ENV_BASE.trim()) {
    const envUrl = normalize(ENV_BASE);
    console.log('[api] 🌐 .env VITE_API_BASE_URL 사용:', envUrl);
    return envUrl;
  }

  // 2) 런타임 환경 판단 (Capacitor 등) — .env가 없을 때만 적용됨
  const { protocol, hostname, port, origin } = window.location;
  const isHttps = protocol === 'https:';
  const isDevPort = ['8081', '5173', '5174', '3000'].includes(port || '');
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname);

  const isCapacitor =
    protocol === 'capacitor:' ||
    (typeof origin === 'string' && origin.startsWith('capacitor://'));

  // 2-a) Capacitor 앱 — .env가 없을 때만 로컬 백엔드로 폴백(개발 편의)
  if (isCapacitor) {
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.warn('[api] 📱 Capacitor 감지 — .env 미설정으로 개발 기본값 사용:', base, '| origin=', origin);
    return base;
  }

  // 2-b) HTTPS 페이지 → 같은 오리진
  if (isHttps) {
    const base = normalize(origin);
    console.log('[api] 🔒 HTTPS 페이지 감지 → 같은 오리진 사용:', base, '| origin=', origin);
    return base;
  }

  // 2-c) 개발(HTTP dev server) → :2000
  if (!isHttps && (isDevPort || isLocalHost)) {
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.log('[api] 🧪 DEV 모드 감지 → :2000 사용:', base, '| host=', hostname, '| port=', port);
    return base;
  }

  // 2-d) 그 외 → 현재 오리진
  const fallback = normalize(origin);
  console.log('[api] ℹ️ 기본 경로 사용:', fallback, '| origin=', origin);
  return fallback;
}

/** 최종 baseURL 계산 (앱/웹/원격-dev 모두 커버) */
const FINAL_BASE_URL = resolveBaseURL();

export const api = axios.create({
  baseURL: FINAL_BASE_URL, // 예: https://tzchat.duckdns.org/api  또는 http://<host>:2000/api
  withCredentials: true,   // ✅ 세션 쿠키 전달 (크로스사이트 필수)
  timeout: 15000,
});

// ------------------------------------------------------
// 요청 인터셉터 (상세 로그)
// - cfg.url이 '/'로 시작하지 않으면 보정하여 로그 가독성 강화
// - 헤더/파라미터/바디를 함께 로깅(민감정보는 서버에서 필터링 권장)
// ------------------------------------------------------
api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const path = cfg.url ? (cfg.url.startsWith('/') ? cfg.url : `/${cfg.url}`) : '';
  const fullUrl = `${cfg.baseURL || ''}${path}`;

  // (필요 시) 헤더 보정
  // if (!cfg.headers) cfg.headers = {} as any;

  console.log('✅ [Axios][REQ]', {
    method: (cfg.method || 'get').toUpperCase(),
    url: fullUrl,
    params: cfg.params,
    data: cfg.data,
    withCredentials: cfg.withCredentials,
  });

  return cfg; // 타입 그대로 유지
});

// ------------------------------------------------------
// 응답 인터셉터 (성공/실패 모두 상세 로그)
// ------------------------------------------------------
api.interceptors.response.use(
  (res: AxiosResponse) => {
    console.log('✅ [Axios][RES:OK]', res.status, res.config?.url);
    return res;
  },
  (err: AxiosError) => {
    const status = err.response?.status;
    const data = err.response?.data;
    const url = err.config?.url;
    console.log('❌ [Axios][RES:ERR]', status, url, err.message, data);
    return Promise.reject(err);
  }
);

// ------------------------------------------------------
// (선택) 런타임 헬퍼: 현재 baseURL을 노출(디버깅용)
// ------------------------------------------------------
export function getApiBaseURL(): string {
  return FINAL_BASE_URL;
}

// ------------------------------------------------------
// (선택) 인증 API 헬퍼 — baseURL이 이미 /api 이므로 경로는 '/login' 등 짧게
// ------------------------------------------------------
export const AuthAPI = {
  login(payload: { username: string; password: string }) {
    return api.post('/login', payload);
  },
  me() {
    return api.get('/me');
  },
  logout() {
    return api.post('/logout');
  },
};
