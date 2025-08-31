// src/lib/api.ts
// ------------------------------------------------------
// ✅ 혼성콘텐츠 방지 + 개발/앱 모두 커버 (개선판)
// - 우선순위:
//   0) localStorage override
//   1) .env VITE_API_BASE_URL (배포/앱)
//   2) Capacitor 감지 → (env 없으면) 개발 기본값 회피
//   3) HTTPS 페이지: 같은 오리진 + /api
//   4) 개발(HTTP): http://<host>:2000/api
//   5) 그 외: 현재 오리진 + /api
// ------------------------------------------------------
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

const OVERRIDE_KEY = 'DEV_API_BASE_URL_OVERRIDE';

// 끝 슬래시 제거 + '/api' 1회 보장
function normalize(base: string): string {
  let u = (base || '').trim().replace(/\/+$/, '');
  if (!/\/api$/i.test(u)) u = `${u}/api`;
  return u;
}

function resolveBaseURL(): string {
  // 0) 로컬 오버라이드(테스트용)
  try {
    const ls = localStorage.getItem(OVERRIDE_KEY);
    if (ls && ls.trim()) {
      const over = normalize(ls);
      console.log('[api] ⚠️ localStorage override 사용:', over);
      return over;
    }
  } catch {
    /* SSR 등 localStorage 미존재시 무시 */
  }

  // 1) .env 우선
  const ENV_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (ENV_BASE && ENV_BASE.trim()) {
    const envUrl = normalize(ENV_BASE);
    console.log('[api] 🌐 .env VITE_API_BASE_URL 사용:', envUrl);
    return envUrl;
  }

  // 2) 런타임 환경
  const { protocol, hostname, port, origin } = window.location;
  const isHttps = protocol === 'https:';
  const isDevPort = ['8081', '5173', '5174', '3000'].includes(port);
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname);

  const isCapacitor =
    protocol === 'capacitor:' || (typeof origin === 'string' && origin.startsWith('capacitor://'));

  // 2-a) Capacitor 앱
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

  // 2-d) 그 외
  const fallback = normalize(origin);
  console.log('[api] ℹ️ 기본 경로 사용:', fallback, '| origin=', origin);
  return fallback;
}

export const api = axios.create({
  baseURL: resolveBaseURL(), // 예: https://tzchat.duckdns.org/api  또는 http://<host>:2000/api
  withCredentials: true,     // 세션 쿠키 전달
  timeout: 15000,
});

// ✅ 여기가 포인트: 반환 타입을 InternalAxiosRequestConfig로 유지하고 그대로 return
api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  // cfg.url이 '/'로 시작하지 않으면 앞에 '/' 보정
  const path = cfg.url ? (cfg.url.startsWith('/') ? cfg.url : `/${cfg.url}`) : '';
  const fullUrl = `${cfg.baseURL || ''}${path}`;

  // (선택) 헤더 보정이 필요하면 이렇게 안전하게:
  // if (!cfg.headers) cfg.headers = {} as any;

  console.log('✅ [Axios][REQ]', {
    method: (cfg.method || 'get').toUpperCase(),
    url: fullUrl,
    params: cfg.params,
    data: cfg.data,
    withCredentials: cfg.withCredentials,
  });

  return cfg; // ← 절대 AxiosRequestConfig로 캐스팅하지 말고 그대로 반환
});

// 응답 인터셉터 타입 명시(선택이지만 가독성↑)
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

// (선택) 인증 헬퍼 — baseURL이 이미 /api 이므로 경로는 '/login'처럼 짧게
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
