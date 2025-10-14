// /src/push/webPush.ts
// -------------------------------------------------------------
// ✅ Web/PWA 푸시 등록 (프로필의 "알림 받지 않기"와 연동)
//  - 네이티브(Capacitor)에서는 스킵
//  - search_allowNotifications === 'ON' 일 때만 등록
//  - OFF면 기존 SW/푸시 구독/캐시 정리
//  - setNotificationsOptOut(optOut) 제공 (프로필 스위치와 직접 연동)
// -------------------------------------------------------------
import { Capacitor } from '@capacitor/core'
import api from '@/lib/api'

import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

// Firebase 콘솔 설정 (사용자 제공 값 유지)
const firebaseConfig = {
  apiKey: 'AIzaSyAxijk1sRxkzG7MwCA18Rtm7yErXVW59YI',
  authDomain: 'tzchat-eb893.firebaseapp.com',
  projectId: 'tzchat-eb893',
  storageBucket: 'tzchat-eb893.appspot.com',
  messagingSenderId: '565729575217',
  appId: '1:565729575217:web:5ba67d38c4f82302c13010',
  measurementId: 'G-G7263X06SP',
}

// Firebase Cloud Messaging → Web Push VAPID 공개키
const VAPID_KEY =
  'BJ_B1iqArRIkGPUAJ52MU8xgq624Vcy9FjAkODOO5OL35JBt3J7bd1V_bIx_Z3sIXQxbjAuX-i_fDt2Boieb4ls'

// 로컬 opt-out 키(웹 전용; 서버 진실원천은 /api/search/settings)
const OPT_KEY = 'TZCHAT_NOTIFY_OPT_OUT'

// -------------------------------------------------------------
// 내부 유틸
// -------------------------------------------------------------

/** OFF일 때: 기존 SW/푸시 구독/캐시 정리 */
async function cleanupWebPushArtifacts() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        try {
          const sub = await reg.pushManager.getSubscription()
          if (sub) await sub.unsubscribe()
        } catch {}
        await reg.unregister()
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    console.log('[WebPush] cleaned up service workers/subscriptions/caches.')
  } catch (e: any) {
    console.warn('[WebPush] cleanup error:', e?.message)
  }
}

/** 브라우저 알림 권한 확보 */
async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const res = await Notification.requestPermission()
    return res === 'granted'
  } catch {
    return false
  }
}

async function getSWReg(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.ready } catch { return null }
}

/** 강제 구독 해지(웹) + 서버 토큰 제거(선택) */
async function unsubscribeFromPush(): Promise<void> {
  const reg = await getSWReg()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    try { await sub.unsubscribe() } catch {}
  }
  // 서버에 이 브라우저의 웹푸시 토큰 제거 요청(엔드포인트는 백엔드 구현에 맞춰 조정)
  try { await api.delete('/api/push/web/token', { withCredentials: true }) } catch {}
}

// -------------------------------------------------------------
// 공개 API
// -------------------------------------------------------------

