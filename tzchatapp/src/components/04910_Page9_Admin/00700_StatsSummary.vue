<template>
  <div class="card">
    <div class="head">
      <h3>00700 · 통계 요약</h3>
      <button class="btn" @click="refresh">새로고침</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="errorText" class="error">{{ errorText }}</div>

    <div class="grid" v-if="!loading">
      <div class="stat"><b>오늘 가입</b><span>{{ stats.todayJoin }}</span></div>
      <div class="stat"><b>주간 가입</b><span>{{ stats.weekJoin }}</span></div>
      <div class="stat"><b>긴급 매칭 ON</b><span>{{ stats.emergencyOn }}</span></div>
      <div class="stat"><b>총 회원</b><span>{{ stats.totalUsers }}</span></div>
    </div>

    <div class="hint">※ 현재는 더미 데이터. adminRouter에 통계 API 추가하면 연동 즉시 가능</div>
  </div>
</template>

<script setup>
// 통계 요약: 지금은 프론트 더미. 후속으로 /api/admin/stats 연동 예정
import { ref } from 'vue';

const loading = ref(false);
const errorText = ref('');
const stats = ref({
  todayJoin: '-',
  weekJoin: '-',
  emergencyOn: '-',
  totalUsers: '-',
});

async function refresh() {
  loading.value = true;
  errorText.value = '';
  try {
    console.log('[ADMIN] Stats refresh (dummy)');
    // TODO: 실제 API가 생기면 아래로 대체
    // const r = await fetch('/api/admin/stats', { credentials: 'include' });
    // if (!r.ok) { errorText.value = `통계 조회 실패 (status ${r.status})`; return; }
    // stats.value = await r.json();

    // 더미 데이터
    await new Promise(r => setTimeout(r, 300));
    stats.value = {
      todayJoin: 3,
      weekJoin: 21,
      emergencyOn: 1,
      totalUsers: 128,
    };
  } catch (e) {
    console.error('[ADMIN] Stats error', e);
    errorText.value = '네트워크 오류';
  } finally {
    loading.value = false;
  }
}

refresh();
</script>

<style scoped>
.card { border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; color:black; }
.head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.btn { background:none; border:1px solid #333; padding:6px 10px; border-radius:8px; color:black; cursor:pointer; }
.note { color:#555; font-size:13px; margin-top:8px; }
.error { color:#b00020; margin-top:8px; }
.grid { margin-top:8px; display:grid; grid-template-columns: repeat(4, minmax(120px,1fr)); gap:8px; }
.stat { border:1px solid #eee; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:6px; }
.stat > b { color:#222; }
.stat > span { color:black; font-size:18px; font-weight:700; }
.hint { margin-top:8px; font-size:12px; color:#666; }
</style>
