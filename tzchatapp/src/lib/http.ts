// front/src/lib/http.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://tzchat.duckdns.org', // ⭐ 도메인 고정 (IP/포트 금지)
  withCredentials: true,                 // ⭐ 쿠키 전송 필수
  headers: { 'Content-Type': 'application/json' }
});
