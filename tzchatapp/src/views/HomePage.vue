<template>
  <ion-page style="height: calc(100vh - 60px);">
    <TopMenu />
    <MainPage />
    <BottomMenu />
  </ion-page>
</template>

<script setup>
import { IonPage } from '@ionic/vue'
import TopMenu from '@/components/02050_layout/TopMenu.vue'
import MainPage from '@/components/02050_layout/MainPage.vue'
import BottomMenu from '@/components/02050_layout/BottomMenu.vue'
</script>

