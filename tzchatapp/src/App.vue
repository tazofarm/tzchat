<template>
  <ion-app>
    <router-view />
  </ion-app>
</template>

<script setup>
import { IonApp } from '@ionic/vue'
</script>

<style>
/* 혹시 다크테마 클래스가 붙는 경우를 대비해 라이트 우선 */
ion-app.light {
  background: #ffffff !important;
  color: #000000 !important;
}
</style>