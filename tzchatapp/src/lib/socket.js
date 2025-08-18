// src/lib/socket.js
// ⚠️ 프론트엔드 전용! Socket.IO 클라이언트 공용 모듈
// 글자는 기본 검정(전역 스타일 기준)이며, 주석/로그를 풍부하게 넣었습니다.

import { io } from "socket.io-client";

let socket = null;

/**
 * 소켓 연결 (HTTPS 오리진 고정)
 * - 절대 URL 금지: 현재 페이지 오리진 사용 → 혼성콘텐츠 차단 방지
 * - 웹소켓 우선(transports)
 * - withCredentials: 세션 쿠키 전달
 */
export function connectSocket() {
  if (socket && socket.connected) return socket;

  console.log("🔌 [Socket] connecting... (origin relative)");

  socket = io("/", {
    path: "/socket.io",
    transports: ["websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
  });

  // ─ 로그 최대화
  socket.on("connect", () => {
    console.log("✅ [Socket] connected:", socket.id);
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

export function getSocket() {
  return socket;
}
