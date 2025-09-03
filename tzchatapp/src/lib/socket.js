// src/lib/socket.js
// ------------------------------------------------------
// ⚠️ 프론트엔드 전용 Socket.IO 클라이언트 모듈
// - 소켓 서버 오리진을 API baseURL에서 자동 유도(모든 모드 공통 동작)
// - 혼성콘텐츠 방지(HTTPS ↔ HTTP 혼용 금지)
// - withCredentials: 세션 쿠키 전달(서버 SameSite=None; Secure와 세트)
// - ✅ JWT 병행: 앱/웹뷰 쿠키 제약 시 handshake.auth.token 으로 전달
// - 웹소켓 우선(폴링 비활성) + 재연결/로그 최대화
// ------------------------------------------------------

import { io } from "socket.io-client";
import { getApiBaseURL } from "./api"; // api.ts에서 실제 적용된 baseURL(/api 포함)을 가져옴

let socket = null;

// api.ts와 동일 키를 사용해 로컬 저장 토큰 참고(앱 호환)
const TOKEN_KEY = "TZCHAT_AUTH_TOKEN";

/** JWT 토큰 로드(없으면 null) */
function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 소켓 서버 오리진 계산
 * - api baseURL 예: https://tzchat.duckdns.org/api  → https://tzchat.duckdns.org
 *                   http://localhost:2000/api       → http://localhost:2000
 * - dev:remote(로컬프론트→서버백), 앱(https), 웹배포(https), 로컬개발(http) 전부 커버
 */
function resolveSocketOrigin() {
  try {
    const apiURL = new URL(getApiBaseURL()); // 반드시 .../api 꼴
    const origin = `${apiURL.protocol}//${apiURL.host}`;
    console.log("🔧 [Socket] resolved origin from API base:", {
      apiBase: getApiBaseURL(),
      socketOrigin: origin,
    });
    return origin;
  } catch (e) {
    console.warn("⚠️ [Socket] getApiBaseURL() 파싱 실패, 현재 페이지 오리진 사용:", e?.message);
    return window.location.origin;
  }
}

/**
 * 소켓 연결
 * - 서버 CORS: path=/socket.io, credentials:true, origin 허용 필요(이미 main.js에서 설정)
 * - Nginx: /socket.io 업그레이드 설정 필요(이미 적용)
 * - 쿠키(세션) + JWT(auth.token) 병행 전달 → 서버가 JWT 지원 시 활용 가능
 */
export function connectSocket() {
  if (socket && socket.connected) return socket;

  const SOCKET_ORIGIN = resolveSocketOrigin();
  const token = getToken();

  console.log("🔌 [Socket] connecting...", {
    origin: SOCKET_ORIGIN,
    path: "/socket.io",
    transports: ["websocket"],
    withCredentials: true,
    hasToken: !!token,
  });

  socket = io(SOCKET_ORIGIN, {
    path: "/socket.io",
    transports: ["websocket"], // ✅ 폴링 비활성(프록시/네트워크가 허용하는 환경)
    withCredentials: true,     // ✅ 세션 쿠키 전송
    reconnection: true,
    reconnectionAttempts: 10,
    rememberUpgrade: true,
    timeout: 20000,
    // ✅ JWT 병행 전달(옵션) — 서버에서 socket.handshake.auth.token 으로 접근 가능
    auth: token ? { token } : undefined,
  });

  // ─ 로그 최대화
  socket.on("connect", () => {
    console.log("✅ [Socket] connected:", socket.id, "| origin:", SOCKET_ORIGIN);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ [Socket] connect_error:", err?.message, err);
  });

  socket.on("error", (err) => {
    console.error("❌ [Socket] error:", err?.message, err);
  });

  socket.on("disconnect", (reason) => {
    console.warn("⚠️ [Socket] disconnected:", reason);
  });

  return socket;
}

/** 현재 소켓 인스턴스 반환(없으면 null) */
export function getSocket() {
  return socket;
}

/** 명시적 종료가 필요할 때 사용(예: 로그아웃 시) */
export function disconnectSocket() {
  if (socket) {
    try {
      console.log("🔌 [Socket] disconnect requested");
      socket.disconnect();
    } catch (e) {
      console.warn("⚠️ [Socket] disconnect error:", e?.message);
    } finally {
      socket = null;
    }
  }
}

/** 로그인/로그아웃 후 토큰 갱신이 필요할 때 호출
 * - 연결 중이면 handshake.auth 갱신 후 재연결 시도
 * - 미연결이면 다음 connectSocket() 호출 시 반영
 */
export function refreshSocketAuth() {
  const token = getToken();
  if (!socket) return;
  try {
    socket.auth = token ? { token } : undefined;
    console.log("🔄 [Socket] auth refreshed", { hasToken: !!token });
    if (socket.connected) {
      // 서버에서 새로운 auth를 반영하려면 재연결 필요
      socket.disconnect();
      socket.connect();
    }
  } catch (e) {
    console.warn("⚠️ [Socket] refresh auth error:", e?.message);
  }
}
