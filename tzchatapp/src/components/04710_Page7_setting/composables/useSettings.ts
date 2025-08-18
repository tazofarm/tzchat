// ---------------------------------------------
// useSettings.ts
// - 설정 상태/저장/서버반영/적용(테마, 폰트) 일원화
// - 모든 섹션/공용 컴포넌트에서 공통 사용
// ---------------------------------------------
import { reactive } from 'vue'

// localStorage 키 (버전 변경 시 키도 변경)
const LS_KEY = 'tzchat.settings.v1'

// 기능 상태 배지 테이블
// live: 실제동작 | local: 로컬저장 | stub: 준비중
export const FEATURE_STATUS = {
  passwordChange: 'stub',
  allowFriendRequest: 'local',
  deleteAccount: 'stub',

  pushEnabled: 'stub',
  messageNotif: 'stub',
  friendNotif: 'stub',

  fontSize: 'live',
  theme: 'live',

  purchase: 'stub',
  contact: 'stub',
  notices: 'stub',
  legal: 'stub',

  appVersion: 'live'
} as const

export type FeatureKey = keyof typeof FEATURE_STATUS

export function getBadge(key: FeatureKey | string) {
  const s = (FEATURE_STATUS as any)[key] ?? 'stub'
  if (s === 'live')  return { text: '실제동작', class: 'badge badge-live' }
  if (s === 'local') return { text: '로컬저장', class: 'badge badge-local' }
  return { text: '준비중', class: 'badge badge-stub' }
}

// 전역 설정 상태 (필요 시 pinia/vuex 대체 가능)
export const settings = reactive({
  allowFriendRequest: true,   // 친구신청 허용(로컬저장)
  pushEnabled: true,          // 푸시 알림(준비중)
  messageNotif: true,         // 메시지 알림(준비중)
  friendNotif: true,          // 친구신청 알림(준비중)
  fontSize: 16,               // 글자 크기(px) - 실제 반영
  theme: 'light'              // light | dark | system - 실제 반영
})

// 스토리지 로드
export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      Object.assign(settings, parsed)
      console.info('[useSettings] loadFromStorage:', parsed)
    } else {
      console.info('[useSettings] no localStorage, use defaults:', { ...settings })
    }
  } catch (e) {
    console.error('[useSettings] load error:', e)
  }
}

// 스토리지 저장
export function saveToStorage() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings))
    console.info('[useSettings] saveToStorage:', { ...settings })
  } catch (e) {
    console.error('[useSettings] save error:', e)
  }
}

// 서버 저장 (mock) - 실제 API 연동 시 교체
export async function saveToServer(patch: Record<string, any>) {
  try {
    // 예시: await fetch('/api/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch) })
    console.debug('[useSettings] (mock) saveToServer:', patch)
  } catch (e) {
    console.error('[useSettings] server save error:', e)
  }
}

// 테마 즉시 적용
export function applyTheme(theme: string) {
  const html = document.documentElement
  if (theme === 'dark') html.setAttribute('data-theme', 'dark')
  else if (theme === 'light') html.setAttribute('data-theme', 'light')
  else html.removeAttribute('data-theme') // 시스템 기본
  console.debug('[useSettings] theme applied:', theme)
}

// 폰트 크기 즉시 적용
export function applyFontSize(px: number) {
  document.documentElement.style.setProperty('--app-font-size', `${px}px`)
  console.debug('[useSettings] font size applied:', px)
}

// 앱 버전 (env 또는 기본값)
export const appVersion = (import.meta as any)?.env?.VITE_APP_VERSION || '1.0.0'
