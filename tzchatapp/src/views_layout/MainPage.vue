<template>
  <div class="main-page">
    <router-view />
  </div>
</template>

<style scoped>
.main-page {
  position: relative;

  height: 100%;
  min-height: 0;

  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;

  /* ✅ 블랙+골드 테마에 맞춤 */
  background-color: #121212; /* 다크 베이스 */
  /* border: 2px solid red; */ /* 디버그 완료 후 제거 */

  padding: 8px;
}

/* 스크롤바 (다크톤) */
.main-page { scrollbar-width: thin; scrollbar-color: #666 transparent; }
.main-page::-webkit-scrollbar { width: 6px; height: 6px; }
.main-page::-webkit-scrollbar-thumb { background: #666; border-radius: 4px; }

@media (max-width: 360px) {
  .main-page { padding: 6px; }
}
</style>
