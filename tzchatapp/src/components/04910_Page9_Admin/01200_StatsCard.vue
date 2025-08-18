<!-- src/components/04910_Page9_Admin/01200_StatsCard.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>01200 · 통계</h3>
      <button class="btn" @click="load">새로고침</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div class="grid" v-if="stats">
      <div class="stat"><b>총 회원</b><span>{{ stats.totalUsers }}</span></div>
      <div class="stat"><b>오늘 가입</b><span>{{ stats.todayJoin }}</span></div>
      <div class="stat"><b>긴급매칭 ON</b><span>{{ stats.emergencyOn }}</span></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const loading = ref(false), error = ref(''), stats = ref(null);

async function load() {
  loading.value = true; error.value = '';
  try {
    console.log('[ADMIN] GET /api/admin/stats');
    const r = await fetch('/api/admin/stats', { credentials: 'include' });
    if (!r.ok) { error.value = `조회 실패 (${r.status})`; return; }
    const data = await r.json();
    stats.value = data.stats;
  } catch (e) { console.error(e); error.value='네트워크 오류'; }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
.grid{display:grid;grid-template-columns:repeat(3, minmax(120px,1fr));gap:8px;margin-top:8px;}
.stat{border:1px solid #eee;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px}
.stat b{color:#222}
.stat span{font-size:18px;font-weight:700;color:black}
</style>
