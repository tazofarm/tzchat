<!-- src/components/.../HomeMain.vue -->
<template>
  <IonPage>
    <!-- 상단 영역 -->
    <IonHeader :translucent="true">
      <div class="top-wrap">
        <TopSpace height="6vh" />
        <TopPoint height="4vh" />
      </div>
    </IonHeader>

    <!-- 가운데 스크롤 영역: IonContent 단일 책임 (fullscreen 제거) -->
    <IonContent class="content">
      <MainPage />
    </IonContent>

    <!-- 하단 고정 영역 -->
    <IonFooter :translucent="true">
      <div class="bottom-wrap">
        <TopMenu />
        <Space height="10vh" />
      </div>
    </IonFooter>
  </IonPage>
</template>

<script setup>
import { IonPage, IonHeader, IonContent, IonFooter } from '@ionic/vue'
import TopMenu from '../views_layout/TopMenu.vue'
import MainPage from '../views_layout/MainPage.vue'
import Space from '../views_layout/Space.vue'
import TopPoint from '../views_layout/TopPoint.vue'
import TopSpace from '../views_layout/topspace.vue'
</script>

<style scoped>
/* IonContent 배경 */
.content {
  --background: #121212;
}

/* 상단/하단 컨테이너 (필요 시 패딩만) */
.top-wrap,
.bottom-wrap {
  background: #070707;
  color: #fff;
}

/* iOS/Android 모두에서 안전 영역 처리 */
:deep(ion-header),
:deep(ion-footer) {
  background: #070707;
}

/* TopMenu가 항상 보이도록 별도 오버플로우 금지 */
.bottom-wrap {
  padding: 0;
}
</style>
