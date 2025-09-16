<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home/setting"></ion-back-button>
        </ion-buttons>
        <ion-title>레거시 페이지</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="no-padding">
      <!-- ✅ 서버의 /legal 페이지를 iframe 으로 그대로 표시 -->
      <iframe
        :src="legalUrl"
        class="legacy-iframe"
        title="Legal Page"
        allowfullscreen
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent
} from '@ionic/vue'

// ✅ .env에서 백엔드 베이스 URL을 읽어와 /legal 로 고정 연결
// 예: VITE_API_BASE_URL=https://tzchat.tazocode.com
const base = import.meta.env.VITE_API_BASE_URL || 'https://tzchat.tazocode.com'
const legalUrl = `${String(base).replace(/\/$/, '')}/legal`
</script>

<style scoped>
.no-padding {
  /* Ionic 기본 패딩 제거 (iframe이 꽉 차도록) */
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

/* ✅ ion-content 영역을 가득 채우도록 절대배치 */
.legacy-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
