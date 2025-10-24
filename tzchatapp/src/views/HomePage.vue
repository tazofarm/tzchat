<template>
  <ion-page class="home-page" aria-label="홈 레이아웃">
    
   <TopSpace height="8vh" /> <!-- ← 원하는 높이로 조절 --> 
    

    <!--<USpace height="6vh" />  ← 원하는 높이로 조절 --> 

    <!-- 가운데 스크롤 영역 -->
    <MainPage />

        <!-- 상단 메뉴 -->
    <TopMenu />

    <!-- 하단 여백 -->
    <Space height="10vh" /> <!-- ← 원하는 높이로 조절 -->

    <!-- 하단 메뉴 
    <BottomMenu />
-->


  </ion-page>
</template>

<script setup>
import { IonPage } from '@ionic/vue'
import TopMenu from '../views_layout/TopMenu.vue'
import MainPage from '../views_layout/MainPage.vue'
import BottomMenu from '../views_layout/BottomMenu.vue'
import Space from '../views_layout/Space.vue'
import USpace from '../views_layout/USpace.vue'
import TopSpace from '../views_layout/topspace.vue'

// 로그
console.log('[HomePage] layout: Top / Main / Space / Bottom')
</script>

<style scoped>
ion-page.home-page {
  height: 100dvh !important;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto; 
  /* auto: TopMenu / 1fr: MainPage / auto: Space / auto: BottomMenu */
  background: #070707;
  color: #000;
}

ion-page.home-page > *:nth-child(2) {
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

ion-page.home-page > *:first-child { border-bottom: 1px solid #070707; }
ion-page.home-page > *:last-child  { border-top: 1px solid #eee; }
</style>
