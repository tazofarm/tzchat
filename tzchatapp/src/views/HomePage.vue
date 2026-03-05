<template>
  <div class="home-page" aria-label="홈 레이아웃">
    <!-- ✅ 둘 다 마운트 유지하고, 보여주기만 전환 -->
    <div class="view-host" v-show="!isChatRoute">
      <HomeMain />
    </div>

    <div class="view-host" v-show="isChatRoute">
      <HomeChat />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import HomeMain from './HomeMain.vue'
import HomeChat from './HomeChat.vue'

const route = useRoute()

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
</script>

<style scoped>
.home-page {
  height: 100dvh;
  min-height: 0;
  display: block;
  background: #070707;
}

/* 두 뷰 모두 부모 높이를 꽉 채우도록 */
.view-host {
  height: 100%;
  min-height: 0;
}
</style>
