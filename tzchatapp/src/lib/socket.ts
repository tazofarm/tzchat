// src/lib/socket.ts
// ------------------------------------------------------
// ⚠️ 프론트엔드 전용 Socket.IO 클라이언트 모듈 (TypeScript)
// - ENV 우선 + dev-remote 강제 가드(최후 안전장치)
// - 혼성콘텐츠 방지, 쿠키(withCredentials) + JWT(auth.token) 병행
// - 웹소켓 우선 + 재연결/로그 최대화
// ------------------------------------------------------

import { io } from "socket.io-client";
import type { Socket, ManagerOptions, SocketOptions } from "socket.io-client";
import { getApiBaseURL } from "./api";

// 싱글턴 소켓 인스턴스
let socket: Socket | null = null;

const TOKEN_KEY = "TZCHAT_AUTH_TOKEN";

// ENV (빌드타임 주입)
const RAW_MODE = (import.meta as any)?.env?.MODE as string | undefined;
const RAW_VITE_MODE = (import.meta as any)?.env?.VITE_MODE as string | undefined;
const MODE = (RAW_VITE_MODE && RAW_VITE_MODE.trim()) || RAW_MODE || 'development';

// ENV_WS_BASE: 소켓 오리진(프로토콜+호스트)
const ENV_WS_BASE =
  (import.meta as any)?.env?.VITE_WS_BASE ||
  (import.meta as any)?.env?.VITE_SOCKET_BASE ||
  "";

// dev-remote 강제 가드(ENV가 먹지 않아도 무조건 원격으로)
const DEV_REMOTE_DEFAULT_ORIGIN = "https://tzchat.duckdns.org";
const FORCE_DEV_REMOTE =
  (import.meta as any)?.env?.VITE_DEV_REMOTE === 'true' ||
  (import.meta as any)?.env?.VITE_REMOTE === '1';
const IS_DEV_REMOTE =
  FORCE_DEV_REMOTE || MODE === 'dev-remote' || RAW_VITE_MODE === 'dev-remote';

/** JWT 토큰 로드(없으면 null) */
function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 안전한 URL 파싱 (상대경로도 허용) */
function toAbsoluteURL(urlLike: string): URL {
  try {
    // 절대 URL이면 그대로
    return new URL(urlLike);
  } catch {
    // 상대경로면 현재 오리진을 기준으로
    return new URL(urlLike, window.location.origin);
  }
}

/** https 페이지면 대상 URL도 https로 강제 */
function enforceHttpsIfPageIsHttps(abs: URL): URL {
  try {
    if (typeof window !== "undefined" && window.location?.protocol === "https:" && abs.protocol !== "https:") {
      const forced = new URL(abs.href);
      forced.protocol = "https:";
      console.log("🛡️ [Socket] protocol forced to https due to page being https:", {
        before: abs.href,
        after: forced.href,
      });
      return forced;
    }
  } catch (e: any) {
    console.warn("⚠️ [Socket] enforceHttpsIfPageIsHttps error:", e?.message);
  }
  return abs;
}

/** 소켓 서버 오리진 계산(최우선순위 → ENV > dev-remote 강제 > API base > 현재 오리진) */
function resolveSocketOrigin(): string {
  // 0) dev-remote 강제 가드 (최후 안전장치)
  if (IS_DEV_REMOTE) {
    const abs = enforceHttpsIfPageIsHttps(toAbsoluteURL(DEV_REMOTE_DEFAULT_ORIGIN));
    const origin = `${abs.protocol}//${abs.host}`;
    console.warn("🟢 [Socket] dev-remote guard → forced origin:", origin, { MODE, RAW_MODE, RAW_VITE_MODE });
    return origin;
  }

  // 1) ENV 최우선
  if (ENV_WS_BASE && ENV_WS_BASE.trim()) {
    try {
      const abs = enforceHttpsIfPageIsHttps(toAbsoluteURL(ENV_WS_BASE.trim()));
      const origin = `${abs.protocol}//${abs.host}`;
      console.log("🔧 [Socket] resolved origin from ENV:", {
        envBase: ENV_WS_BASE,
        socketOrigin: origin,
      });
      return origin;
    } catch (e: any) {
      console.warn("⚠️ [Socket] ENV_WS_BASE 파싱 실패:", e?.message, ENV_WS_BASE);
    }
  }

  // 2) API BASE에서 유도
  try {
    const apiAbs = enforceHttpsIfPageIsHttps(toAbsoluteURL(getApiBaseURL()));
    const origin = `${apiAbs.protocol}//${apiAbs.host}`;
    console.log("🔧 [Socket] resolved origin from API base:", {
      apiBase: apiAbs.href,
      socketOrigin: origin,
    });
    return origin;
  } catch (e: any) {
    console.warn("⚠️ [Socket] getApiBaseURL() 파싱 실패, 현재 페이지 오리진 사용:", e?.message);
    const pageAbs = enforceHttpsIfPageIsHttps(new URL(window.location.origin));
    return `${pageAbs.protocol}//${pageAbs.host}`;
  }
}

