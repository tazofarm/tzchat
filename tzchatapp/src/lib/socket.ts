// src/lib/socket.ts
import { io } from 'socket.io-client'
import type { Socket, ManagerOptions, SocketOptions } from 'socket.io-client'

/**
 * ✅ 목표
 * - 앱(WebView/Capacitor)에서도 항상 "원격 HTTPS"로 소켓 연결
 * - 백엔드가 세션 쿠키 인증일 때를 고려하여 withCredentials:true (polling에도 쿠키 동반)
 * - JWT를 병행 지원(auth: { token }) → 서버가 JWT 전환 시 바로 연동 가능
 * - 잘못된 대상(origin 혼선, http→https 불일치) 원천 차단 및 상세 로그
 */

let socket: Socket | null = null
let listenersBound = false
let currentOrigin: string | null = null // 현재 연결 대상(origin) 추적

const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'

// 🔒 원격 기본 대상(프로덕션 도메인)
const REMOTE_DEFAULT_ORIGIN = 'https://tzchat.tazocode.com'

// === 모드/env ===
const RAW_MODE = (import.meta as any)?.env?.MODE as string | undefined
const RAW_VITE_MODE = (import.meta as any)?.env?.VITE_MODE as string | undefined
const MODE = (RAW_VITE_MODE && RAW_VITE_MODE.trim()) || RAW_MODE || 'development'

// .env에서 소켓 대상 읽기(선택)
const ENV_WS_BASE: string =
  (import.meta as any)?.env?.VITE_WS_BASE ||
  (import.meta as any)?.env?.VITE_SOCKET_BASE ||
  ''

// === 유틸 ===
function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
function toAbsoluteURL(urlLike: string): URL {
  try { return new URL(urlLike) }
  catch {
    const fallback = (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:2000')
    return new URL(urlLike, fallback)
  }
}
function originOf(u: URL): string { return `${u.protocol}//${u.host}` }
function isHttpLike(u: string): boolean { return /^https?:\/\//i.test(u) }
function isLocalLike(u: string): boolean {
  const s = String(u || '')
  return /(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d{2,5})?/i.test(s)
}
function isCapacitorOrigin(): boolean {
  try { return typeof window !== 'undefined' && /^capacitor:\/\//i.test(window.location.origin) } catch { return false }
}
function enforceHttpsIfPageIsHttps(abs: URL): URL {
  try {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && abs.protocol !== 'https:') {
      const f = new URL(abs.href); f.protocol = 'https:'
      console.log('🛡️ [Socket] protocol forced to https:', { before: abs.href, after: f.href })
      return f
    }
  } catch {}
  return abs
}

/**
 * ENV → 페이지 → 폴백
 * + dev-remote/8081 가드
 * + 비HTTP(예: capacitor://) 또는 **로컬 오리진( localhost/127 )은 원격으로 강제**
 */
function resolveSocketOrigin(): string {
  // 0) Capacitor(webview) 오리진이면 무조건 원격 HTTPS 강제
  if (isCapacitorOrigin()) {
    console.warn('🔧 [Socket] capacitor origin 감지 → 원격 기본 강제:', REMOTE_DEFAULT_ORIGIN)
    return REMOTE_DEFAULT_ORIGIN
  }

  // 1) dev-remote 보호(브라우저 8081에서 로컬 ENV를 썼을 때)
  const on8081 =
    typeof window !== 'undefined' &&
    /^http:\/\/localhost:8081$/i.test(window.location.origin)
  if (on8081 && (MODE === 'dev-remote') && (!ENV_WS_BASE || isLocalLike(ENV_WS_BASE))) {
    console.error('🔧 [Socket] 8081/dev-remote → 원격 기본 강제', { ENV_WS_BASE, forced: REMOTE_DEFAULT_ORIGIN })
    return REMOTE_DEFAULT_ORIGIN
  }

  // 2) ENV가 있으면: HTTP(S)만 허용, http→https 필요 시 자동 승격
  if (ENV_WS_BASE && ENV_WS_BASE.trim()) {
    if (!isHttpLike(ENV_WS_BASE)) {
      console.error('🚫 [Socket] ENV_WS_BASE가 비-HTTP 스킴입니다. 원격 기본으로 교정', { ENV_WS_BASE, forced: REMOTE_DEFAULT_ORIGIN })
      return REMOTE_DEFAULT_ORIGIN
    }
    const abs = enforceHttpsIfPageIsHttps(toAbsoluteURL(ENV_WS_BASE.trim()))
    const origin = originOf(abs)
    console.log('🔧 [Socket] origin from ENV:', { ENV_WS_BASE, origin, MODE })
    return origin
  }

  // 3) 페이지 오리진 사용: 비HTTP이거나 로컬이면 원격으로 강제  ← ★추가 가드
  if (typeof window !== 'undefined' && window.location?.origin) {
    const pageOrigin = window.location.origin
    // 비HTTP(예: capacitor://) → 원격 강제
    if (!isHttpLike(pageOrigin)) {
      console.warn('🚫 [Socket] page origin 비-HTTP → 원격 기본 강제', { pageOrigin, forced: REMOTE_DEFAULT_ORIGIN })
      return REMOTE_DEFAULT_ORIGIN
    }
    // 로컬 오리진(https://localhost, http://127.0.0.1 등) → 원격 강제
    if (isLocalLike(pageOrigin)) {
      console.warn('🚫 [Socket] page origin이 로컬입니다 → 원격 기본 강제', { pageOrigin, forced: REMOTE_DEFAULT_ORIGIN })
      return REMOTE_DEFAULT_ORIGIN
    }
    const abs = enforceHttpsIfPageIsHttps(new URL(pageOrigin))
    const origin = originOf(abs)
    console.log('🔧 [Socket] origin from page:', origin, { MODE })
    return origin
  }

  // 4) 마지막 폴백(노드 등)
  const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
  const origin = `http://${host}:2000`
  console.log('🔧 [Socket] origin fallback local:', origin)
  return origin
}

function buildOptions(): Partial<ManagerOptions & SocketOptions> {
  const token = getToken()
  const opts: Partial<ManagerOptions & SocketOptions> = {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    withCredentials: true, // 세션 쿠키 동반
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
    timeout: 30000,
    auth: token ? { token } : undefined, // JWT 병행
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
  // 1) 대상 origin 계산
  let SOCKET_ORIGIN = resolveSocketOrigin()

  // 2) https 페이지에서 localhost:2000 방지(혼합콘텐츠 차단)
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

  // 3) 동일 origin이면 기존 소켓 재사용(토큰 갱신)
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

  // 4) origin 변경/신규: 기존 소켓 정리 후 새 연결
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
    // 연결 중이면 재협상 위해 재연결
    if (socket.connected) {
      socket.disconnect()
      socket.connect()
    }
  } catch (e: any) {
    console.warn('⚠️ [Socket] refresh auth error:', e?.message)
  }
}
