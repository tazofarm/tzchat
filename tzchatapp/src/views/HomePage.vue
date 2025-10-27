<!-- src/components/.../HomePage.vue -->
<template>
  <ion-page
    class="home-page"
    :class="{ 'no-chrome': isChatRoute }"
    aria-label="홈 레이아웃"
  >
    <!-- ⬆️ 채팅 화면에서는 상단 여백/메뉴 숨김 -->
    <TopSpace height="8vh" />


    <!-- ⬆️ height="2vh" -->
    <USpace v-if="!isChatRoute" height="3vh" />

    <!-- 가운데 스크롤 영역 -->
    <MainPage />

    <!-- 상단 메뉴: 채팅 화면에서는 숨김-->
    <TopMenu v-if="!isChatRoute" /> 
    


    <!-- 하단 여백은 공통 유지 -->
    <Space height="10vh" />
  </ion-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { IonPage } from '@ionic/vue'

import TopMenu from '../views_layout/TopMenu.vue'
import MainPage from '../views_layout/MainPage.vue'
import Space from '../views_layout/Space.vue'
import USpace from '../views_layout/USpace.vue'
import TopSpace from '../views_layout/topspace.vue'

const route = useRoute()

/**
 * 채팅 관련 라우트에서는 상단 크롬(TopSpace/USpace/TopMenu)을 숨깁니다.
 * - 방법1: 메타 플래그 사용(meta.chat 또는 meta.noChrome)
 * - 방법2: 경로 패턴으로 판별(/chat, /chatroom, /room/:id 등)
 */
const isChatRoute = computed(() => {
  const meta = route.meta || {}
  if (meta.noChrome === true || meta.chat === true) return true
  const p = (route.path || '').toLowerCase()
  return p.startsWith('/home/chat') || p.includes('/home/chatroom') || p.includes('/home/room/')
})
</script>

<style scoped>
ion-page.home-page {
  height: 100dvh !important;
  display: grid;
  /* 기본: TopSpace/USpace, Main, TopMenu, Space */
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  background: #070707;
  color: #000;
}

/* 채팅 화면: 상단 크롬을 제거하고 행 수 축소 */
ion-page.home-page.no-chrome {
  grid-template-rows: minmax(0, 1fr) auto;
}

/* 가운데(MainPage) 스크롤 가능 */
ion-page.home-page > *:nth-child(2) {
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* 경계선(옵션) */
ion-page.home-page > *:first-child { border-bottom: 1px solid #070707; }
ion-page.home-page > *:last-child  { border-top: 1px solid #eee; }
</style>
