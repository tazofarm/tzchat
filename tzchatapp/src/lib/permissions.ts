// src/lib/permissions.ts
// -------------------------------------------------------------
// 안드로이드 권한 유틸 (알림/위치) - Capacitor 기반
// ✅ 변경사항(중요):
//   - 기본 동작을 "확인만(check)"으로 축소. 자동으로 요청(prompt)하지 않음.
//   - 필요 시에만 명시적으로 요청하도록 옵션 제공({ request: true }).
//   - testLocalNotification 도 권한 미승인 시 조용히 return(팝업/요청 X).
// -------------------------------------------------------------
import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type PermissionStatus as NotiPermStatus } from '@capacitor/local-notifications'
import { Geolocation, type PermissionStatus as GeoPermStatus } from '@capacitor/geolocation'

// (Android 전용) 알림 채널 기본값
const ANDROID_DEFAULT_CHANNEL_ID = 'default'
const ANDROID_DEFAULT_CHANNEL_NAME = '일반 알림'

const isAndroid = () => Capacitor.getPlatform() === 'android'

/** (Android) 알림 채널을 확보합니다. (이미 있으면 아무 일도 없음) */
async function ensureAndroidNotificationChannel() {
  if (!isAndroid()) return
  try {
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

/* -------------------------------------------------------------
 * 🔔 알림 권한
 * -----------------------------------------------------------*/
export type EnsurePermOptions = { request?: boolean } // request=true 인 경우에만 실제 요청

/** 알림 권한 상태만 확인 (요청 X) */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const status: NotiPermStatus = await LocalNotifications.checkPermissions()
    return status.display === 'granted'
  } catch (e) {
    console.warn('[perm] notification check error', e)
    return false
  }
}

/** 알림 권한 보장 (기본: 확인만; 옵션으로 요청 가능) */
export async function ensureNotificationPermission(opts: EnsurePermOptions = {}): Promise<boolean> {
  try {
    // 안드로이드라면 채널만 미리 확보(채널 생성 자체는 팝업 유발 안 함)
    await ensureAndroidNotificationChannel()

    const has = await checkNotificationPermission()
    if (has) return true

    if (opts.request) {
      const req: NotiPermStatus = await LocalNotifications.requestPermissions()
      return req.display === 'granted'
    }
    // 기본은 요청하지 않음
    return false
  } catch (e) {
    console.warn('[perm] notification ensure error', e)
    return false
  }
}

/* -------------------------------------------------------------
 * 📍 위치 권한
 * -----------------------------------------------------------*/
export async function checkLocationPermission(): Promise<boolean> {
  try {
    const status: GeoPermStatus = await Geolocation.checkPermissions()
    return status.location === 'granted'
  } catch (e) {
    console.warn('[perm] location check error', e)
    return false
  }
}

/** 위치 권한 보장 (기본: 확인만; 옵션으로 요청 가능) */
export async function ensureLocationPermission(opts: EnsurePermOptions = {}): Promise<boolean> {
  try {
    const has = await checkLocationPermission()
    if (has) return true

    if (opts.request) {
      const req: GeoPermStatus = await Geolocation.requestPermissions()
      if (req.location !== 'granted') return false

      // 실제 1회 조회는 "요청 시"에만 시도(옵션 사용 시)
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
    }
    // 기본은 요청하지 않음
    return false
  } catch (e) {
    console.warn('[perm] location ensure error', e)
    return false
  }
}

/* -------------------------------------------------------------
 * 🧰 배치 헬퍼
 * -----------------------------------------------------------*/
/** 기본 권한(알림/위치)을 한 번에 처리 (기본: 확인만, 요청 없음) */
export async function requestBasicPermissions(opts: EnsurePermOptions = {}): Promise<{ notification: boolean; location: boolean }> {
  const [n, l] = await Promise.all([
    ensureNotificationPermission(opts),
    ensureLocationPermission(opts),
  ])
  return { notification: n, location: l }
}

/* -------------------------------------------------------------
 * 🔔 테스트 알림
 * -----------------------------------------------------------*/
/** 테스트 알림 (권한 승인 상태에서만 발송, 미승인 시 요청하지 않고 조용히 종료) */
export async function testLocalNotification(): Promise<boolean> {
  try {
    const granted = await checkNotificationPermission()
    if (!granted) {
      // 권한 없으면 조용히 종료(팝업/요청 안 함)
      console.log('[perm] testLocalNotification skipped: permission not granted')
      return false
    }

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
    return true
  } catch (e) {
    console.warn('[perm] testLocalNotification error', e)
    return false
  }
}
