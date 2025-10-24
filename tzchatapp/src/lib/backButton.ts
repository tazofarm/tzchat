// src/lib/backButton.ts
// Android(하드웨어) 뒤로가기 처리 - Ionic/Capacitor/웹 공통 안전 가드 포함
import { useBackButton } from '@ionic/vue'
import { useIonRouter } from '@ionic/vue'
import { useRouter } from 'vue-router'

let registered = false

export function setupAndroidBackButton() {
  // 중복 등록 방지
  if (registered) return
  registered = true

  // ⚠️ 여기서는 절대 구조분해하지 말고, null 가드로 안전하게 접근
  const ionRouter = safeUseIonRouter()
  const vueRouter = safeUseVueRouter()

  // 우선순위 10: 앱 전역 기본 핸들러보다 먼저 개입
  useBackButton(10, (processNextHandler) => {
    // 1) Ionic 내부 스택에 이전 화면이 있으면 뒤로
    if (ionRouter && ionRouter.canGoBack()) {
      ionRouter.back()
      return
    }

    // 2) Vue Router 히스토리가 있으면 뒤로
    if (vueRouter) {
      // 히스토리가 충분하면 뒤로가기, 아니면 다음 핸들러
      if (window.history.length > 1) {
        vueRouter.back()
        return
      }
    }

    // 3) 모달/액션시트 등 다른 핸들러에게 넘김(기본 동작)
    processNextHandler()
  })
}

function safeUseIonRouter(): ReturnType<typeof useIonRouter> | null {
  try {
    const r = useIonRouter()
    return r ?? null
  } catch {
    return null
  }
}

function safeUseVueRouter() {
  try {
    const r = useRouter()
    return r ?? null
  } catch {
    return null
  }
}
