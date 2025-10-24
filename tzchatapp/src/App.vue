<!-- src/App.vue -->
<template>
  <!-- ✅ 골드 테마 + 공통 레이아웃(app-root) 활성화 -->
  <ion-app class="theme-gold app-root">
    <router-view />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp } from '@ionic/vue'
import { setupAndroidBackButton } from './lib/backButton' // 상대 경로 유지

// ✅ 안드로이드 시스템 취소(뒤로) 버튼 처리: setup() 시점에 즉시 등록
setupAndroidBackButton()
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
