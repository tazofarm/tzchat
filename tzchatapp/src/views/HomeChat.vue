<!-- src/components/.../HomeChat.vue -->
<template>
  <ion-page class="home-page">
    <!-- 채팅 전용: 단일 영역. 내부(MainChat)가 스크롤/키보드 인셋을 직접 관리 -->
    <MainChat class="main-area" />
  </ion-page>
</template>

<script setup>
import MainChat from '../views_layout/MainChat.vue'
</script>

<style scoped>
ion-page.home-page {
  height: 100dvh !important;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #070707;
  color: #fff;
}

/* MainChat이 부모를 꽉 채우고, 자체적으로 스크롤/인셋 제어 */
.main-area {
  flex: 1 1 auto;
  min-height: 0;
  /* 여기서는 스크롤을 막고, 실제 스크롤은 ChatroomPage 등 내부에서 담당 */
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
</style>
