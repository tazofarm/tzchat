// src/lib/api.ts
// ------------------------------------------------------
// ✅ 혼성콘텐츠 방지 + 개발 편의 동시 지원 버전
// - 원칙:
//   1) 페이지가 HTTPS면 → 현재 오리진 + /api  (예: https://tzchat.duckdns.org/api)
//   2) 개발(HTTP, 8081/5173 등)면 → http://<host>:2000/api
// - 수동 오버라이드(테스트용):
//   localStorage.setItem('DEV_API_BASE_URL_OVERRIDE','http://192.168.0.7:2000')
//   localStorage.removeItem('DEV_API_BASE_URL_OVERRIDE')
// - withCredentials: true (세션 쿠키 전달)
// ------------------------------------------------------
import axios from 'axios';

const OVERRIDE_KEY = 'DEV_API_BASE_URL_OVERRIDE';

// ------------------------------------------------------
// 내부 유틸: /api 붙이기 + 끝 슬래시 제거
// ------------------------------------------------------
function normalize(base: string) {
  let u = base.trim().replace(/\/+$/, '');
  if (!/\/api$/.test(u)) u = `${u}/api`;
  return u;
}

// ------------------------------------------------------
// 환경 자동 판별
// ------------------------------------------------------
function resolveBaseURL(): string {
  // 0) 로컬 오버라이드(테스트용)
  const ls = localStorage.getItem(OVERRIDE_KEY);
  if (ls && ls.trim()) {
    const over = normalize(ls);
    console.log('[api] ⚠️ localStorage override 사용:', over);
    return over;
  }

  // 1) 런타임 환경 정보
  const { protocol, hostname, port, origin } = window.location;
  const isHttps = protocol === 'https:';
  const isDevPort = ['8081', '5173', '3000', '5174'].includes(port); // 필요시 추가
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname);

  // 2) 의사결정
  // - HTTPS 페이지에서 http://:2000 으로 가면 혼성콘텐츠로 차단됨 → 반드시 같은 오리진 사용
  if (isHttps) {
    const base = normalize(origin);
    console.log('[api] 🌐 HTTPS 페이지 감지 → 같은 오리진 사용:', base, '| origin=', origin);
    return base;
  }

  // - 개발/프리뷰 환경(Vite/Ionic dev 등)은 :2000 백엔드 직통
  if (!isHttps && (isDevPort || isLocalHost)) {
    const base = normalize(`http://${hostname}:2000`);
    console.log('[api] 🧪 DEV 모드 감지 → :2000 사용:', base, '| host=', hostname, '| port=', port);
    return base;
  }

  // - 그 외: 기본적으로 현재 오리진 /api (혼성콘텐츠 예방)
  const fallback = normalize(origin);
  console.log('[api] ℹ️ 기본 경로 사용:', fallback, '| origin=', origin);
  return fallback;
}

// ------------------------------------------------------
// Axios 인스턴스
// ------------------------------------------------------
export const api = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: true, // ✅ 세션 쿠키 전달(서버 SameSite=None; Secure 권장)
  timeout: 15000,
});

// ------------------------------------------------------
// 요청/응답 로깅 (최대한 자세히)
// ------------------------------------------------------
api.interceptors.request.use((cfg) => {
  const fullUrl =
    (cfg.baseURL || '') +
    // cfg.url이 '/'로 시작하지 않으면 슬래시 보정
    (cfg.url ? (cfg.url.startsWith('/') ? cfg.url : `/${cfg.url}`) : '');
  console.log('✅ [Axios][REQ]', {
    method: cfg.method,
    url: fullUrl,
    params: cfg.params,
    data: cfg.data,
    withCredentials: cfg.withCredentials,
  });
  return cfg;
});

api.interceptors.response.use(
  (res) => {
    console.log('✅ [Axios][RES:OK]', res.status, res.config?.url);
    return res;
  },
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    const url = err.config?.url;
    console.log('❌ [Axios][RES:ERR]', status, url, err.message, data);
    // 401 같은 인증 오류는 여기서 추가 처리 가능
    return Promise.reject(err);
  }
);
