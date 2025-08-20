<template>
  <ion-page>
    <!-- 상단 헤더 -->
    <ion-header>
      <ion-toolbar>
        <!-- 뒤로가기 버튼 -->
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            ←
          </ion-button>
        </ion-buttons>

        <!-- 가운데 제목 -->
        <ion-title>간단 페이지</ion-title>
      </ion-toolbar>
    </ion-header>

    <!-- 본문 -->
    <ion-content class="ion-padding">
      <p>여기는 간단한 페이지 본문 영역입니다.</p>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonTitle,
  IonContent
} from '@ionic/vue'
import { useRouter } from 'vue-router'

const router = useRouter()

/** 뒤로가기 동작 */
const goBack = () => {
  console.log('[SimplePage] 뒤로가기 클릭')
  router.back()
}
</script>

<style scoped>
/* 상단바를 좀 더 컴팩트하게 */
ion-toolbar {
  --background: var(--panel-2);   /* 다크 톤 */
  --color: var(--text);           /* 글자색 */
  padding: 0 6px;
}
ion-title {
  font-weight: 600;
}
</style>
