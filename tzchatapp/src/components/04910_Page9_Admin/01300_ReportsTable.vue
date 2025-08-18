<!-- src/components/04910_Page9_Admin/01300_ReportsTable.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>01300 · 신고 관리</h3>
      <button class="btn" @click="load">새로고침</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div class="table-wrap" v-if="!loading && reports.length">
      <table class="table">
        <thead>
          <tr>
            <th>시간</th><th>신고자</th><th>피신고자</th><th>사유</th><th>상태</th><th>액션</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reports" :key="r._id">
            <td>{{ r.createdAt }}</td>
            <td>{{ r.reporter?.nickname || r.reporter?.username }}</td>
            <td>{{ r.reported?.nickname || r.reported?.username }}</td>
            <td>{{ r.reason }}</td>
            <td>{{ r.status }}</td>
            <td class="actions">
              <button class="btn" @click="setStatus(r,'warned')">경고</button>
              <button class="btn warn" @click="setStatus(r,'blocked')">차단</button>
              <button class="btn" @click="setStatus(r,'dismissed')">무시</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && !reports.length" class="note">신고 없음</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const loading=ref(false), error=ref(''), reports=ref([]);

async function load(){
  loading.value=true; error.value='';
  try{
    console.log('[ADMIN] GET /api/admin/reports');
    const r = await fetch('/api/admin/reports',{credentials:'include'});
    if(!r.ok){ error.value=`조회 실패 (${r.status})`; return; }
    const data = await r.json();
    reports.value = data.reports||[];
  }catch(e){ console.error(e); error.value='네트워크 오류'; }
  finally{ loading.value=false; }
}
async function setStatus(rpt, status){
  try{
    const r = await fetch(`/api/admin/reports/${rpt._id}/status`,{
      method:'PUT', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status })
    });
    if(!r.ok){ alert('변경 실패'); return; }
    load();
  }catch(e){ console.error(e); }
}
onMounted(load);
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.btn.warn{border-color:#aa7700}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
.table-wrap{overflow:auto;border:1px solid #eee;border-radius:8px;margin-top:8px;}
.table{width:100%;border-collapse:collapse;min-width:800px;}
th,td{border-bottom:1px solid #eee;padding:8px 10px;text-align:left;color:black;}
.actions{display:flex;gap:6px}
</style>
