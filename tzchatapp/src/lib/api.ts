// src/lib/api.ts
// -------------------------------------------------------------
// ✅ 혼성콘텐츠 방지 + 개발/앱 모두 커버 (안정화판 + dev:remote 안전가드 강화)
// 우선순위:
//   0) localStorage override (DEV_API_BASE_URL_OVERRIDE)   ← ⚠ dev(local)에서만 허용
//   1) .env VITE_API_BASE_URL 또는 VITE_API_BASE           ← ★ dev/web/prod/dev-remote 모두 여기로 해결
//   2) (강제 원격) VITE_DEV_REMOTE === 'true' 또는 VITE_REMOTE === '1' 이면 원격 기본값 사용
//   3) (개선) dev-remote 모드 가드: MODE==='dev-remote' 또는 VITE_MODE==='dev-remote' → 원격 기본값
//   4) Capacitor/파일스킴 등 특수 환경 폴백(:2000)
//   5) HTTPS 페이지: 같은 오리진 + /api
//   6) 개발(HTTP): http://<host>:2000/api
//   7) 그 외: 현재 오리진 + /api
//
// - 모든 경우 baseURL은 최종적으로 ".../api" 형식으로 normalize
// - axios withCredentials=true(세션 쿠키 호환) + JWT(Bearer) 병행
// - 요청/응답 인터셉터 상세 로그(민감정보 마스킹) + 401 시 로컬 토큰 정리
// - 유틸: setAuthToken/getAuthToken/clearToken/clearApiOverride/debugApiConfig
// -------------------------------------------------------------
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

// ⭐ MODE 개선: Vite 기본 MODE + 사용자 지정 VITE_MODE 모두 지원
const RAW_MODE = (import.meta as any)?.env?.MODE as string | undefined;
const RAW_VITE_MODE = (import.meta as any)?.env?.VITE_MODE as string | undefined;
// 최종 MODE: VITE_MODE 우선, 없으면 MODE
const MODE = (RAW_VITE_MODE && RAW_VITE_MODE.trim()) || RAW_MODE || 'development';

const OVERRIDE_KEY = 'DEV_API_BASE_URL_OVERRIDE';
const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN';
const AUTH_MODE = (import.meta as any)?.env?.VITE_AUTH_MODE || 'jwt';

// ⚠ dev:remote 기본값(환경값 미적용시 안전가드)
const DEV_REMOTE_DEFAULT = 'https://tzchat.duckdns.org';

// 추가: 강제 원격 플래그 (스크립트/CI에서 사용)
const FORCE_DEV_REMOTE =
  (import.meta as any)?.env?.VITE_DEV_REMOTE === 'true' ||
  (import.meta as any)?.env?.VITE_REMOTE === '1';

const DISABLE_OVERRIDE =
  (import.meta as any)?.env?.VITE_DISABLE_API_OVERRIDE === 'true' ||
  MODE === 'dev-remote' || MODE === 'web' || MODE === 'production';

// --- 유틸: 끝 슬래시 제거 + '/api' 1회 보장 ---
function normalize(base: string): string {
  let u = (base || '').trim();
  if (!u) return '/api';
  u = u.replace(/\/+$/g, '');
  if (!/\/api$/i.test(u)) u = `${u}/api`;
  return u;
}

