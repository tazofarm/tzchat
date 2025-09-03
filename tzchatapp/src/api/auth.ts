// front/src/api/auth.ts
// ------------------------------------------------------
// 인증 API (JWT + 쿠키 하이브리드 대응)
// - 로그인 성공 시 token 있으면 setAuthToken()으로 저장(웹/앱 공용)
// - /me는 쿠키 또는 Bearer(인터셉터)로 인증
// - 로그아웃 시 서버 쿠키 정리 + 클라이언트 토큰 제거
// ------------------------------------------------------
import { api, setAuthToken, clearAuthToken } from '@/lib/http';

function mask(t?: string | null) {
  if (!t) return null;
  return t.length <= 12 ? t[0] + '***' : t.slice(0, 4) + '***' + t.slice(-4);
}

export async function login(username: string, password: string) {
  console.log('[AUTH][REQ] login', { username, len: (password || '').length });
  const r = await api.post('/api/login', { username, password });
  const data = r.data || {};
  if (data?.token) {
    // 로컬스토리지에 지속 저장(persist=true) — 앱/웹 자동 인증
    setAuthToken(data.token, true);
    console.log('[AUTH][RES] login ok (token)', { mask: mask(data.token), nickname: data.nickname });
  } else {
    console.log('[AUTH][RES] login ok (cookie-only)', { nickname: data.nickname });
  }
  return data;
}

export async function me() {
  console.log('[AUTH][REQ] me');
  const r = await api.get('/api/me'); // 쿠키 또는 Bearer로 인증
  console.log('[AUTH][RES] me', { ok: r?.data?.ok === true });
  return r.data;
}

export async function logout() {
  console.log('[AUTH][REQ] logout');
  const r = await api.post('/api/logout');
  // 서버 쿠키는 clearCookie, 클라이언트 저장 토큰도 정리
  clearAuthToken();
  console.log('[AUTH][RES] logout', { ok: r?.data?.ok === true });
  return r.data;
}
