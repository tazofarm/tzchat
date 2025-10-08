// src/lib/socket.ts
import { io } from 'socket.io-client'
import type { Socket, ManagerOptions, SocketOptions } from 'socket.io-client'

// ✅ Vite는 "직접 접근"에만 .env를 주입합니다.
const {
  MODE: VITE_BUILD_MODE,         // Vite가 넣어주는 모드
  VITE_MODE,                     // 우리가 추가로 쓰는 모드 키(있으면 사용)
  VITE_WS_BASE,
  VITE_SOCKET_BASE,
} = import.meta.env as any

// 모드 문자열
const MODE = String(VITE_MODE || VITE_BUILD_MODE || '')

// .env에서 직접 읽기 (정적 접근)
const WS_BASE = String(VITE_WS_BASE || VITE_SOCKET_BASE || '').trim()

let socket: Socket | null = null
let listenersBound = false
let currentOrigin: string | null = null

const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'

// http(s)와 ws(s) 모두 허용 (운영은 wss:// 권장)
function isSocketOrigin(u: string): boolean { return /^(https?:|wss?:)\/\//i.test(u || '') }
function originOf(u: URL): string { return `${u.protocol}//${u.host}` }

// .env가 있으면 엄격 검사 통과, 없거나 형식이 틀리면 명확히 실패
;(function assertEnv() {
  if (!WS_BASE) {
    throw new Error(
      `[CFG][socket] VITE_WS_BASE(VITE_SOCKET_BASE)가 비었습니다. 실행 모드: "${MODE}". `
      + `.env.${MODE}에 ws(s) 또는 http(s) 오리진을 설정하세요. `
      + `예: dev → http://localhost:2000, prod → wss://tzchat.tazocode.com`
    )
  }
  if (!isSocketOrigin(WS_BASE)) {
    throw new Error(`[CFG][socket] VITE_WS_BASE가 유효한 오리진이 아닙니다: "${WS_BASE}" (허용: http(s) 또는 ws(s))`)
  }
})()

const TARGET_ORIGIN = originOf(new URL(WS_BASE))

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function buildOptions(): Partial<ManagerOptions & SocketOptions> {
  const token = getToken()
  const opts: Partial<ManagerOptions & SocketOptions> = {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
    timeout: 30000,
    // autoConnect 기본 true (명시 안 함). 필요 시 앱 엔트리에서 connectSocket() 1회 호출.
    auth: token ? { token } : undefined,
  }
  console.log('[Socket][CFG]', { MODE, TARGET_ORIGIN, hasToken: !!token, path: opts.path })
  return opts
}

function bindCoreListeners(sock: Socket, originStr: string) {
  if (listenersBound) return
  listenersBound = true

  sock.on('connect', () => {
    console.log('✅ [Socket] connected:', sock.id, '| origin:', originStr, '| transport:', sock.io.engine.transport.name)
  })
  sock.on('connect_error', (err: any) => {
    console.error('❌ [Socket] connect_error:', err?.message || err)
  })
  sock.on('error', (err: any) => {
    console.error('❌ [Socket] error:', err?.message || err)
  })
  sock.io.on('reconnect_attempt', (attempt) => {
    console.log('↻ [Socket] reconnect_attempt:', attempt)
  })
  sock.io.on('reconnect', (n) => {
    console.log('🔁 [Socket] reconnected:', n, '| transport:', sock.io.engine.transport.name)
  })
  sock.io.on('reconnect_error', (err) => {
    console.warn('⚠️ [Socket] reconnect_error:', (err as any)?.message || err)
  })
  sock.io.on('reconnect_failed', () => {
    console.warn('⛔ [Socket] reconnect_failed (no more attempts)')
  })
  sock.on('disconnect', (reason: string) => {
    console.warn('⚠️ [Socket] disconnected:', reason)
  })
}

/** 앱 전역에서 1회 호출 권장 */
export function connectSocket(): Socket {
  const options = buildOptions()

  // 동일 오리진 + 기존 소켓 있으면 그대로 재사용
  if (socket && currentOrigin === TARGET_ORIGIN) {
    const token = getToken()
    ;(socket as any).auth = token ? { token } : undefined
    if (!socket.connected) {
      console.log('[Socket] reconnecting existing socket...')
      socket.connect()
    }
    bindCoreListeners(socket, TARGET_ORIGIN)
    return socket
  }

  // 오리진 변경 시에만 clean shutdown
  if (socket) {
    try { socket.off() } catch {}
    try { socket.disconnect() } catch {}
    socket = null
    listenersBound = false
  }

  console.log('[Socket] connecting...', { origin: TARGET_ORIGIN, path: options.path })
  socket = io(TARGET_ORIGIN, options)
  currentOrigin = TARGET_ORIGIN
  bindCoreListeners(socket, TARGET_ORIGIN)
  return socket!
}

export function getSocket(): Socket | null { return socket }

/** 의도적으로 완전 종료할 때만 사용 (로그아웃 등) */
export function disconnectSocket(): void {
  if (!socket) return
  try {
    console.log('[Socket] disconnect requested')
    socket.off()
    socket.disconnect()
  } catch (e: any) {
    console.warn('[Socket] disconnect error:', e?.message)
  } finally {
    socket = null
    currentOrigin = null
    listenersBound = false
  }
}

/**
 * 새 토큰 반영을 위한 재연결/재설정
 * - origin 변경이 없다면 끊지 않습니다.
 * - 서버가 지원한다면 'auth:refresh' 커스텀 이벤트로 전달(선택적).
 */
export function reconnectSocket(newOrigin?: string): Socket {
  const nextOrigin = (newOrigin && isSocketOrigin(newOrigin))
    ? originOf(new URL(newOrigin))
    : TARGET_ORIGIN

  // ✅ 동일 오리진이면 끊지 않고 토큰만 갱신/필요 시 connect
  if (socket && currentOrigin === nextOrigin) {
    try {
      const token = getToken()
      ;(socket as any).auth = token ? { token } : undefined
      if (socket.connected) {
        // 서버 미들웨어가 토큰 재인증을 지원한다면 이 이벤트를 수신해서 처리
        socket.emit?.('auth:refresh', { token })
        console.log('[Socket] token refreshed without disconnect', { hasToken: !!token })
      } else {
        socket.connect()
        console.log('[Socket] connect (same origin, was disconnected)')
      }
    } catch (e: any) {
      console.warn('[Socket] reconnect (same origin) error:', e?.message)
    }
    return socket!
  }

  // 🔄 오리진이 바뀌는 경우에만 재생성
  disconnectSocket()
  const options = buildOptions()
  console.log('[Socket] reconnecting with new origin...', { from: currentOrigin, to: nextOrigin, path: options.path })
  socket = io(nextOrigin, options)
  currentOrigin = nextOrigin
  bindCoreListeners(socket, nextOrigin)
  return socket!
}

/**
 * 토큰만 갱신 (동일 오리진에서 끊지 않음)
 */
export function refreshSocketAuth(): void {
  if (!socket) return
  const token = getToken()
  try {
    ;(socket as any).auth = token ? { token } : undefined
    console.log('[Socket] auth refreshed (no reconnect)', { hasToken: !!token })
    // 서버가 토큰 재인증 이벤트를 지원한다면 사용
    if (socket.connected) {
      socket.emit?.('auth:refresh', { token })
    }
  } catch (e: any) {
    console.warn('[Socket] refresh auth error:', e?.message)
  }
}
