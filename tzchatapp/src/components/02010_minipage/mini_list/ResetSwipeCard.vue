<template>
  <div
    class="reset-card"
    role="button"
    tabindex="0"
    @click="onActivate"
    @keydown.enter.space.prevent="onActivate"
  >
    <div class="title">새로운 친구 보기</div>
    <div class="counter">({{ used }}/{{ limit }})</div>
  </div>
</template>

<script setup>
const props = defineProps({
  used: { type: Number, default: 0 },
  limit: { type: Number, default: 500 },
})
const emit = defineEmits(['activate'])

function onActivate() {
  emit('activate')
}
</script>

<style scoped>
.reset-card{
  width: min(94vw, 420px);
  height: min(78vh, 560px);
  border-radius: 16px;
  background:#111114;
  border:1px solid #2a2a2e;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:10px;
  outline: none;
}
.title{
  font-size:20px; font-weight:800; color:#f3f3f3;
}
.counter{
  font-size:14px; color:#bdbdc2;
}
.reset-card:focus{
  box-shadow: 0 0 0 3px rgba(58,58,63,.6);
}
</style>