/** 연결 옵션 생성 */
function buildOptions(): Partial<ManagerOptions & SocketOptions> {
  const token = getToken();
  const opts: Partial<ManagerOptions & SocketOptions> = {
    path: "/socket.io",
    transports: ["websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    rememberUpgrade: true,
    timeout: 20000,
    auth: token ? { token } : undefined,
  };
  console.log("🔌 [Socket] options:", {
    path: opts.path,
    transports: opts.transports,
    withCredentials: opts.withCredentials,
    reconnectionAttempts: opts.reconnectionAttempts,
    timeout: opts.timeout,
    hasToken: !!token,
  });
  return opts;
}

/** 소켓 연결 */
export function connectSocket(): Socket {
  if (socket && socket.connected) return socket;

  const SOCKET_ORIGIN = resolveSocketOrigin();
  const options = buildOptions();

  console.log("🔌 [Socket] connecting...", {
    origin: SOCKET_ORIGIN,
    path: options.path,
    pageProtocol: typeof window !== "undefined" ? window.location.protocol : "n/a",
  });

  try {
    const abs = new URL(SOCKET_ORIGIN);
    if (typeof window !== "undefined" && window.location.protocol === "https:" && abs.protocol !== "https:") {
      abs.protocol = "https:";
      console.log("🛡️ [Socket] origin protocol auto-corrected to https:", abs.href);
      socket = io(`${abs.protocol}//${abs.host}`, options);
    } else {
      socket = io(SOCKET_ORIGIN, options);
    }
  } catch (e: any) {
    console.error("❌ [Socket] invalid SOCKET_ORIGIN:", SOCKET_ORIGIN, e?.message);
    // 마지막 안전장치: 현재 페이지 오리진으로 시도
    socket = io(window.location.origin, options);
  }

  // 로그
  socket.on("connect", () => {
    console.log("✅ [Socket] connected:", socket?.id, "| origin:", SOCKET_ORIGIN);
  });

  socket.on("connect_error", (err: any) => {
    console.error("❌ [Socket] connect_error:", err?.message, err);
  });

  socket.on("error", (err: any) => {
    console.error("❌ [Socket] error:", err?.message, err);
  });

  socket.on("disconnect", (reason: string) => {
    console.warn("⚠️ [Socket] disconnected:", reason);
  });

  return socket;
}

/** 현재 소켓 인스턴스 반환(없으면 null) */
export function getSocket(): Socket | null {
  return socket;
}

/** 명시적 종료(예: 로그아웃 시) */
export function disconnectSocket(): void {
  if (socket) {
    try {
      console.log("🔌 [Socket] disconnect requested");
      socket.disconnect();
    } catch (e: any) {
      console.warn("⚠️ [Socket] disconnect error:", e?.message);
    } finally {
      socket = null;
    }
  }
}

/** 로그인/로그아웃 후 토큰 갱신 */
export function refreshSocketAuth(): void {
  const token = getToken();
  if (!socket) return;
  try {
    (socket as any).auth = token ? { token } : undefined;
    console.log("🔄 [Socket] auth refreshed", { hasToken: !!token });
    if (socket.connected) {
      socket.disconnect();
      socket.connect();
    }
  } catch (e: any) {
    console.warn("⚠️ [Socket] refresh auth error:", e?.message);
  }
}