// --- 최종 baseURL 결정 ---
function resolveBaseURL(): { base: string; source: string } {
  // 0) 로컬 오버라이드 (dev(local)에서만 허용)
  if (!DISABLE_OVERRIDE) {
    try {
      const ls = localStorage.getItem(OVERRIDE_KEY);
      if (ls && ls.trim()) {
        const over = normalize(ls);
        console.log('[HTTP][CFG]', { source: 'localStorage', over, MODE, AUTH_MODE, RAW_MODE, RAW_VITE_MODE });
        return { base: over, source: 'localStorage' };
      }
    } catch {}
  } else {
    // override 존재 시 무시됨을 알림 (개발자 혼동 방지)
    try {
      const has = !!localStorage.getItem(OVERRIDE_KEY);
      if (has) {
        console.warn('[HTTP][CFG]', { note: 'override-ignored', reason: 'mode', MODE, key: OVERRIDE_KEY });
      }
    } catch {}
  }

  // 1) .env 최우선 (두 키 모두 지원)
  const ENV_BASE_URL =
    (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  const ENV_BASE_ALT =
    (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  const PICKED_ENV = (ENV_BASE_URL && ENV_BASE_URL.trim())
    ? ENV_BASE_URL
    : (ENV_BASE_ALT && ENV_BASE_ALT.trim())
      ? ENV_BASE_ALT
      : undefined;

  if (PICKED_ENV) {
    const envUrl = normalize(PICKED_ENV);
    console.log('[HTTP][CFG]', { source: '.env', base: envUrl, MODE, AUTH_MODE, RAW_MODE, RAW_VITE_MODE });
    return { base: envUrl, source: '.env' };
  }

  // 2) 강제 원격 플래그 (스크립트에서 쉽게 강제)
  if (FORCE_DEV_REMOTE) {
    const guard = normalize(DEV_REMOTE_DEFAULT);
    console.warn('[HTTP][CFG]', {
      source: 'force-dev-remote',
      note: 'VITE_DEV_REMOTE/VITE_REMOTE flag detected → using DEV_REMOTE_DEFAULT',
      base: guard,
      MODE,
      RAW_MODE,
      RAW_VITE_MODE,
    });
    return { base: guard, source: 'force-dev-remote' };
  }

  // 3) 개선된 dev:remote 모드 가드
  const isDevRemote =
    MODE === 'dev-remote' || RAW_VITE_MODE === 'dev-remote';
  if (isDevRemote) {
    const guard = normalize(DEV_REMOTE_DEFAULT);
    console.warn('[HTTP][CFG]', {
      source: 'dev-remote-guard',
      note: 'MODE/VITE_MODE indicates dev-remote → using DEV_REMOTE_DEFAULT',
      base: guard,
      MODE,
      RAW_MODE,
      RAW_VITE_MODE,
    });
    return { base: guard, source: 'dev-remote-guard' };
  }

  // 4) 런타임 환경
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
    protocol === 'file:' ||
    protocol === 'ionic:';

  if (isCapacitor) {
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.warn('[HTTP][CFG] Capacitor/file → fallback :2000', { base, origin, protocol, MODE });
    return { base, source: 'capacitor-fallback' };
  }
  if (isHttps) {
    const base = normalize(origin);
    console.log('[HTTP][CFG] https-origin', { base, MODE });
    return { base, source: 'https-origin' };
  }
  if (!isHttps && (isDevPort || isLocalHost)) {
    // ⚠ dev 로컬 환경 전용. (원격 백엔드가 필요하면 위의 env/flag 사용)
    const base = normalize(`http://${hostname || 'localhost'}:2000`);
    console.log('[HTTP][CFG] dev localhost → :2000', { base, hostname, port, MODE });
    return { base, source: 'dev-localhost' };
  }
  const fallback = normalize(origin);
  console.log('[HTTP][CFG] fallback-origin', { base: fallback, MODE });
  return { base: fallback, source: 'fallback-origin' };
}

// --- 최종 baseURL 계산 ---
const { base: FINAL_BASE_URL, source: FINAL_SOURCE } = resolveBaseURL();
console.log('[HTTP][CFG][FINAL]', {
  baseURL: FINAL_BASE_URL,
  source: FINAL_SOURCE,
  MODE,
  RAW_MODE,
  RAW_VITE_MODE,
  AUTH_MODE,
});

// ===== JWT 토큰 관리 =====
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
export function clearApiOverride() {
  try {
    localStorage.removeItem(OVERRIDE_KEY);
    console.log('[HTTP][CFG]', { step: 'clearApiOverride', ok: true });
  } catch {}
}
export function debugApiConfig() {
  try {
    const override = localStorage.getItem(OVERRIDE_KEY);
    console.log('[HTTP][DBG]', {
      MODE,
      RAW_MODE,
      RAW_VITE_MODE,
      AUTH_MODE,
      FINAL_BASE_URL,
      FINAL_SOURCE,
      overrideExists: !!override,
      overrideValue: override || null,
      envBaseUrl: (import.meta as any)?.env?.VITE_API_BASE_URL || null,
      envBaseAlt: (import.meta as any)?.env?.VITE_API_BASE || null,
      forceRemote: FORCE_DEV_REMOTE,
    });
  } catch {
    console.log('[HTTP][DBG]', {
      MODE,
      RAW_MODE,
      RAW_VITE_MODE,
      AUTH_MODE,
      FINAL_BASE_URL,
      FINAL_SOURCE,
      overrideExists: 'unknown',
      envBaseUrl: (import.meta as any)?.env?.VITE_API_BASE_URL || null,
      envBaseAlt: (import.meta as any)?.env?.VITE_API_BASE || null,
      forceRemote: FORCE_DEV_REMOTE,
    });
  }
}

// --- 단일 axios 인스턴스 ---
export const api = axios.create({
  baseURL: FINAL_BASE_URL,
  withCredentials: true, // 쿠키 인증 호환(현재는 JWT 사용 중)
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

  if (token && !(cfg.headers as any)?.Authorization) {
    (cfg.headers as any) = { ...(cfg.headers as any), Authorization: `Bearer ${token}` };
  }

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

    if (status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

// --- 인증 API 헬퍼 ---
export const AuthAPI = {
  async login(payload: { username: string; password: string }) {
    const res = await api.post('/login', payload);
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
