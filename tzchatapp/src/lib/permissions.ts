// src/lib/permissions.ts
// -------------------------------------------------------------
// 안드로이드 기본 권한 유틸 (알림/위치) - Capacitor 기반
// - Local Notifications: Android 13+ POST_NOTIFICATIONS 런타임 처리
// - Geolocation: COARSE/FINE 위치 권한 요청 + 실제 1회 위치 조회(실사용 증빙)
// - 필요 플러그인: @capacitor/local-notifications, @capacitor/geolocation
//   npm i @capacitor/local-notifications @capacitor/geolocation && npx cap sync
// -------------------------------------------------------------
import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type PermissionStatus as NotiPermStatus } from '@capacitor/local-notifications'
import { Geolocation, type PermissionStatus as GeoPermStatus } from '@capacitor/geolocation'

// (Android 전용) 알림 채널 기본값
const ANDROID_DEFAULT_CHANNEL_ID = 'default'
const ANDROID_DEFAULT_CHANNEL_NAME = '일반 알림'

// 안드로이드 여부
const isAndroid = () => Capacitor.getPlatform() === 'android'

/** (Android) 알림 채널을 확보합니다. */
async function ensureAndroidNotificationChannel() {
  if (!isAndroid()) return
  try {
    // 채널 생성은 존재해도 중복 에러 없이 넘어갑니다.
    await LocalNotifications.createChannel({
      id: ANDROID_DEFAULT_CHANNEL_ID,
      name: ANDROID_DEFAULT_CHANNEL_NAME,
      description: '기본 알림 채널',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1, // VISIBILITY_PRIVATE
      sound: undefined,
      vibration: true,
      lights: true,
    })
  } catch (e) {
    console.warn('[perm] createChannel error', e)
  }
}

/** 🔔 알림 권한을 확인/요청합니다. (Android 13+ 런타임 권한 포함) */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    // 채널을 먼저 보장(안드로이드)
    await ensureAndroidNotificationChannel()

    const status: NotiPermStatus = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true

    const req: NotiPermStatus = await LocalNotifications.requestPermissions()
    return req.display === 'granted'
  } catch (e) {
    console.warn('[perm] notification error', e)
    return false
  }
}

/** 📍 위치 권한을 확인/요청합니다. (정밀 위치 포함) */
export async function ensureLocationPermission(): Promise<boolean> {
  try {
    const status: GeoPermStatus = await Geolocation.checkPermissions()
    if (status.location === 'granted') return true

    const req: GeoPermStatus = await Geolocation.requestPermissions()
    if (req.location !== 'granted') return false

    // 실제 1회 조회: “형식적 요청”이 아닌 “실사용” 신호로 유리
    // (오류가 나도 권한 자체는 부여된 상태이므로 실패를 fatal로 보지 않습니다.)
    try {
      await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 0,
      })
    } catch (e) {
      console.warn('[perm] getCurrentPosition warn', e)
    }
    return true
  } catch (e) {
    console.warn('[perm] location error', e)
    return false
  }
}

/** ✅ 한 번에 기본 권한(알림/위치)을 요청합니다. */
export async function requestBasicPermissions(): Promise<{ notification: boolean; location: boolean }> {
  const [n, l] = await Promise.all([
    ensureNotificationPermission(),
    ensureLocationPermission(),
  ])
  return { notification: n, location: l }
}

/** 🔔 테스트 알림(권한 승인 후 실제 표시 확인용) */
export async function testLocalNotification() {
  try {
    await ensureAndroidNotificationChannel()
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now() % 100000,
          title: '테스트 알림',
          body: '권한/채널 설정이 정상입니다.',
          schedule: { at: new Date(Date.now() + 1000) },
          channelId: isAndroid() ? ANDROID_DEFAULT_CHANNEL_ID : undefined,
        },
      ],
    })
  } catch (e) {
    console.warn('[perm] testLocalNotification error', e)
  }
}
