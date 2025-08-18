<template>
  <div class="card">
    <div class="head">
      <h3>00200 · 서버/세션 상태</h3>
      <button class="btn" @click="refresh">새로고침</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="errorText" class="error">{{ errorText }}</div>

    <div v-if="status" class="grid">
      <div class="item"><b>ok</b><span>{{ status.ok }}</span></div>
      <div class="item"><b>message</b><span>{{ status.message }}</span></div>
      <div class="item"><b>serverTime</b><span>{{ status.serverTime }}</span></div>
      <div class="item"><b>lastLatency(ms)</b><span>{{ lastLatency ?? '-' }}</span></div>
    </div>
  </div>
</template>

<script setup>
// 00200: 서버/세션 상태
// - /api/admin/heartbeat를 다시 호출하여 표시
// - 00100에서 계산된 latency는 props로 받아 참고 표시

import { ref, onMounted } from 'vue';

const props = defineProps({
  lastLatency: { type: Number, default: null }
});

const status = ref(null);
const errorText = ref('');
const loading = ref(false);

async function refresh() {
  loading.value = true;
  errorText.value = '';
  try {
    console.log('[ADMIN] ServerStatus refresh -> GET /api/admin/heartbeat');
    const r = await fetch('/api/admin/heartbeat', { credentials: 'include' });
    if (!r.ok) {
      errorText.value = `상태 조회 실패 (status ${r.status})`;
      console.warn('[ADMIN] ServerStatus not ok', r.status);
      return;
    }
    status.value = await r.json();
  } catch (e) {
    console.error('[ADMIN] ServerStatus error', e);
    errorText.value = '네트워크 오류';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.card { border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; color:black; }
.head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.btn { background:none; border:1px solid #333; padding:6px 10px; border-radius:8px; color:black; cursor:pointer; }
.note { color:#555; font-size:13px; margin-top:8px; }
.error { color:#b00020; margin-top:8px; }
.grid { margin-top:8px; display:grid; grid-template-columns: 160px 1fr; row-gap:6px; column-gap:12px; }
.item { display:contents; }
.item > b { color:#222; }
.item > span { color:black; word-break:break-all; }
</style>
