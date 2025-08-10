<template>
  <div class="bottom-menu">
    BottomMenu.vue
  </div>
</template>

<style scoped>
.bottom-menu {
  position: fixed;
  bottom: 10px; /* ✅ 바닥에서 10px 띄움 */
  left: 0;
  width: 100%;
  height: 50px;
  background-color: #4caf50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  border-radius: 10px;
}
</style>
