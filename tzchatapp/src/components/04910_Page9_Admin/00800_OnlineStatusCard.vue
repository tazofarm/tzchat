<!-- src/components/04910_Page9_Admin/00800_OnlineStatusCard.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>00800 · 온라인/방 현황</h3>
      <button class="btn" @click="refresh">새로고침</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="data" class="body">
      <div class="row"><b>소켓 수</b><span>{{ data.sockets }}</span></div>
      <div class="row"><b>온라인 유저</b><span>{{ data.onlineUsers.length }}</span></div>
      <div class="row">
        <b>방 현황</b>
        <div class="rooms">
          <div v-for="r in data.rooms" :key="r.roomId" class="badge">
            {{ r.roomId }} ({{ r.count }})
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const loading = ref(false);
const error = ref('');
const data = ref(null);

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    console.log('[ADMIN] GET /api/admin/online');
    const r = await fetch('/api/admin/online', { credentials: 'include' });
    if (!r.ok) { error.value = `조회 실패 (${r.status})`; return; }
    data.value = await r.json();
  } catch (e) {
    console.error(e);
    error.value = '네트워크 오류';
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
.row{display:grid;grid-template-columns:140px 1fr;gap:8px;margin:6px 0;}
.rooms{display:flex;gap:6px;flex-wrap:wrap}
.badge{border:1px solid #999;border-radius:999px;padding:2px 8px;}
</style>
