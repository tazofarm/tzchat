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
// - axios withCredentials = true (세션/쿠키 전송 유지) + JWT(Bearer) 병행
// - 요청/응답 인터셉터 상세 로그 + 401 처리(토큰 만료 정리)
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
  if (!u) return '/api';
  u = u.replace(/\/+$/g, '');
  if (!/\/api$/i.test(u)) u = `${u}/api`;
  return u;
}

/** 최종 baseURL 결정 로직 */
function resolveBaseURL(): string {
  // 0) 로컬 오버라이드
  try {
    const ls = localStorage.getItem(OVERRIDE_KEY);
    if (ls && ls.trim()) {
      const over = normalize(ls);
      console.log('[HTTP][CFG] localStorage override:', over);
      return over;
    }
  } catch {}

  // 1) .env 최우선
  const ENV_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (ENV_BASE && ENV_BASE.trim()) {
    const envUrl = normalize(ENV_BASE);
    console.log('[HTTP][CFG] .env VITE_API_BASE_URL:', envUrl);
    return envUrl;
  }

  // 2) 런타임 환경
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

  if (isCapacitor) {
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.warn('[HTTP][CFG] Capacitor detected → fallback:', base, '| origin=', origin);
    return base;
  }
  if (isHttps) {
    const base = normalize(origin);
    console.log('[HTTP][CFG] HTTPS origin:', base);
    return base;
  }
  if (!isHttps && (isDevPort || isLocalHost)) {
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.log('[HTTP][CFG] DEV http→:2000:', base, '| host=', hostname, '| port=', port);
    return base;
  }
  const fallback = normalize(origin);
  console.log('[HTTP][CFG] fallback origin:', fallback);
  return fallback;
}

/** 최종 baseURL 계산 */
const FINAL_BASE_URL = resolveBaseURL();

/** ===== JWT 토큰 관리(앱 호환) =====
 * - 백엔드가 httpOnly 쿠키를 설정하므로 웹은 쿠키만으로도 동작
 * - 앱/웹뷰 등 쿠키 제약 환경을 위해 Authorization Bearer도 병행
 */
const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(token?: string) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      console.log('[AUTH][SET] token saved (len):', token.length);
    }
  } catch {}
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    console.log('[AUTH][CLR] token removed');
  } catch {}
}
export function getApiBaseURL(): string {
  return FINAL_BASE_URL;
}

export const api = axios.create({
  baseURL: FINAL_BASE_URL, // 예: https://tzchat.duckdns.org/api  또는 http://<host>:2000/api
  withCredentials: true,   // ✅ 쿠키 전송 유지
  timeout: 15000,
});

// ------------------------------------------------------
// 요청 인터셉터 (상세 로그 + Bearer 자동 첨부)
// ------------------------------------------------------
api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const path = cfg.url ? (cfg.url.startsWith('/') ? cfg.url : `/${cfg.url}`) : '';
  const fullUrl = `${cfg.baseURL || ''}${path}`;
  const token = getToken();

  // Authorization Bearer 첨부(이미 지정되어 있지 않을 때만)
  if (token && !(cfg.headers as any)?.Authorization) {
    (cfg.headers as any) = { ...(cfg.headers as any), Authorization: `Bearer ${token}` };
  }

  console.log('[HTTP][REQ]', {
    method: (cfg.method || 'get').toUpperCase(),
    url: fullUrl,
    params: cfg.params,
    data: cfg.data,
    withCredentials: cfg.withCredentials,
    hasBearer: !!token,
  });

  return cfg;
});

// ------------------------------------------------------
// 응답 인터셉터 (성공/실패 로그 + 401 처리)
// ------------------------------------------------------
api.interceptors.response.use(
  (res: AxiosResponse) => {
    console.log('[HTTP][RES]', { status: res.status, url: res.config?.url });
    return res;
  },
  (err: AxiosError) => {
    const status = err.response?.status;
    const data = err.response?.data;
    const url = err.config?.url;
    console.log('[HTTP][ERR]', { status, url, message: err.message, data });

    // 인증 실패 시 로컬 토큰만 정리(쿠키는 서버에서 clearCookie)
    if (status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

// ------------------------------------------------------
// 인증 API 헬퍼 — baseURL이 이미 /api 이므로 경로는 '/login' 등 짧게
// - 로그인 성공 시 서버가 쿠키를 설정하며, 동시에 응답 body의 token이 있으면 저장
// - 로그아웃 시 로컬 토큰 제거
// ------------------------------------------------------
export const AuthAPI = {
  async login(payload: { username: string; password: string }) {
    const res = await api.post('/login', payload);
    const token = (res?.data as any)?.token;
    if (token) setToken(token);
    return res;
  },
  me() {
    return api.get('/me');
  },
  async logout() {
    try {
      await api.post('/logout');
    } finally {
      clearToken();
    }
  },
};
