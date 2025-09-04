// src/lib/api.ts
// -------------------------------------------------------------
// ✅ 혼성콘텐츠 방지 + 개발/앱 모두 커버 (안정화판)
// 우선순위:
//   0) localStorage override (DEV_API_BASE_URL_OVERRIDE)
//   1) .env VITE_API_BASE_URL  ← ★ dev/web/prod/dev-remote 모두 여기로 해결
//   2) Capacitor/파일스킴 등 특수 환경 폴백(:2000)
//   3) HTTPS 페이지: 같은 오리진 + /api
//   4) 개발(HTTP): http://<host>:2000/api
//   5) 그 외: 현재 오리진 + /api
//
// - 모든 경우 baseURL은 최종적으로 ".../api" 형식으로 normalize
// - axios withCredentials=true(세션 쿠키 호환) + JWT(Bearer) 병행
// - 요청/응답 인터셉터 상세 로그(민감정보 마스킹) + 401 시 로컬 토큰 정리
// - 수동 토큰 주입/조회 유틸 제공(setAuthToken/getAuthToken/clearToken)
// -------------------------------------------------------------
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

const OVERRIDE_KEY = 'DEV_API_BASE_URL_OVERRIDE'; // 로컬 강제 baseURL 키
const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN';            // JWT 저장 키
const AUTH_MODE = (import.meta as any)?.env?.VITE_AUTH_MODE || 'jwt';

// --- 유틸: 끝 슬래시 제거 + '/api' 1회 보장 ---
function normalize(base: string): string {
  let u = (base || '').trim();
  if (!u) return '/api';
  u = u.replace(/\/+$/g, '');
  if (!/\/api$/i.test(u)) u = `${u}/api`;
  return u;
}

// --- 최종 baseURL 결정 ---
function resolveBaseURL(): string {
  // 0) 로컬 오버라이드
  try {
    const ls = localStorage.getItem(OVERRIDE_KEY);
    if (ls && ls.trim()) {
      const over = normalize(ls);
      console.log('[HTTP][CFG]', { source: 'localStorage', over });
      return over;
    }
  } catch {}

  // 1) .env 최우선
  const ENV_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (ENV_BASE && ENV_BASE.trim()) {
    const envUrl = normalize(ENV_BASE);
    console.log('[HTTP][CFG]', { source: '.env', envUrl, AUTH_MODE });
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
    (typeof origin === 'string' && origin.startsWith('capacitor://')) ||
    protocol === 'file:' || // Android WebView file://
    protocol === 'ionic:';

  if (isCapacitor) {
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.warn('[HTTP][CFG] Capacitor/file detected → fallback :2000', { base, origin, protocol });
    return base;
  }
  if (isHttps) {
    const base = normalize(origin);
    console.log('[HTTP][CFG] https origin', { base });
    return base;
  }
  if (!isHttps && (isDevPort || isLocalHost)) {
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.log('[HTTP][CFG] dev http→:2000', { base, hostname, port });
    return base;
  }
  const fallback = normalize(origin);
  console.log('[HTTP][CFG] fallback origin', { fallback });
  return fallback;
}

// --- 최종 baseURL 계산 ---
const FINAL_BASE_URL = resolveBaseURL();

// ===== JWT 토큰 관리(앱/웹 공용) =====
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setAuthToken(token?: string | null) {
  try {
    if (token && token.trim()) {
      localStorage.setItem(TOKEN_KEY, token);
      console.log('[AUTH][SET]', { hasToken: true, len: token.length });
    } else {
      localStorage.removeItem(TOKEN_KEY);
      console.log('[AUTH][SET]', { hasToken: false });
    }
  } catch {}
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    console.log('[AUTH][CLR]', { ok: true });
  } catch {}
}
export function getApiBaseURL(): string {
  return FINAL_BASE_URL;
}

// --- 단일 axios 인스턴스 ---
export const api = axios.create({
  baseURL: FINAL_BASE_URL,          // 예: https://tzchat.duckdns.org/api 또는 http://<host>:2000/api
  withCredentials: true,            // ✅ 세션 쿠키 전달 유지 (JWT와 병행)
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// --- 요청 인터셉터: 상세 로그 + Bearer 자동첨부(민감정보 마스킹) ---
api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const path = cfg.url ? (cfg.url.startsWith('/') ? cfg.url : `/${cfg.url}`) : '';
  const fullUrl = `${cfg.baseURL || ''}${path}`;
  const token = getAuthToken();

  // Authorization Bearer 첨부(이미 지정되어 있지 않을 때만)
  if (token && !(cfg.headers as any)?.Authorization) {
    (cfg.headers as any) = { ...(cfg.headers as any), Authorization: `Bearer ${token}` };
  }

  // 민감정보 마스킹
  let safeData: any = cfg.data;
  try {
    if (path.startsWith('/login') && safeData && typeof safeData === 'object') {
      const clone = { ...(safeData as any) };
      if ('password' in clone) clone.password = '(hidden)';
      if ('pw' in clone) clone.pw = '(hidden)';
      safeData = clone;
    }
  } catch {}

  console.log('[HTTP][REQ]', {
    method: (cfg.method || 'get').toUpperCase(),
    url: fullUrl,
    params: cfg.params,
    data: safeData,
    withCredentials: cfg.withCredentials,
    hasBearer: !!token,
  });

  return cfg;
});

// --- 응답 인터셉터: 성공/실패 로그 + 401 처리 ---
api.interceptors.response.use(
  (res: AxiosResponse) => {
    console.log('[HTTP][RES]', {
      status: res.status,
      url: res.config?.url,
      size: typeof res.data === 'string' ? res.data.length : undefined,
    });
    return res;
  },
  (err: AxiosError) => {
    const status = err.response?.status;
    const data = err.response?.data;
    const url = err.config?.url;
    console.log('[HTTP][ERR]', {
      status,
      url,
      message: err.message,
      isAxiosError: !!(err as any).isAxiosError,
      data,
    });

    // 인증 실패 시 로컬 토큰만 정리(쿠키는 서버에서 clearCookie 수행)
    if (status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

// --- 인증 API 헬퍼 ---
// - baseURL 이미 /api 이므로 경로는 '/login' 등 짧게 사용
// - 로그인 성공 시 서버 쿠키 설정 + 응답 body의 token 발견 시 저장
export const AuthAPI = {
  async login(payload: { username: string; password: string }) {
    const res = await api.post('/login', payload);
    // 응답 스키마 다양한 경우 지원: { token }, { data: { token } }, { ok, token }
    const token =
      (res?.data as any)?.token ??
      (res?.data as any)?.data?.token ??
      null;
    if (token) setAuthToken(token);
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
