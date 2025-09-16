<template>
  <div class="bottom-menu">
    BottomMenu.vue
  </div>
</template>

<style scoped>
.bottom-menu {
  position: fixed;
  bottom: 8vh; /* 화면 바닥에서 10px 위 */
  left: 0;
  width: 100%;
  height: 50px;

  background-color: #4caf50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;

  z-index: 9999;

  /* 모서리 둥글게 */
  border-radius: 10px;

  /* 모바일 노치·홈버튼 영역 안전 패딩 */
  padding-bottom: env(safe-area-inset-bottom, 0px);

  /* 그림자 추가로 분리감 */
  box-shadow: 0 -2px 6px rgba(0,0,0,0.15);
}

</style>
