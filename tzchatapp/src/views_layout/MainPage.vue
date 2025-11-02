<!-- src/components/.../MainPage.vue -->
<template>
  <div class="main-page">
    <router-view />
  </div>
</template>

<style scoped>
.main-page {
  /* ✅ IonContent 내부 영역을 꽉 채움(자체 스크롤 없음) */
  position: relative;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  overflow: visible;

  /* ✅ 테마 (IonContent가 배경을 가지므로 이 값은 선택 사항) */
  background-color: #121212;
  padding: 8px;
}

/* (옵션) 모바일 최소 패딩 유지 */
@media (max-width: 360px) {
  .main-page { padding: 6px; }
}
</style>
