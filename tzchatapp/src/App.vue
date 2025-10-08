<template>
  <!-- ✅ 골드 테마 활성화 -->
  <ion-app class="theme-gold">
    <router-view />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp } from '@ionic/vue'
// ※ AgreementModal, require-consent 리스너, /me·동의 상태 조회 모두 제거
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
