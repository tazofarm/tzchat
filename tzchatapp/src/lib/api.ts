// src/lib/api.ts
// ------------------------------------------------------
// 🔒 ENV-무시 버전 (VITE_* 변수에 전혀 영향받지 않음)
// dev/preview/prod 구분 없이 "현재 브라우저 호스트 + :2000/api" 사용
//   - PC:   http://localhost:8081 → http://localhost:2000/api
//   - 폰:   http://192.168.0.7:8081 → http://192.168.0.7:2000/api
//   - 도메인: http://foo.test:8081 → http://foo.test:2000/api
// 필요 시 즉석 오버라이드: localStorage.setItem('DEV_API_BASE_URL_OVERRIDE','http://192.168.0.7:2000')
// ------------------------------------------------------
import axios from 'axios';

const OVERRIDE_KEY = 'DEV_API_BASE_URL_OVERRIDE';

function normalize(base: string) {
  let u = base.trim().replace(/\/+$/, '');
  if (!/\/api$/.test(u)) u = `${u}/api`;
  return u;
}

function resolveBaseURL(): string {
  // 0) 로컬 오버라이드(테스트용)
  const ls = localStorage.getItem(OVERRIDE_KEY);
  if (ls && ls.trim()) {
    const over = normalize(ls);
    console.log('[api] localStorage override 사용:', over);
    return over;
  }

  // 1) 현재 호스트 자동 감지 (ENV 완전 무시)
  const host = window.location.hostname; // localhost | 192.168.x.x | 도메인
  const base = `http://${host}:2000/api`;
  console.log('[api] 자동감지 baseURL:', base, '| host=', host);
  return base;
}

export const api = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: true,
  timeout: 15000
});

// 로그(요청/응답)
api.interceptors.request.use(cfg => {
  console.log('[api][req]', {
    method: cfg.method,
    url: (cfg.baseURL || '') + (cfg.url || ''),
    params: cfg.params,
    data: cfg.data
  });
  return cfg;
});
api.interceptors.response.use(
  res => { console.log('[api][res:OK]', res.status, res.config?.url); return res; },
  err => {
    console.log('[api][res:ERR]', err.response?.status, err.config?.url, err.message, err.response?.data);
    return Promise.reject(err);
  }
);
