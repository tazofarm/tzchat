<template>
  <!-- ✅ 골드 테마 + 공통 레이아웃(app-root) 활성화 -->
  <ion-app class="theme-gold app-root">
    <router-view />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonApp, toastController } from '@ionic/vue'
import { App as CapApp } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'

const route = useRoute()
const router = useRouter()

// 메인 화면 판정: 프로젝트 라우트에 맞게 필요 시 수정
const isMainScreen = () => route.name === 'home' || route.path === '/'

// 두 번 눌러 종료 타이머
let lastBack = 0

// 리스너 핸들 저장 (언마운트 시 해제)
let backHandler: PluginListenerHandle | undefined

onMounted(async () => {
  backHandler = await CapApp.addListener('backButton', async () => {
    // 메인 화면이 아니면 일반 뒤로가기
    if (!isMainScreen()) {
      router.back()
      return
    }

    // 메인 화면: 두 번 눌러 종료
    const now = Date.now()
    if (now - lastBack < 1500) {
      await CapApp.exitApp()
      return
    }

    lastBack = now
    const toast = await toastController.create({
      message: '한 번 더 누르면 종료합니다.',
      duration: 1200,
      position: 'bottom'
    })
    await toast.present()
  })
})

onUnmounted(() => {
  backHandler?.remove()
})
</script>

<style>
/* ⚠️ 전역 스타일은 main.ts 에서
   variables.css → mobile-utilities.css → theme-gold.css
   순서로 이미 로드됩니다. (중복 @import 방지) */

:root { color-scheme: light; }

/* 기본 컨테이너 크기 안전장치 (app-root 가 100dvh 처리) */
html, body, #app, ion-app {
  height: 100%;
  margin: 0;
  -webkit-text-size-adjust: 100%;
  overscroll-behavior: none;
}

/* 스크롤바 얇게 */
* { scrollbar-width: thin; scrollbar-color: #bbb transparent; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }

/* 모션 최소화 선호 시 애니메이션 약화 */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
</style>
