// src/main.ts
import { createApp, nextTick } from 'vue'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import router from './router'

/* -------------------------------------------------------
 * 1) Ionic 필수/기본 CSS
 *    - 이 중 하나라도 빠지면 컴포넌트가 ‘민짜’처럼 보일 수 있음
 * ----------------------------------------------------- */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* -------------------------------------------------------
 * 2) Ionic 유틸 CSS (선택이지만 실제로는 자주 필요)
 *    - padding/margin/정렬/표시 등 유틸 클래스
 * ----------------------------------------------------- */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* -------------------------------------------------------
 * 3) 테마/커스텀 CSS는 "무조건 마지막"에!
 *    - 페이지별 CSS를 쓰더라도 전역 변수(ion-color 등)는 필요할 수 있음
 *    - ★ 요청에 따라 3000.css 전역 파일은 더 이상 불러오지 않습니다.
 * ----------------------------------------------------- */
import '@/theme/variables.css'   // 있다면 유지, 없다면 주석 처리하세요.
// import '@/assets/3000.css'    // ✅ 삭제(과거 백엔드 템플릿용 전역 CSS 미사용)

/* -------------------------------------------------------
 * 4) 진단 로그: CSS/환경 체크
 * ----------------------------------------------------- */
const isDev = import.meta.env.DEV
console.log(`🚀 Booting tzchat... (env: ${isDev ? 'DEV' : 'PROD'})`)
console.log('🌐 location:', window.location.href)

// 핵심 CSS가 로드되었는지 간단 체크(ion-button의 display 값을 본다)
function checkIonicHydration() {
  const probe = document.createElement('ion-button')
  document.body.appendChild(probe)
  const cs = window.getComputedStyle(probe)
  console.log('🔎 ion-button display:', cs.display, '(정상 예: inline-block 또는 inline-flex)')
  probe.remove()
}

// CSS 변수(테마)가 적용되었는지 확인(주로 variables.css가 먹었는지)
function logPrimaryColorVar() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary')
  console.log('🎨 --ion-color-primary:', v || '(빈 값)')
}

// 로딩된 CSS link/script 개요 출력(배포 시 /assets/*.css 확인용)
function logLoadedAssets() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
  const scripts = Array.from(document.querySelectorAll('script'))
  console.log('📄 stylesheets:', links.map(l => (l as HTMLLinkElement).href))
  console.log('📜 scripts:', scripts.map(s => (s as HTMLScriptElement).src || '(inline/module)'))
}

/* -------------------------------------------------------
 * 5) 앱 부트스트랩
 * ----------------------------------------------------- */
const app = createApp(App)
app.use(IonicVue)
app.use(router)

router.isReady().then(async () => {
  app.mount('#app')
  console.log('✅ Vue + Ionic mounted.')

  // DOM이 정착된 뒤 진단
  await nextTick()
  logLoadedAssets()
  checkIonicHydration()
  logPrimaryColorVar()

  // 샘플 ion 컴포넌트 실제 생성해 hydration 상태 확인(경고 포함)
  setTimeout(() => {
    const temp = document.createElement('div')
    temp.innerHTML = `
      <ion-list>
        <ion-item>probe</ion-item>
      </ion-list>
    `
    document.body.appendChild(temp)
    const probes = temp.querySelectorAll<HTMLElement>('ion-list, ion-item')
    const hydrated = Array.from(probes).map(el =>
      el.classList.contains('hydrated')
    )
    console.log('🧪 hydrated flags:', hydrated)
    const anyNotHydrated = hydrated.some(h => !h)
    if (anyNotHydrated) {
      console.warn('⛔ 일부 Ionic 컴포넌트가 수화되지 않았습니다. Network 탭에서 CSS/JS 404 또는 CSP 차단을 확인하세요.')
    } else {
      console.log('👌 모든 샘플 컴포넌트가 hydrated 상태입니다.')
    }
    temp.remove()
  }, 300)
}).catch(err => {
  console.error('💥 router.isReady() 실패:', err)
})

/* -------------------------------------------------------
 * 6) 기본 글씨색(가독성 보장)
 *    - UA/다크모드 영향 방지
 * ----------------------------------------------------- */
document.documentElement.style.setProperty('--base-text-color', '#000')
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.color = 'black'
})
