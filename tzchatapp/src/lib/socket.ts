// src/lib/socket.ts
import { io } from 'socket.io-client'
import type { Socket, ManagerOptions, SocketOptions } from 'socket.io-client'

let socket: Socket | null = null
let listenersBound = false
let currentOrigin: string | null = null // ✅ 우리가 추적하는 현재 origin

const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'
const REMOTE_DEFAULT_ORIGIN = 'https://tzchat.duckdns.org'

const RAW_MODE = (import.meta as any)?.env?.MODE as string | undefined
const RAW_VITE_MODE = (import.meta as any)?.env?.VITE_MODE as string | undefined
const MODE = (RAW_VITE_MODE && RAW_VITE_MODE.trim()) || RAW_MODE || 'development'

const ENV_WS_BASE: string =
  (import.meta as any)?.env?.VITE_WS_BASE ||
  (import.meta as any)?.env?.VITE_SOCKET_BASE ||
  ''

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
function toAbsoluteURL(urlLike: string): URL {
  try { return new URL(urlLike) } catch { return new URL(urlLike, window.location.origin) }
}
function originOf(u: URL): string { return `${u.protocol}//${u.host}` }
function enforceHttpsIfPageIsHttps(abs: URL): URL {
  try {
    if (window.location.protocol === 'https:' && abs.protocol !== 'https:') {
      const f = new URL(abs.href); f.protocol = 'https:'
      console.log('🛡️ [Socket] protocol forced to https:', { before: abs.href, after: f.href })
      return f
    }
  } catch {}
  return abs
}

/** ENV → 페이지 → 로컬, + dev-remote/8081 가드 */
function resolveSocketOrigin(): string {
  const on8081 =
    typeof window !== 'undefined' &&
    /^http:\/\/localhost:8081$/i.test(window.location.origin)

  if (on8081 && (MODE === 'dev-remote') && (!ENV_WS_BASE || /localhost|127\.0\.0\.1|:8081/i.test(ENV_WS_BASE))) {
    console.error('🔧 [Socket] 8081에서 dev-remote 의도 감지 → 원격 기본 강제', { ENV_WS_BASE, forced: REMOTE_DEFAULT_ORIGIN })
    return REMOTE_DEFAULT_ORIGIN
  }

  if (ENV_WS_BASE && ENV_WS_BASE.trim()) {
    const abs = enforceHttpsIfPageIsHttps(toAbsoluteURL(ENV_WS_BASE.trim()))
    const origin = originOf(abs)
    console.log('🔧 [Socket] origin from ENV:', { ENV_WS_BASE, origin, MODE })
    return origin
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const abs = enforceHttpsIfPageIsHttps(new URL(window.location.origin))
    const origin = originOf(abs)
    console.log('🔧 [Socket] origin from page:', origin, { MODE })
    return origin
  }

  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
  const origin = `http://${host}:2000`
  console.log('🔧 [Socket] origin fallback local:', origin)
  return origin
}

function buildOptions(): Partial<ManagerOptions & SocketOptions> {
  const token = getToken()
  const opts: Partial<ManagerOptions & SocketOptions> = {
    path: '/socket.io',
    transports: ['websocket', 'polling'], // ✅ 폴백 허용
    upgrade: true,
    rememberUpgrade: true,

    withCredentials: true,

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 600,
    reconnectionDelayMax: 6000,
    randomizationFactor: 0.5,

    timeout: 30000,

    auth: token ? { token } : undefined,
  }
  console.log('🔌 [Socket] options:', {
    path: opts.path,
    transports: opts.transports,
    withCredentials: opts.withCredentials,
    reconnectionAttempts: opts.reconnectionAttempts,
    reconnectionDelay: opts.reconnectionDelay,
    reconnectionDelayMax: opts.reconnectionDelayMax,
    timeout: opts.timeout,
    hasToken: !!token,
  })
  return opts
}

/** 이벤트 리스너(한 번만 바인딩) */
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
  // 목표 origin 계산
  let SOCKET_ORIGIN = resolveSocketOrigin()

  // https 페이지에서 localhost:2000 방지
  if (typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      /^https?:\/\/localhost:2000$/i.test(SOCKET_ORIGIN)) {
    console.warn('🚫 [Socket] https 페이지에서 localhost:2000 감지 → remote로 교정')
    SOCKET_ORIGIN = originOf(enforceHttpsIfPageIsHttps(toAbsoluteURL(REMOTE_DEFAULT_ORIGIN)))
  }

  const abs = toAbsoluteURL(SOCKET_ORIGIN)
  const corrected = enforceHttpsIfPageIsHttps(abs)
  const targetOrigin = originOf(corrected)

  const options = buildOptions()

  // ✅ 이미 소켓이 있고, 같은 origin이면 재사용 (+ auth 갱신 후 필요 시 connect)
  if (socket && currentOrigin === targetOrigin) {
    const token = getToken()
    ;(socket as any).auth = token ? { token } : undefined
    if (!socket.connected) {
      console.log('🔌 [Socket] reconnecting existing socket to same origin...')
      socket.connect()
    }
    bindCoreListeners(socket, targetOrigin)
    return socket
  }

  // ✅ origin이 다르거나 소켓이 없으면, 안전하게 새로 생성
  if (socket) {
    try {
      socket.off()
      socket.disconnect()
    } catch {}
    socket = null
    listenersBound = false
  }

  console.log('🔌 [Socket] connecting new instance...', {
    origin: targetOrigin,
    path: options.path,
    pageProtocol: typeof window !== 'undefined' ? window.location.protocol : '(no-window)',
  })

  socket = io(targetOrigin, options)
  currentOrigin = targetOrigin
  bindCoreListeners(socket, targetOrigin)

  return socket!
}

export function getSocket(): Socket | null { return socket }

export function disconnectSocket(): void {
  if (socket) {
    try {
      console.log('🔌 [Socket] disconnect requested')
      socket.off()
      socket.disconnect()
    } catch (e: any) {
      console.warn('⚠️ [Socket] disconnect error:', e?.message)
    } finally {
      socket = null
      currentOrigin = null
      listenersBound = false
    }
  }
}

export function refreshSocketAuth(): void {
  const token = getToken()
  if (!socket) return
  try {
    ;(socket as any).auth = token ? { token } : undefined
    console.log('🔄 [Socket] auth refreshed', { hasToken: !!token })
    if (socket.connected) {
      socket.disconnect()
      socket.connect()
    }
  } catch (e: any) {
    console.warn('⚠️ [Socket] refresh auth error:', e?.message)
  }
}
