<template>
  <div class="card">
    <div class="head">
      <h3>00600 · 클라이언트 로그 뷰어</h3>
      <button class="btn" @click="$emit('clear')">지우기 (부모에서 관리 시 사용)</button>
    </div>
    <div v-if="!logs || !logs.length" class="note">표시할 로그가 없습니다.</div>
    <div v-else class="list">
      <div v-for="(log, idx) in logs" :key="idx" class="line">
        <code class="ts">{{ log.at }}</code>
        <code class="lv">{{ log.level }}</code>
        <span class="msg">{{ log.msg }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// 부모가 수집한 로그를 단순 표시(성능 고려해 100~300개 정도 유지 권장)
defineProps({
  logs: { type: Array, default: () => [] }
});
</script>

<style scoped>
.card { border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; color:black; }
.head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.btn { background:none; border:1px solid #333; padding:6px 10px; border-radius:8px; color:black; cursor:pointer; }
.note { color:#555; font-size:13px; margin-top:8px; }
.list { margin-top:8px; display:flex; flex-direction:column; gap:6px; }
.line { display:flex; gap:8px; align-items:center; padding:6px 8px; border:1px solid #eee; border-radius:6px; }
.ts { color:#666; }
.lv { color:#333; font-weight:700; }
.msg { color:black; word-break:break-all; }
</style>
