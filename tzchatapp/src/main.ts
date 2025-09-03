// src/main.ts
import { createApp, nextTick } from 'vue'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import router from './router'

// 🔔 Web/PWA 푸시 등록 (신규 추가)
import { registerWebPush } from './push/webPush'

/* -------------------------------------------------------
 * ✅ Ionicons: 아이콘 등록 (중요)
 * ----------------------------------------------------- */
import { addIcons } from 'ionicons'
import {
  warningOutline,
  locateOutline,        // ✅ bullseyeOutline 대체 아이콘
  peopleOutline,
  chatbubblesOutline,
  personCircleOutline,
  settingsOutline,
} from 'ionicons/icons'

// 아이콘 등록(필요한 것만)
addIcons({
  warningOutline,
  locateOutline,        // ✅ 교체 반영
  peopleOutline,
  chatbubblesOutline,
  personCircleOutline,
  settingsOutline,
})
console.log(
  '🧩 Ionicons registered:',
  Object.keys({
    warningOutline,
    locateOutline,
    peopleOutline,
    chatbubblesOutline,
    personCircleOutline,
    settingsOutline,
  })
)

/* -------------------------------------------------------
 * 1) Ionic 필수/기본 CSS
 * ----------------------------------------------------- */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* -------------------------------------------------------
 * 2) Ionic 유틸 CSS (선택)
 * ----------------------------------------------------- */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* -------------------------------------------------------
 * 3) 테마/커스텀 CSS는 마지막
 * ----------------------------------------------------- */
import '@/theme/variables.css'
import '@/theme/mobile-utilities.css'
// import '@/assets/3000.css'  // ✅ 사용 안 함

/* -------------------------------------------------------
 * 4) (중요) 이모지 픽커 웹컴포넌트 로드
 *    - 이 한 줄로 <emoji-picker>가 브라우저에 등록됩니다.
 * ----------------------------------------------------- */
import 'emoji-picker-element'
console.log('😀 emoji-picker-element loaded')

/* -------------------------------------------------------
 * 5) 진단 로그
 * ----------------------------------------------------- */
const isDev = import.meta.env.DEV
console.log(`🚀 Booting tzchat... (env: ${isDev ? 'DEV' : 'PROD'})`)
console.log('🌐 location:', window.location.href)

// 핵심 CSS가 로드되었는지 간단 체크(ion-button의 display 값을 본다)
function checkIonicBasicStyle() {
  const probe = document.createElement('ion-button')
  document.body.appendChild(probe)
  const cs = window.getComputedStyle(probe)
  console.log('🔎 ion-button display:', cs.display, '(정상 예: inline-block/inline-flex)')
  probe.remove()
}

// CSS 변수(테마)가 적용되었는지 확인
function logPrimaryColorVar() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary')
  console.log('🎨 --ion-color-primary:', v || '(빈 값)')
}

// 로딩된 CSS/JS 개요 출력
function logLoadedAssets() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
  const scripts = Array.from(document.querySelectorAll('script'))
  console.log('📄 stylesheets:', links.map(l => (l as HTMLLinkElement).href))
  console.log('📜 scripts:', scripts.map(s => (s as HTMLScriptElement).src || '(inline/module)'))
}

/* -------------------------------------------------------
 * (개선) Ionic hydration 체크
 * ----------------------------------------------------- */
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
    tags.reduce(
      (acc, tag, i) => ({ ...acc, [tag]: hydratedFlags[i] ?? false }),
      {} as Record<string, boolean>
    )
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
      console.warn('⏳ 수화가 아직 완료되지 않음. 300ms 후 재시도합니다...')
      await new Promise(r => setTimeout(r, 300))
      ok = await probeHydration(TAGS)
    }
    if (!ok) {
      console.warn('⚠️ 일부 Ionic 컴포넌트가 수화되지 않았습니다. Network 탭에서 CSS/JS 404 또는 CSP 차단을 확인하세요.')
    } else {
      console.log('👌 Ionic 컴포넌트가 정상적으로 hydrated 상태입니다.')
    }
  } catch (e) {
    console.warn('hydration 체크 중 오류:', e)
  }
}

/* -------------------------------------------------------
 * 6) 앱 부트스트랩
 * ----------------------------------------------------- */
const app = createApp(App)
app.use(IonicVue) // 필요 시 옵션: { mode: 'md' } 등
app.use(router)

/* -------------------------------------------------------
 * ⚠️ 커스텀 엘리먼트 인식 설정(빌드타임 처리)
 * - 이전에는 app.config.compilerOptions.isCustomElement에서 처리했으나
 *   현재는 vite의 @vitejs/plugin-vue 옵션(template.compilerOptions)로 이동했습니다.
 *   → 런타임 경고 방지 및 설정 일원화.
 * ----------------------------------------------------- */
console.log('[UI][RES]', { step: 'custom-element-rule', where: 'vite-plugin-vue(template.compilerOptions)' })

/* -------------------------------------------------------
 * 6-2) 🔔 WebPush 등록 (신규)
 *  - 앱 시작 시 1회만 호출
 *  - 권한 요청 → FCM 토큰 발급 → 서버 /api/push/register 로 전송
 *  - 실패해도 앱 부트는 계속 진행
 * ----------------------------------------------------- */
registerWebPush()
  .then(() => console.log('🔔 WebPush 등록 플로우 완료(요청/토큰/등록)'))
  .catch(err => console.error('💥 WebPush 등록 실패:', err))

router.isReady()
  .then(async () => {
    app.mount('#app')
    console.log('✅ Vue + Ionic mounted.')

    // DOM이 정착된 뒤 진단
    await nextTick()
    logLoadedAssets()
    checkIonicBasicStyle()
    logPrimaryColorVar()

    // (개선된) Hydration 체크
    await checkIonicHydrationSafe()

    // (검증) 커스텀 엘리먼트 등록 여부 로그
    console.log('🧩 customElements.has("emoji-picker"):', customElements.get('emoji-picker') ? 'YES' : 'NO')
  })
  .catch(err => {
    console.error('💥 router.isReady() 실패:', err)
  })

/* -------------------------------------------------------
 * 7) 기본 글씨색(가독성 보장)
 * ----------------------------------------------------- */
document.documentElement.style.setProperty('--base-text-color', '#000')
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.color = 'black'
})
