<template>
  <div class="card">
    <div class="head">
      <h3>00300 · 회원 검색</h3>
    </div>
    <div class="row">
      <input
        class="input"
        type="text"
        v-model.trim="q"
        placeholder="아이디/닉네임/지역 등 포함 검색(클라이언트 필터)"
        @keyup.enter="apply"
      />
      <button class="btn" @click="apply">검색</button>
      <button class="btn" @click="reset">초기화</button>
    </div>
    <div class="hint">※ 현재는 클라이언트 측 필터(간단 contains)이며, 서버측 필터 API와도 쉽게 연동 가능</div>
  </div>
</template>

<script setup>
// 검색어를 부모로 emit하여 00400_UserTable이 반영
import { ref } from 'vue';
const emit = defineEmits(['search']);
const q = ref('');

function apply() {
  console.log('[ADMIN] Search apply', q.value);
  emit('search', { q: q.value });
}
function reset() {
  q.value = '';
  console.log('[ADMIN] Search reset');
  emit('search', { q: '' });
}
</script>

<style scoped>
.card { border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; color:black; }
.head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.row { display:flex; gap:8px; align-items:center; }
.input { flex:1; border:1px solid #bbb; border-radius:8px; padding:8px; color:black; }
.btn { background:none; border:1px solid #333; padding:6px 10px; border-radius:8px; color:black; cursor:pointer; }
.hint { margin-top:8px; font-size:12px; color:#666; }
</style>