export async function registerWebPush() {
  try {
    // 0) 네이티브 앱이면(안드로이드/iOS) 스킵 — 네이티브 FCM 경로 사용
    if (Capacitor.getPlatform() !== 'web') {
      console.log('[WebPush] non-web platform → skip.')
      return
    }

    // 1) 브라우저/환경 지원 확인
    if (!(await isSupported())) {
      console.warn('[WebPush] This browser does not support FCM Web.')
      return
    }
    if (!('serviceWorker' in navigator)) {
      console.warn('[WebPush] Service Worker not supported.')
      return
    }

    // 2) 서버에서 알림 설정 조회 (세션 쿠키 포함)
    const me = await api.get('/api/me', { withCredentials: true }).catch(() => null)
    const allowStr = me?.data?.user?.search_allowNotifications as string | undefined
    const allowNotifications = String(allowStr || '').toUpperCase() === 'ON'

    if (!allowNotifications) {
      console.log('[WebPush] notifications OFF in profile → cleanup & skip.')
      await cleanupWebPushArtifacts()
      return
    }

    // 3) 권한 요청
    const permitted = await ensureNotificationPermission()
    if (!permitted) {
      console.warn('[WebPush] Notification permission denied → skip.')
      return
    }

    // 4) Firebase 초기화 + SW 등록
    console.log('[WebPush] init start')
    const app = initializeApp(firebaseConfig)
    const messaging = getMessaging(app)

    // public 루트에 firebase-messaging-sw.js 필요
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    console.log('[WebPush] SW registered:', reg.scope)

    // 5) 토큰 발급
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    }).catch((e) => {
      console.error('[WebPush] getToken error:', e)
      return null
    })

    if (!token) {
      console.warn('[WebPush] token not issued (null).')
      return
    }
    console.log('[WebPush] token:', token.slice(0, 16) + '…')

    // 6) 서버 등록
    await api
      .post(
        '/api/push/register',
        {
          token,
          platform: 'web',
          appVersion: (import.meta as any)?.env?.VITE_APP_VERSION || 'web-1.0.0',
        },
        { withCredentials: true }
      )
      .then(() => console.log('[WebPush] token registered to backend'))
      .catch(async (err) => {
        console.error('[WebPush] backend register failed:', err?.response?.status || err?.message)
        // 서버가 거절하면 구독을 유지할 이유가 없으므로 정리(선택)
        await cleanupWebPushArtifacts()
      })

    // 7) 포그라운드 수신 — 간단한 알림 표시(원치 않으면 주석 처리)
    onMessage(messaging, (payload) => {
      console.log('[WebPush] foreground message:', payload)
      try {
        const title =
          payload?.notification?.title ||
          (payload as any)?.data?.title ||
          '알림'
        const body =
          payload?.notification?.body ||
          (payload as any)?.data?.body ||
          ''
        // 페이지가 포커스 중일 때도 배너로 한번 보여주고 싶다면:
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body })
        }
      } catch {}
      // TODO: 앱 내부 토스트/배지 갱신 등 원하는 UI 연동
    })
  } catch (err) {
    console.error('[WebPush] init error:', err)
  }
}

/** (선택) 외부에서 강제로 정리하고 싶을 때 사용 */
export async function unregisterWebPushAll() {
  await cleanupWebPushArtifacts()
}

/**
 * ✅ 프로필의 "알림 받지 않기" 토글과 직접 연동
 * optOut = true  → allowNotifications='OFF' 저장 + 구독/캐시 정리
 * optOut = false → allowNotifications='ON' 저장 + 웹푸시 재등록
 */
export async function setNotificationsOptOut(optOut: boolean): Promise<void> {
  try {
    // 1) 로컬 상태 저장(웹 전용 메모; 서버가 진실원천)
    localStorage.setItem(OPT_KEY, optOut ? '1' : '0')

    // 2) 서버에 저장(프로필 설정과 동일 엔드포인트 사용)
    //    백엔드에서 allowNotifications만 읽어 반영하도록 구현되어 있어야 합니다.
    await api.patch(
      '/api/search/settings',
      { allowNotifications: optOut ? 'OFF' : 'ON' },
      { withCredentials: true }
    )

    // 3) 실제 처리
    if (optOut) {
      // 구독/서비스워커/캐시 정리(안 내보내도록)
      await unsubscribeFromPush().catch(() => {})
      await cleanupWebPushArtifacts().catch(() => {})
      console.log('[WebPush] opt-out ON → unsubscribed & cleaned.')
    } else {
      // 재등록
      await registerWebPush()
      console.log('[WebPush] opt-out OFF → (re)registered.')
    }
  } catch (e: any) {
    console.warn('[WebPush] setNotificationsOptOut error:', e?.message)
    // 실패 시에도 UI는 계속 동작 가능하도록 함
  }
}
