<template>
  <div class="main-page">
    <router-view />
  </div>
</template>

<style scoped>
.main-page {
  position: relative;
  height: 100vh;
  overflow-y: auto;

  background-color: #f2f2f2;
  border: 2px solid red; /* 확인용 테두리 */
}
</style>