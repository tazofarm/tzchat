<!-- src/App.vue -->
<template>
  <!-- Ionic 컨테이너 -->
  <IonApp class="theme-gold app-root">
    <!-- 표준 RouterView 사용 (IonRouterOutlet 사용 안 함) -->
    <RouterView />
  </IonApp>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { IonApp } from '@ionic/vue'
import { RouterView } from 'vue-router'
import { setupAndroidBackButton, teardownAndroidBackButton } from './lib/backButton'

onMounted(() => {
  setupAndroidBackButton()
})
onBeforeUnmount(() => {
  teardownAndroidBackButton()
})
</script>

<style>
:root { color-scheme: light; }

html, body, #app, ion-app {
  height: 100%;
  margin: 0;
  -webkit-text-size-adjust: 100%;
  overscroll-behavior: none;
}

* { scrollbar-width: thin; scrollbar-color: #bbb transparent; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
</style>
