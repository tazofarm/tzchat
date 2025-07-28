<template>
  <ion-page style="height: calc(100vh - 60px);">
    <TopMenu />
    <MainPage />
    <BottomMenu />
  </ion-page>
</template>

<script setup>
import { IonPage } from '@ionic/vue'
import TopMenu from '@/components/layout/TopMenu.vue'
import MainPage from '@/components/layout/MainPage.vue'
import BottomMenu from '@/components/layout/BottomMenu.vue'
</script>

