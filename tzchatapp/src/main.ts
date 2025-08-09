import { createApp } from 'vue'
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
 * ⚠️ 다크 자동 적용 팔레트 (서버에서 새까맣게 보이던 원인)
 * import '@ionic/vue/css/palettes/dark.system.css'
 *
 * 요구사항: "기본 글씨는 검정(가독성)" → 다크 자동 OFF
 * 필요 시, 나중에 토글로 dark.class.css를 동적으로 붙이세요.
 * ----------------------------------------------------- */
// import '@ionic/vue/css/palettes/dark.system.css'  // ⛔️ 제거

/* -------------------------------------------------------
 * 사용자 정의 테마 변수 (여기서 글자색을 검정으로 유지)
 * ----------------------------------------------------- */
import './theme/variables.css'

/* -------------------------------------------------------
 * Web Components 등록(ion-modal 등 네이티브 기능)
 * ----------------------------------------------------- */
import { defineCustomElements } from '@ionic/pwa-elements/loader'

/* 이모지 피커 */
import 'emoji-picker-element'

/* ===== 로그(환경/베이스 URL) — 로그분석용 ===== */
const IS_DEV = import.meta.env.DEV
const BASE_URL = IS_DEV ? 'http://localhost:2000/' : 'https://tzchat.duckdns.org/'
console.log('🌐 Environment:', IS_DEV ? 'DEV' : 'PROD')
console.log('🛰 Axios/Base URL 예상:', BASE_URL)

/* -------------------------------------------------------
 * 라이트 테마 강제 (가독성: 기본 글씨 검정)
 *  - 서버/클라이언트 환경/캐시와 무관하게 항상 라이트
 * ----------------------------------------------------- */
document.documentElement.classList.remove('dark')
document.documentElement.setAttribute('color-scheme', 'light')

const app = createApp(App)

app.use(IonicVue /* , { mode: 'md' } */) // 필요 시 { mode: 'md' } 지정
app.use(router)

router.isReady().then(() => {
  app.mount('#app')
  defineCustomElements(window) // ion-modal 등 동작에 필요
  console.log('🚀 App mounted (Ionic + Vue)')
})
