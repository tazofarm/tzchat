<template>
  <!-- ✅ 골드 테마 활성화 -->
  <ion-app class="theme-gold">
    <router-view />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonApp, toastController } from '@ionic/vue'
import { App as CapApp } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core' // ✅ 타입은 core에서 가져옵니다

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
@import "@/theme/variables.css";
/* @import "@/theme/mobile-utilities.css"; */
@import "@/theme/theme-gold.css";

:root { color-scheme: light; }
html, body {
  height: 100%;
  min-height: 100dvh;
  margin: 0;
  background: var(--ion-background-color);
  color: var(--ion-text-color);
  overscroll-behavior: none;
  -webkit-text-size-adjust: 100%;
}
#app, ion-app {
  height: 100%;
  min-height: 100dvh;
  background: var(--ion-background-color);
  color: var(--ion-text-color);
}
#app > ion-app > * {
  height: 100%;
  min-height: 100%;
}
* { scrollbar-width: thin; scrollbar-color: #bbb transparent; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
</style>
