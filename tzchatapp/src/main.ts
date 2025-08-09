// src/main.ts
// ------------------------------------------------------
// 앱 엔트리: Ionic + Vue + Router 부팅 스크립트
// - 화면이 검게 나오는 문제를 막기 위해 Ionic 기본 CSS + 전역 CSS를 확실히 import
// - 부팅/라우터/에러 상황을 콘솔 로그로 상세 기록
// - 기존 기능(emoji-picker, pwa elements, ion-modal 동작) 그대로 유지
// ------------------------------------------------------

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { IonicVue } from '@ionic/vue'

// ⚙️ Ionic 필수/기본 CSS (라이트 배경이 적용되도록 순서 지킴)
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

// (선택) 유틸 CSS – 기존 동작 유지
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

// 🧾 전역 커스텀 CSS (배경 흰색, 글자 검정 강제) — 파일이 없다면 만들어 주세요.
import '@/theme/variables.css'

// 😀 이모지 피커 (기존 유지)
import 'emoji-picker-element'

// ✅ Web Components 등록 (ion-modal 등 사용 가능하게 함)
import { defineCustomElements } from '@ionic/pwa-elements/loader'

// ------------------------------------------------------
// 앱 부팅
// ------------------------------------------------------
console.log('[main] Booting app...')

const app = createApp(App)

// 💡 필요 시 플랫폼 모드 고정('md' 또는 'ios') — 시각 일관성
app.use(IonicVue, {
  mode: 'md', // 변경 원치 않으면 이 라인 제거해도 됩니다.
})

app.use(router)

// 라우터 준비 후 마운트
router
  .isReady()
  .then(() => {
    console.log('[main] Router ready. Mounting #app ...')
    app.mount('#app')

    // PWA Elements (ion-modal, ion-action-sheet 등 Web Components)
    defineCustomElements(window)
    console.log('[main] defineCustomElements applied.')

    // 환경 체크 로그
    console.log('[main] App mounted.')
    console.log('[main] Location:', window.location.href)
  })
  .catch((err) => {
    console.error('[main] Router init error:', err)
  })

// 전역 에러/프라미스 거부 로깅 (디버깅 용도)
window.addEventListener('error', (e) => {
  console.error('[main] window error:', e.message, e.error)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[main] unhandledrejection:', e.reason)
})
