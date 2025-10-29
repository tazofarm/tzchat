<!-- src/components/.../HomeMain.vue -->
<template>
  <ion-page class="home-page">
    <!-- 스마트폰 상단 시계부분 -->
    <TopSpace height="1vh" />

    <!-- 추가 기능 넣을 공간 -->
    <USpace height="4vh" />

    <!-- 가운데 스크롤 영역 -->
    <MainPage class="main-area" />

    <!-- 상단 메뉴 -->
    <TopMenu />

    <!-- 스마트폰 하단 홈키부분 -->
    <Space height="10vh" />
  </ion-page>
</template>

<script setup>
import TopMenu from '../views_layout/TopMenu.vue'
import MainPage from '../views_layout/MainPage.vue'
import Space from '../views_layout/Space.vue'
import USpace from '../views_layout/USpace.vue'
import TopSpace from '../views_layout/topspace.vue'
</script>

<style scoped>
ion-page.home-page {
  height: 100dvh !important;
  display: grid;
  /* TopSpace / USpace / Main / TopMenu / Space */
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  background: #070707;
  color: #fff;
}

/* 메인(MainPage) 스크롤 가능 */
.main-area {
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
</style>
