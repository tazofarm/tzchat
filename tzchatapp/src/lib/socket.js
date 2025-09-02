// src/lib/socket.js
import { io } from "socket.io-client";
import { getApiBaseURL } from "./api"; // 실제 /api baseURL 반환

let socket = null;

// 보안 컨텍스트(https/앱) 판별
function isSecureEnv() {
  try {
    if (typeof window !== "undefined") {
      if (window.isSecureContext) return true;
      if (location?.protocol === "https:") return true;
      if (location?.protocol?.startsWith("capacitor") || location?.protocol?.startsWith("ionic")) return true;
    }
  } catch (_) {}
  return false;
}

function resolveSocketOrigin() {
  // 1) 환경변수 우선 (모드별 확정값을 주고 싶을 때)
  const envUrl = import.meta?.env?.VITE_SOCKET_URL && String(import.meta.env.VITE_SOCKET_URL);
  if (envUrl) return envUrl.replace(/\/$/, ""); // 끝슬래시 제거

  // 2) API base에서 오리진만 추출
  try {
    const apiBase = getApiBaseURL(); // 예: https://tzchat.duckdns.org/api
    const apiURL = new URL(apiBase);
    let protocol = apiURL.protocol;  // http: | https:
    const host = apiURL.host;        // domain:port

    // tzchat 정식 도메인은 항상 https (wss)
    if (host === "tzchat.duckdns.org") protocol = "https:";

    // 안전 컨텍스트에서 http 대상이면 https로 승격
    if (isSecureEnv() && protocol === "http:") protocol = "https:";

    return `${protocol}//${host}`;
  } catch {
    // 3) 실패 시 현재 페이지 오리진 (로컬 개발 등)
    return typeof window !== "undefined" ? window.location.origin : "https://tzchat.duckdns.org";
  }
}

export function connectSocket() {
  if (socket && socket.connected) return socket;

  const SOCKET_ORIGIN = resolveSocketOrigin();

  console.log("🔌 [Socket] connecting...", {
    origin: SOCKET_ORIGIN,
    path: "/socket.io",
    transports: ["websocket"],
    withCredentials: true,
    mode: import.meta?.env?.MODE,
  });

  socket = io(SOCKET_ORIGIN, {
    path: "/socket.io",
    transports: ["websocket"], // 폴링 비활성
    withCredentials: true,     // 세션 쿠키 전송
    reconnection: true,
    reconnectionAttempts: 10,
    timeout: 20000,
    upgrade: false,            // websocket 직행
  });

  socket.on("connect", () => console.log("✅ [Socket] connected:", socket.id));
  socket.on("connect_error", (err) => console.error("❌ [Socket] connect_error:", err?.message || err, err));
  socket.on("disconnect", (reason) => console.warn("⚠️ [Socket] disconnected:", reason));

  return socket;
}

export function getSocket() { return socket; }
export function disconnectSocket() {
  if (!socket) return;
  try {
    console.log("🔌 [Socket] disconnect requested");
    socket.disconnect();
  } finally {
    socket = null;
  }
}
