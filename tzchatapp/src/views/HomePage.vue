<!-- src/components/.../HomePage.vue -->
<template>
  <div class="home-page" aria-label="홈 레이아웃">
    <!-- ✅ 채팅 경로면 HomeChat, 아니면 HomeMain -->
    <component :is="currentView" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import HomeMain from './HomeMain.vue' // 일반 페이지(내부에 ion-page 포함)
import HomeChat from './HomeChat.vue' // 채팅 페이지(내부에 ion-page 포함)

const route = useRoute()

/**
 * 채팅 관련 라우트에서는 HomeChat을, 나머지는 HomeMain을 렌더링합니다.
 * - meta.noChrome === true 또는 meta.chat === true 면 채팅 화면으로 간주
 * - 경로 패턴: /home/chat*, /home/chatroom*, /home/room/*
 */
const isChatRoute = computed(() => {
  const meta = route.meta || {}
  if (meta.noChrome === true || meta.chat === true) return true
  const p = (route.path || '').toLowerCase()
  return (
    p.startsWith('/home/chat') ||
    p.includes('/home/chatroom') ||
    p.includes('/home/room/')
  )
})

/** 현재 보여줄 최상위 뷰 */
const currentView = computed(() => (isChatRoute.value ? HomeChat : HomeMain))
</script>

<style scoped>
.home-page {
  height: 100dvh;
  min-height: 0;
  display: block;
  background: #070707;
}

/* 렌더된 자식 뷰가 부모 높이를 꽉 채우도록 */
.home-page > * {
  height: 100%;
  min-height: 0;
}
</style>
