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

function isHttpLike(u: string): boolean { return /^https?:\/\//i.test(u || '') }
function originOf(u: URL): string { return `${u.protocol}//${u.host}` }

// .env가 있으면 엄격 검사 통과, 없거나 형식이 틀리면 명확히 실패
;(function assertEnv() {
  if (!WS_BASE) {
    throw new Error(
      `[CFG][socket] VITE_WS_BASE(VITE_SOCKET_BASE)가 비었습니다. 실행 모드: "${MODE}". `
      + `.env.${MODE}에 http(s) 오리진을 설정하세요. 예: http://localhost:2000`
    )
  }
  if (!isHttpLike(WS_BASE)) {
    throw new Error(`[CFG][socket] VITE_WS_BASE가 http(s) 오리진이 아닙니다: "${WS_BASE}"`)
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

export function connectSocket(): Socket {
  const options = buildOptions()

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

  if (socket) {
    try { socket.off(); socket.disconnect() } catch {}
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

export function disconnectSocket(): void {
  if (socket) {
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
}

/**
 * 새 토큰 반영을 위한 재연결 유틸
 * - origin 변경이 필요 없으면 파라미터 없이 호출
 * - 다른 오리진으로 바꾸고 싶다면 newOrigin(http/https) 전달
 */
export function reconnectSocket(newOrigin?: string): Socket {
  const nextOrigin = (newOrigin && isHttpLike(newOrigin))
    ? originOf(new URL(newOrigin))
    : TARGET_ORIGIN

  if (socket && currentOrigin === nextOrigin) {
    try {
      const token = getToken()
      ;(socket as any).auth = token ? { token } : undefined
    } catch {}
    try { socket.disconnect() } catch {}
    try { socket.connect() } catch {}
    return socket
  }

  disconnectSocket()
  const options = buildOptions()
  console.log('[Socket] reconnecting...', { from: currentOrigin, to: nextOrigin, path: options.path })
  socket = io(nextOrigin, options)
  currentOrigin = nextOrigin
  bindCoreListeners(socket, nextOrigin)
  return socket!
}

export function refreshSocketAuth(): void {
  const token = getToken()
  if (!socket) return
  try {
    ;(socket as any).auth = token ? { token } : undefined
    console.log('[Socket] auth refreshed', { hasToken: !!token })
    if (socket.connected) { socket.disconnect(); socket.connect() }
  } catch (e: any) {
    console.warn('[Socket] refresh auth error:', e?.message)
  }
}
