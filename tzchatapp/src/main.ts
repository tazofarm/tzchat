// src/main.ts
console.log('[main] env?', import.meta.env.MODE, import.meta.env.VITE_API_BASE_URL)

import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import router from './router'

// 🔔 Web/PWA 푸시 등록
import { registerWebPush } from './push/webPush'

// ✅ API 인스턴스 (.env 기반 baseURL 사용)
import api from '@/lib/api'

// ✅ 소켓 유틸
import { connectSocket, getSocket } from '@/lib/socket'

// ✅ 사용자 스토어(소켓 바인딩용)
import { useUserStore } from '@/store/user'

// ✅ (추가) 안드로이드 권한 유틸
import { requestBasicPermissions } from '@/lib/permissions'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

// ✅ 구글플레이 업데이트 유도(스토어 열기)
import { checkAndPromptStoreUpdate } from '@/lib/appUpdate'

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

/* ✅ 프로젝트 공통 스타일 */
import '@/theme/variables.css'
import '@/theme/mobile-utilities.css'
import '@/theme/theme-gold.css'

import 'emoji-picker-element'

/* ====== 🔥 DEV에서 SW 캐시/등록 강제 해제 ====== */
async function killServiceWorkersInDev() {
  // ✅ production만 prod로 간주 (dev-remote 같은 커스텀 모드도 dev로 처리)
  const mode = String((import.meta as any)?.env?.MODE || '')
  const viteMode = String((import.meta as any)?.env?.VITE_MODE || '')
  const isProdLike = mode === 'production' || viteMode === 'production'

  if (!isProdLike && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) await reg.unregister()
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      console.warn('🧹 Dev 모드: 기존 서비스워커/캐시 강제 해제 완료')
    } catch (e: any) {
      console.warn('⚠️ SW/Cache cleanup 실패:', e?.message)
    }
  }
}
/* ================================================= */

/* ✅ 최종 API 설정 진단 */
function logApiConfigOnce() {
  try {
    const mode = import.meta.env.MODE
    const viteMode = (import.meta as any)?.env?.VITE_MODE
    const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
    const finalBase = api?.defaults?.baseURL as string | undefined
    const isDevRemote = mode === 'dev-remote' || viteMode === 'dev-remote'
    const isDevLocal = mode === 'development' || viteMode === 'development'

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
}

/* =======================
// 🔌 소켓 부트스트랩 가드
/* ===================== */
const TOKEN_KEY = 'TZCHAT_AUTH_TOKEN'

declare global {
  interface Window {
    __TZCHAT_SOCKET_BOOTSTRAPPED__?: boolean
  }
}

function hasToken(): boolean {
  try {
    return !!localStorage.getItem(TOKEN_KEY)
  } catch {
    return false
  }
}

/** ✅ /api/me 세션 체크를 “타임아웃”으로 안전하게 */
async function hasSession(timeoutMs = 1500): Promise<boolean> {
  try {
    const base = String(api?.defaults?.baseURL || '').replace(/\/+$/, '')
    const url = `${base}/api/me`
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)

    const token = (() => {
      try {
        return localStorage.getItem(TOKEN_KEY)
      } catch {
        return null
      }
    })()

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(t))

    return res.status >= 200 && res.status < 300
  } catch {
    return false
  }
}

/** ✅ 스토어-소켓 바인딩을 보장 (중복 바인딩 방지) */
function ensureBindUserStoreToSocket() {
  const sock = getSocket()
  if (!sock) return
  const store = useUserStore()
  // @ts-ignore
  store.bindSocket?.(sock)
}

