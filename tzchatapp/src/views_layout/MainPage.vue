<!-- src/components/.../MainPage.vue -->
<template>
  <div class="main-page">
    <router-view />
  </div>
</template>

<style scoped>
.main-page {
  /* ✅ IonContent(부모)가 스크롤을 담당하므로, 자식은 “딱 맞게”만 채운다 */
  flex: 1 1 auto;     /* ✅ 부모가 flex일 때 가장 안전 */
  min-height: 0;      /* ✅ 이게 없으면 자식이 커져서 스크롤/레이아웃 꼬임 원인 */

  position: relative;
  box-sizing: border-box;

  /* ✅ 여기서 스크롤 만들지 않기 (IonContent 단일 스크롤 유지) */
  overflow: hidden;

  /* 테마/패딩 */
  background-color: #121212;
  padding: 8px;
}

/* (옵션) 모바일 최소 패딩 유지 */
@media (max-width: 360px) {
  .main-page { padding: 6px; }
}
</style>
