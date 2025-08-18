<template>
  <div class="card">
    <div class="head">
      <h3>00100 · 서버 연결 점검 (Heartbeat)</h3>
      <button class="btn" @click="checkHeartbeat">점검하기</button>
    </div>

    <div v-if="loading" class="note">점검 중...</div>
    <div v-if="errorText" class="error">{{ errorText }}</div>

    <div v-if="lastResult" class="body">
      <div><b>ok:</b> {{ lastResult.ok }}</div>
      <div><b>message:</b> {{ lastResult.message }}</div>
      <div><b>serverTime:</b> {{ lastResult.serverTime }}</div>
      <div><b>latency(ms):</b> {{ lastLatency }}</div>
    </div>
  </div>
</template>

<script setup>
// Heartbeat 버튼 하나로 /api/admin/heartbeat 호출
// - 반드시 로그인 + role=master 계정이어야 200 OK (아니면 401/403)
// - 부모에게 latency(ms) 이벤트로 전달

import { ref } from 'vue';

const emit = defineEmits(['latency']);

const lastResult = ref(null);
const errorText = ref('');
const loading = ref(false);
const lastLatency = ref(null);

async function checkHeartbeat() {
  const t0 = Date.now();
  lastResult.value = null;
  errorText.value = '';
  loading.value = true;

  try {
    console.log('[ADMIN] call /api/admin/heartbeat ...');
    const r = await fetch('/api/admin/heartbeat', { credentials: 'include' });
    const ms = Date.now() - t0;

    if (!r.ok) {
      console.warn('[ADMIN] heartbeat not ok', r.status);
      errorText.value = `heartbeat 실패 (status ${r.status})`;
      lastLatency.value = ms;
      emit('latency', ms);
      return;
    }

    const data = await r.json();
    lastResult.value = data;
    lastLatency.value = ms;
    emit('latency', ms);
    console.log('[ADMIN] heartbeat success', { ms, data });
  } catch (e) {
    console.error('[ADMIN] heartbeat error', e);
    errorText.value = '네트워크 오류';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.card { border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; color:black; }
.head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.btn { background:none; border:1px solid #333; padding:6px 10px; border-radius:8px; color:black; cursor:pointer; }
.note { color:#555; font-size:13px; margin-top:8px; }
.error { color:#b00020; margin-top:8px; }
.body { margin-top:8px; line-height:1.6; }
</style>
