// src/main.ts
console.log('[main] env?', import.meta.env.MODE, import.meta.env.VITE_API_BASE_URL)

import { createApp, nextTick } from 'vue'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import router from './router'

// 🔔 Web/PWA 푸시 등록
import { registerWebPush } from './push/webPush'

// ✅ API 인스턴스 (.env 기반 baseURL 사용)
import api from '@/lib/api'

// ✅ 소켓 유틸
import { connectSocket, getSocket } from '@/lib/socket'

// ✅ (추가) 안드로이드 권한 유틸
import { requestBasicPermissions, testLocalNotification } from '@/lib/permissions'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app' // ✅ 딥링크 수신

/* Ionicons */
import { addIcons } from 'ionicons'
import {
  warningOutline,
  locateOutline,
  peopleOutline,
  chatbubblesOutline,
  personCircleOutline,
  settingsOutline,
} from 'ionicons/icons'
addIcons({
  warningOutline,
  locateOutline,
  peopleOutline,
  chatbubblesOutline,
  personCircleOutline,
  settingsOutline,
})

/* Ionic CSS들 */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* ✅ 프로젝트 공통 스타일: 변수 → 유틸 → 테마(마지막) 순서 */
import '@/theme/variables.css'
import '@/theme/mobile-utilities.css'
import '@/theme/theme-gold.css'

import 'emoji-picker-element'

/* ====== 🔥 DEV에서 SW 캐시/등록 강제 해제 ====== */
async function killServiceWorkersInDev() {
  const mode = (import.meta as any)?.env?.MODE
  const viteMode = (import.meta as any)?.env?.VITE_MODE
  const isProdLike = mode === 'production' || viteMode === 'production'
  if (!isProdLike && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) await reg.unregister()
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      console.warn('🧹 Dev 모드: 기존 서비스워커/캐시 강제 해제 완료')
    } catch (e: any) {
      console.warn('⚠️ SW/Cache cleanup 실패:', e?.message)
    }
  }
}

// ✅ 즉시실행 async 함수(IIFE)로 감싸 Top-level await 제거
;(async () => {
  await killServiceWorkersInDev()
})().catch(err => {
  console.warn('SW/Cache cleanup IIFE 오류:', err?.message)
})
/* ================================================= */

/* ✅ 최종 API 설정 진단 */
try {
  const mode = import.meta.env.MODE
  const viteMode = (import.meta as any)?.env?.VITE_MODE
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
  const finalBase = api?.defaults?.baseURL as string | undefined
  const isDevRemote = mode === 'dev-remote' || viteMode === 'dev-remote'
  const isDevLocal  = mode === 'development' || viteMode === 'development'

  console.log('[HTTP][CFG]', { step: 'bootstrap', mode, viteMode, envBase, finalBase })

  if (!envBase) {
    console.warn('⚠️ VITE_API_BASE_URL 이 .env에 비어있습니다.')
  } else if (finalBase !== envBase) {
    console.warn('⚠️ 최종 baseURL이 .env 값과 다릅니다.', { envBase, finalBase })
  }

  if (isDevRemote && /localhost|127\.0\.0\.1/i.test(String(finalBase || ''))) {
    console.warn('⚠️ dev-remote 모드인데 baseURL이 localhost입니다. .env.dev-remote 확인 필요')
  }

  if (isDevLocal && /localhost|127\.0\.0\.1/i.test(String(finalBase || ''))) {
    console.log('ℹ️ dev(local): baseURL=localhost 정상')
  }
} catch (e: any) {
  console.warn('[HTTP][CFG]', { step: 'bootstrap-warn', message: e?.message })
}

/* =======================
 * 🔌 소켓 부트스트랩 가드
 * ===================== */
const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'

declare global {
  interface Window {
    __TZCHAT_SOCKET_BOOTSTRAPPED__?: boolean
  }
}

function hasToken(): boolean {
  try { return !!localStorage.getItem(TOKEN_KEY) } catch { return false }
}

// ✅ 규칙 준수: '/api/me' 로 수정
async function hasSession(): Promise<boolean> {
  try {
    const me = await api.get('/api/me')
    return !!(me?.status === 200)
  } catch {
    return false
  }
}

async function bootstrapSocketOnce() {
  if (window.__TZCHAT_SOCKET_BOOTSTRAPPED__) {
    console.log('🧲 [Socket] bootstrap skipped (flag set).')
    return
  }
  if (getSocket()) {
    console.log('🧲 [Socket] bootstrap skipped (socket exists).')
    window.__TZCHAT_SOCKET_BOOTSTRAPPED__ = true
    return
  }

  let ok = hasToken()
  if (!ok) ok = await hasSession()

  if (!ok) {
    console.log('⏸️ [Socket] no token/session → not connecting yet.')
    return
  }

  try {
    const sock = connectSocket()
    window.__TZCHAT_SOCKET_BOOTSTRAPPED__ = true
    console.log('🔌 [Socket] bootstrap connected?', !!sock?.connected)
  } catch (e: any) {
    console.warn('⚠️ [Socket] bootstrap error:', e?.message)
  }
}

/* =======================
 * 유틸 함수 (function 선언문으로 변경)
 * ===================== */
