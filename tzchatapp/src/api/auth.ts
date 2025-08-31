// front/src/api/auth.ts
import { api } from '@/lib/http';

export async function login(username: string, password: string) {
  // ⭐ 로그인 직후 Set-Cookie 내려오는지 네트워크 탭/로그로 꼭 확인
  const r = await api.post('/api/login', { username, password });
  return r.data;
}

export async function me() {
  const r = await api.get('/api/me');   // 세션 쿠키 포함되어야 200
  return r.data;
}
