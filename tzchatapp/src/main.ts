// src/main.ts
import { createApp, nextTick } from 'vue'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import router from './router'

/* -------------------------------------------------------
 * Ionic 필수/기본 CSS (이게 빠지면 컴포넌트가 민짜로 보임)
 * ----------------------------------------------------- */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* -------------------------------------------------------
 * 선택 유틸 CSS (여백/정렬/표시 등)
 * ----------------------------------------------------- */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* -------------------------------------------------------
 * ⚠️ 다크 자동 팔레트 제거 (가독성: 글씨 검정 유지)
 * 필요 시 나중에 토글로 dark.class.css를 동적 주입 권장
 * ----------------------------------------------------- */
// import '@ionic/vue/css/palettes/dark.system.css' // ⛔️ 사용안함

/* -------------------------------------------------------
 * 사용자 정의 테마 변수 (글자색 등 전역 토큰)
 * 항상 마지막에 import (우선순위 보장)
 * ----------------------------------------------------- */
import './theme/variables.css'

/* -------------------------------------------------------
 * Web Components 등록(ion-modal 등 네이티브 플러그인)
 * ----------------------------------------------------- */
import { defineCustomElements } from '@ionic/pwa-elements/loader'

/* 이모지 피커 (사용시만) */
import 'emoji-picker-element'

/* ===== 로그(환경/베이스 URL) — 로그분석용 ===== */
const IS_DEV = import.meta.env.DEV
console.log('🌐 Environment:', IS_DEV ? 'DEV' : 'PROD')

/* 라이트 테마 강제 (서버/캐시와 무관하게 글씨 검정) */
document.documentElement.classList.remove('dark')
document.documentElement.setAttribute('color-scheme', 'light')

const app = createApp(App)
app.use(IonicVue /* , { mode: 'md' } */)
app.use(router)

router.isReady().then(async () => {
  app.mount('#app')
  defineCustomElements(window)
  console.log('🚀 App mounted (Ionic + Vue)')

  // ===== 수화(hydrated) 상태 점검 =====
  await nextTick()
  setTimeout(() => {
    const ions = Array.from(document.querySelectorAll('[class*="ion-"], ion-content, ion-toggle, ion-item]')) as HTMLElement[]
    const sample = ions.slice(0, 5).map(el => ({
      tag: el.tagName.toLowerCase(),
      hydrated: el.classList.contains('hydrated')
    }))
    console.log('🔎 [DEBUG] Ionic samples:', sample)

    const anyNotHydrated = sample.some(s => !s.hydrated)
    if (anyNotHydrated) {
      console.warn('⛔ [WARN] 일부 Ionic 컴포넌트가 수화되지 않았습니다. Network 탭에서 CSS/JS 404 또는 CSP 차단을 확인하세요.')
    }
  }, 400)
})