function checkIonicBasicStyle() {
  const probe = document.createElement('ion-button')
  document.body.appendChild(probe)
  const cs = window.getComputedStyle(probe)
  console.log('🔎 ion-button display:', cs.display)
  probe.remove()
}

function logPrimaryColorVar() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary')
  console.log('🎨 --ion-color-primary:', v || '(빈 값)')
}

function logLoadedAssets() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
  const scripts = Array.from(document.querySelectorAll('script'))
  console.log('📄 stylesheets:', links.map(l => (l as HTMLLinkElement).href))
  console.log('📜 scripts:', scripts.map(s => (s as HTMLScriptElement).src || '(inline/module)'))
}

async function waitForCustomElements(tags: string[]) {
  await Promise.all(tags.map(tag => customElements.whenDefined(tag)))
}

async function probeHydration(tags: string[]) {
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  const temp = document.createElement('div')
  temp.innerHTML = `
    <ion-page>
      <ion-content>
        <ion-list>
          <ion-item>probe</ion-item>
          <ion-button>btn</ion-button>
        </ion-list>
      </ion-content>
    </ion-page>
  `
  document.body.appendChild(temp)
  const probes = temp.querySelectorAll<HTMLElement>(tags.join(','))
  const hydratedFlags = Array.from(probes).map(el => el.classList.contains('hydrated'))
  console.log(
    '🧪 hydrated flags:',
    tags.reduce((acc, tag, i) => ({ ...acc, [tag]: hydratedFlags[i] ?? false }), {} as Record<string, boolean>)
  )
  const anyNotHydrated = hydratedFlags.some(f => !f)
  temp.remove()
  return !anyNotHydrated
}

async function checkIonicHydrationSafe() {
  const TAGS = ['ion-page', 'ion-content', 'ion-list', 'ion-item', 'ion-button']
  try {
    await waitForCustomElements(TAGS)
    let ok = await probeHydration(TAGS)
    if (!ok) {
      console.warn('⏳ 수화 지연, 300ms 후 재시도…')
      await new Promise(r => setTimeout(r, 300))
      ok = await probeHydration(TAGS)
    }
    if (!ok) {
      console.warn('⚠️ 일부 Ionic 컴포넌트 수화 실패: 리소스 404/CSP 확인')
    } else {
      console.log('👌 Ionic hydrated OK')
    }
  } catch (e) {
    console.warn('hydration 체크 오류:', e)
  }
}

/* =======================
 * 앱 부트
 * ===================== */
const app = createApp(App)

/* ✅ 플랫폼별 시각 차이 제거: md 모드 고정 */
app.use(IonicVue, { mode: 'md' })
app.use(router)

registerWebPush()
  .then(() => console.log('🔔 WebPush 등록 플로우 완료(요청/토큰/등록)'))
  .catch(err => console.error('💥 WebPush 등록 실패:', err))

router.isReady()
  .then(async () => {
    app.mount('#app')
    console.log('✅ Vue + Ionic mounted.')

    // ✅ 안드로이드에서만 기본 권한 요청(알림/위치)
    try {
      if (Capacitor.getPlatform() === 'android') {
        const res = await requestBasicPermissions()
        console.log('🔐 [perm] requested →', res)
        // 알림 권한 승인 시 1회 테스트 알림 (심사/기기 검증용)
        if (res.notification) {
          await testLocalNotification()
        }
      } else {
        console.log('↪️ non-Android platform: 권한 요청 생략')
      }
    } catch (e: any) {
      console.warn('⚠️ 권한 요청 중 오류:', e?.message)
    }

    // ✅ tzchat:// 딥링크 처리 (알림 클릭/외부 링크)
    // 예: tzchat://chat/<roomId> → '/home/chat/<roomId>'
    CapApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        if (!url || !url.startsWith('tzchat://')) return
        const path = url.replace('tzchat://', '').replace(/^\/+/, '')
        // 간단 라우팅 매핑
        if (path.startsWith('chat/')) {
          await router.push(`/home/chat/${path.split('/')[1]}`)
        } else if (path === 'friends/received') {
          await router.push('/home/3page') // 친구 탭
          // 하위에 받은신청 탭을 기본으로 여는 커스텀 이벤트
          window.dispatchEvent(new CustomEvent('friends:openTab', { detail: { tab: 'received' } }))
        } else {
          await router.push('/' + path)
        }
        console.log('[DEEPLINK] handled:', url, '→', path)
      } catch (e: any) {
        console.warn('[DEEPLINK] handle error:', e?.message)
      }
    })

    await bootstrapSocketOnce()

    await nextTick()
    logLoadedAssets()
    checkIonicBasicStyle()
    logPrimaryColorVar()
    await checkIonicHydrationSafe()

    console.log('🧩 customElements.has("emoji-picker"):', customElements.get('emoji-picker') ? 'YES' : 'NO')
  })
  .catch(err => {
    console.error('💥 router.isReady() 실패:', err)
  })

/* ⚠️ 전역 글자색 강제는 제거 (테마에 위임) */
// document.documentElement.style.setProperty('--base-text-color', '#000')
// document.addEventListener('DOMContentLoaded', () => {
//   document.body.style.color = 'black'
// })
