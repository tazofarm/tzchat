// src/lib/backButton.ts
// Android(하드웨어) 뒤로가기 처리 - Ionic/Capacitor/웹 공통 안전 가드 포함
import { useBackButton, useIonRouter, modalController, actionSheetController, popoverController, alertController } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

let registered = false

export function setupAndroidBackButton() {
  if (registered) return
  registered = true

  const ionRouter = safeUseIonRouter()
  const vueRouter = safeUseVueRouter()

  // 우선순위 10: 앱 전역 기본 핸들러보다 먼저 개입
  useBackButton(10, async (processNextHandler) => {
    // 1) Ionic 내부 스택에 이전 화면이 있으면 뒤로
    if (ionRouter && ionRouter.canGoBack()) {
      ionRouter.back()
      return
    }

    // 2) Vue Router 히스토리가 있으면 뒤로
    if (vueRouter && window.history.length > 1) {
      vueRouter.back()
      return
    }

    // 3) 오버레이(모달/액션시트/팝오버/알럿)가 열려 있으면 닫기
    //    (Ionic은 뒤로가기 시 오버레이 우선 닫는 UX가 일반적)
    const topModal = await modalController.getTop()
    if (topModal) {
      await topModal.dismiss()
      return
    }
    const topSheet = await actionSheetController.getTop()
    if (topSheet) {
      await topSheet.dismiss()
      return
    }
    const topPopover = await popoverController.getTop()
    if (topPopover) {
      await topPopover.dismiss()
      return
    }
    const topAlert = await alertController.getTop()
    if (topAlert) {
      await topAlert.dismiss()
      return
    }

    // 4) 기타 사용자 정의 핸들러에게 기회 제공
    try {
      processNextHandler()
    } catch {
      // no-op
    }

    // 5) 더 이상 갈 곳이 없으면 (앱 루트) → 안드로이드 홈으로 나가기(네이티브)
    if (Capacitor.isNativePlatform()) {
      App.exitApp()
      return
    }

    // 6) 웹 환경 안전 가드: 마지막 시도로 브라우저 히스토리 뒤로
    if (window.history.length > 1) {
      window.history.back()
    }
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
