import { io } from 'socket.io-client'
import type { Socket, ManagerOptions, SocketOptions } from 'socket.io-client'

/**
 * 환경변수 주입 (Vite)
 * - VITE_WS_BASE / VITE_SOCKET_BASE : 소켓 서버 오리진 (http/https/ws/wss)
 * - VITE_SOCKET_PATH                : 소켓 경로 (기본 /socket.io)
 * - VITE_MODE / MODE                : 현재 빌드/실행 모드
 */
const {
  MODE: VITE_BUILD_MODE,
  VITE_MODE,
  VITE_WS_BASE,
  VITE_SOCKET_BASE,
  VITE_SOCKET_PATH,
} = import.meta.env as any

const MODE = String(VITE_MODE || VITE_BUILD_MODE || '')
const WS_BASE = String(VITE_WS_BASE || VITE_SOCKET_BASE || '').trim()
const SOCKET_PATH = String(VITE_SOCKET_PATH || '/socket.io').trim()

let socket: Socket | null = null
let listenersBound = false
let currentOrigin: string | null = null

const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'

/** util */
function isSocketOrigin(u: string): boolean { return /^(https?:|wss?:)\/\//i.test(u || '') }
function originOf(u: URL): string { return `${u.protocol}//${u.host}` }

/** 환경 검사: 오리진 필수 */
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
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    withCredentials: true,

    // 재연결 정책
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
    timeout: 30000,

    // 연결 제어: 앱 엔트리에서 connectSocket()로만 연결되도록
    autoConnect: false,

    // 인증 토큰 전달 (socket.handshake.auth)
    auth: token ? { token } : undefined,
  }
  console.log('[Socket][CFG]', { MODE, TARGET_ORIGIN, SOCKET_PATH, hasToken: !!token })
  return opts
}

function bindCoreListeners(sock: Socket, originStr: string) {
  if (listenersBound) return
  listenersBound = true

  sock.on('connect', () => {
    // @ts-ignore
    const tr = sock.io?.engine?.transport?.name
    console.log('✅ [Socket] connected:', sock.id, '| origin:', originStr, '| transport:', tr)
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
    // @ts-ignore
    const tr = sock.io?.engine?.transport?.name
    console.log('🔁 [Socket] reconnected:', n, '| transport:', tr)
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

/** 앱 전역에서 1회 호출 권장: 실제 연결 수행 */
export function connectSocket(): Socket {
  const options = buildOptions()

  // 동일 오리진 + 기존 소켓 있으면 재사용
  if (socket && currentOrigin === TARGET_ORIGIN) {
    const token = getToken()
    ;(socket as any).auth = token ? { token } : undefined

    if (!socket.connected) {
      console.log('[Socket] connecting existing socket...')
      socket.connect()
    }
    bindCoreListeners(socket, TARGET_ORIGIN)
    return socket
  }

  // 오리진 변경 또는 최초 연결: 기존 소켓 clean-up
  if (socket) {
    try { socket.off() } catch {}
    try { socket.disconnect() } catch {}
    socket = null
    listenersBound = false
  }

  console.log('[Socket] create & connect...', { origin: TARGET_ORIGIN, path: options.path })
  socket = io(TARGET_ORIGIN, options)
  currentOrigin = TARGET_ORIGIN

  bindCoreListeners(socket, TARGET_ORIGIN)
  socket.connect() // autoConnect:false 이므로 명시적으로 연결
  return socket!
}

/** 현재 소켓 얻기 (없을 수 있음) */
export function getSocket(): Socket | null { return socket }

/** 의도적 완전 종료 (로그아웃 등) */
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
 * 재연결/재설정
 * - origin 변경이 없다면 연결 끊지 않음
 * - 서버가 지원하면 'auth:refresh'로 토큰 갱신 알림
 */
export function reconnectSocket(newOrigin?: string): Socket {
  const nextOrigin = (newOrigin && isSocketOrigin(newOrigin))
    ? originOf(new URL(newOrigin))
    : TARGET_ORIGIN

  if (socket && currentOrigin === nextOrigin) {
    try {
      const token = getToken()
      ;(socket as any).auth = token ? { token } : undefined
      if (socket.connected) {
        socket.emit?.('auth:refresh', { token })
        console.log('[Socket] token refreshed (same origin, no disconnect)', { hasToken: !!token })
      } else {
        console.log('[Socket] connect (same origin, was disconnected)')
        socket.connect()
      }
    } catch (e: any) {
      console.warn('[Socket] reconnect (same origin) error:', e?.message)
    }
    return socket!
  }

  // 오리진이 바뀌는 경우에만 재생성
  disconnectSocket()
  const options = buildOptions()
  console.log('[Socket] reconnect with new origin...', { from: currentOrigin, to: nextOrigin, path: options.path })
  socket = io(nextOrigin, options)
  currentOrigin = nextOrigin
  bindCoreListeners(socket, nextOrigin)
  socket.connect()
  return socket!
}

/** 동일 오리진에서 토큰만 갱신 (연결 유지) */
export function refreshSocketAuth(): void {
  if (!socket) return
  const token = getToken()
  try {
    ;(socket as any).auth = token ? { token } : undefined
    console.log('[Socket] auth refreshed (no reconnect)', { hasToken: !!token })
    if (socket.connected) {
      socket.emit?.('auth:refresh', { token })
    }
  } catch (e: any) {
    console.warn('[Socket] refresh auth error:', e?.message)
  }
}
