<template>
  <ion-app>
    <router-view />
  </ion-app>
</template>

<script setup>
import { IonApp } from '@ionic/vue'
</script>


<style>
/* 전체 높이 보장 (가끔 검정 화면 원인) */
html, body, #app, ion-app {
  height: 100%;
}
</style>