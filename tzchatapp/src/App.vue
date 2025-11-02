<!-- src/App.vue -->
<template>
  <!-- ✅ Ionic 컨테이너 -->
  <IonApp class="theme-gold app-root">
    <!-- ✅ 표준 RouterView 사용 (IonRouterOutlet 사용 안 함) -->
    <RouterView />
  </IonApp>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { IonApp } from '@ionic/vue'
import { RouterView } from 'vue-router'
import { setupAndroidBackButton, teardownAndroidBackButton } from './lib/backButton'

/** ✅ 안드로이드 하드웨어 뒤로가기: Ionic navManager 비의존 방식으로 등록 */
onMounted(() => { setupAndroidBackButton() })
onBeforeUnmount(() => { teardownAndroidBackButton() })
</script>

<style>
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