async function bootstrapSocketOnce() {
  if (window.__TZCHAT_SOCKET_BOOTSTRAPPED__) {
    console.log('🧲 [Socket] bootstrap skipped (flag set).')
    ensureBindUserStoreToSocket()
    return
  }
  if (getSocket()) {
    console.log('🧲 [Socket] bootstrap skipped (socket exists).')
    window.__TZCHAT_SOCKET_BOOTSTRAPPED__ = true
    ensureBindUserStoreToSocket()
    return
  }
  let ok = hasToken()
  if (!ok) ok = await hasSession(1500)
  if (!ok) {
    console.log('⏸️ [Socket] no token/session → not connecting yet.')
    return
  }
  try {
    const sock = connectSocket()
    window.__TZCHAT_SOCKET_BOOTSTRAPPED__ = true
    ensureBindUserStoreToSocket()
    console.log('🔌 [Socket] bootstrap connected?', !!sock?.connected)
  } catch (e: any) {
    console.warn('⚠️ [Socket] bootstrap error:', e?.message)
  }
}

/* =======================
// 유틸 함수
/* ===================== */
function logPrimaryColorVar() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary')
  console.log('🎨 --ion-color-primary:', v || '(빈 값)')
}

function logLoadedAssets() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
  const scripts = Array.from(document.querySelectorAll('script'))
  console.log('📄 stylesheets:', links.map((l) => (l as HTMLLinkElement).href))
  console.log('📜 scripts:', scripts.map((s) => (s as HTMLScriptElement).src || '(inline/module)'))
}

async function waitForCustomElements(tags: string[]) {
  await Promise.all(tags.map((tag) => customElements.whenDefined(tag)))
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
  const hydratedFlags = Array.from(probes).map((el) => el.classList.contains('hydrated'))
  console.log(
    '🧪 hydrated flags:',
    tags.reduce((acc, tag, i) => ({ ...acc, [tag]: hydratedFlags[i] ?? false }), {} as Record<string, boolean>)
  )
  const anyNotHydrated = hydratedFlags.some((f) => !f)
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
      await new Promise((r) => setTimeout(r, 300))
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

/** ✅ 백그라운드 실행(첫 렌더 방해 금지) */
function runInBackground(fn: () => void, delayMs = 0) {
  // @ts-ignore
  const ric = (window as any).requestIdleCallback as undefined | ((cb: Function, opts?: any) => any)
  if (ric) {
    ric(() => fn(), { timeout: 1200 })
    return
  }
  setTimeout(fn, delayMs)
}

/* =======================
// 앱 부트
/* ===================== */
const app = createApp(App)
const pinia = createPinia()

app.use(IonicVue, { mode: 'md' })
app.use(pinia)
app.use(router)

// ✅ store는 app.use(pinia) 이후 생성해야 안전
const userStore = useUserStore()

window.addEventListener('api:wallet', (e: Event) => {
  try {
    const w = (e as CustomEvent).detail
    if (w && typeof w === 'object') userStore.updateWallet(w)
  } catch {}
})

// ✅ WebPush는 mount를 막지 않게 백그라운드
runInBackground(() => {
  registerWebPush()
    .then(() => console.log('🔔 WebPush 등록 플로우 완료(요청/토큰/등록)'))
    .catch((err) => console.error('💥 WebPush 등록 실패:', err))
}, 0)

router.isReady()
  .then(() => {
    // ✅ 1) 무조건 먼저 mount → 첫 화면 즉시
    app.mount('#app')
    console.log('✅ Vue + Ionic mounted.')

    // ✅ 2) DEV SW/Cache cleanup은 mount 이후 백그라운드
    runInBackground(() => {
      killServiceWorkersInDev().catch((err) => {
        console.warn('SW/Cache cleanup 오류:', err?.message)
      })
    }, 0)

    // ✅ 3) API 설정 로그도 mount 이후
    runInBackground(() => logApiConfigOnce(), 0)

    // ✅ 4) 앱 시작 직후 1회 스토어 업데이트 체크
    setTimeout(() => {
      checkAndPromptStoreUpdate({ confirm: true }).catch(() => {})
    }, 700)

    // ✅ 5) resume 때 업데이트 체크
    try {
      CapApp.addListener('resume', () => {
        setTimeout(() => {
          checkAndPromptStoreUpdate({ confirm: true }).catch(() => {})
        }, 250)
      })
    } catch {}

    // ✅ 6) 권한 요청도 mount 이후(흐름 막지 않음)
    runInBackground(() => {
      try {
        if (Capacitor.getPlatform() === 'android') {
          requestBasicPermissions()
            .then((res) => console.log('🔐 [perm] requested →', res))
            .catch((e: any) => console.warn('⚠️ 권한 요청 중 오류:', e?.message))
        }
      } catch (e: any) {
        console.warn('⚠️ 권한 요청 중 오류:', e?.message)
      }
    }, 400)

    // ✅ 7) 딥링크 처리 (mount 이후 등록)
    try {
      CapApp.addListener('appUrlOpen', async ({ url }) => {
        try {
          if (!url) return
          try { await Browser.close() } catch {}

          const isCustom = url.startsWith('tzchat://')
          const isHttps = url.startsWith('http://') || url.startsWith('https://')
          let txId = ''

          if (isCustom) {
            const raw = url.replace('tzchat://', '')
            const [path, qs = ''] = raw.split('?')
            if (path === 'pass-result') {
              const p = new URLSearchParams(qs)
              txId = p.get('txId') || ''
            }
          } else if (isHttps) {
            try {
              const u = new URL(url)
              if (u.pathname.replace(/^\/+/, '') === 'app/pass-result') {
                txId = u.searchParams.get('txId') || ''
              }
            } catch {}
          }

          if (txId) {
            try { localStorage.setItem('PASS_RESULT_TX', txId) } catch {}
            window.dispatchEvent(new StorageEvent('storage', { key: 'PASS_RESULT_TX', newValue: txId } as any))

            const onPassPage = location.pathname.includes('/pass')
            if (!onPassPage) {
              try {
                await router.replace({ name: 'PassPortal', query: { txId } })
              } catch {
                await router.replace(`/pass?txId=${encodeURIComponent(txId)}`)
              }
            }
            console.log('[DEEPLINK][PASS] txId=', txId)
            return
          }

          if (url.startsWith('tzchat://')) {
            const path = url.replace('tzchat://', '').replace(/^\/+/, '')
            if (path.startsWith('chat/')) {
              await router.push(`/home/chat/${path.split('/')[1]}`)
            } else if (path === 'friends/received') {
              await router.push('/home/3page')
              window.dispatchEvent(new CustomEvent('friends:openTab', { detail: { tab: 'received' } }))
            } else {
              await router.push('/' + path)
            }
            console.log('[DEEPLINK] handled:', url, '→', path)
          }
        } catch (e: any) {
          console.warn('[DEEPLINK] handle error:', e?.message)
        }
      })
    } catch {}

    // ✅ 8) 안드로이드 하드웨어 뒤로가기 처리
    try {
      if (Capacitor.getPlatform() === 'android') {
        CapApp.addListener('backButton', ({ canGoBack }) => {
          const current = router.currentRoute.value
          const path = current.path || ''
          const name = (current.name as string | undefined) || ''

          const isMainLike =
            path === '/' ||
            path === '/home' ||
            path === '/home/' ||
            path === '/home/0page' ||
            name === 'Home' ||
            name === 'MainPage'

          if (isMainLike) {
            CapApp.exitApp()
            return
          }

          if (canGoBack && router.options.history.state.back !== null) {
            router.back()
          } else {
            CapApp.exitApp()
          }
        })
      }
    } catch {}

    // ✅ 9) 소켓 부트스트랩도 백그라운드
    runInBackground(() => {
      bootstrapSocketOnce().catch(() => {})
    }, 0)

    // ✅ 10) 디버그/수화체크는 idle에서 실행
    runInBackground(() => {
      nextTick()
        .then(() => {
          logLoadedAssets()
          logPrimaryColorVar()
        })
        .catch(() => {})
    }, 800)

    runInBackground(() => {
      checkIonicHydrationSafe().catch(() => {})
    }, 1200)
  })
  .catch((err) => {
    console.error('💥 router.isReady() 실패:', err)
  })
