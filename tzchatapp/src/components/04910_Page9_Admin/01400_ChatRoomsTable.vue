<!-- src/components/04910_Page9_Admin/01400_ChatRoomsTable.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>01400 · 채팅방 목록</h3>
      <button class="btn" @click="load">새로고침</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div class="table-wrap" v-if="!loading && rooms.length">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th><th>참여자 수</th><th>메시지 수</th><th>갱신</th><th>액션</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rooms" :key="r._id">
            <td>{{ r._id }}</td>
            <td>{{ r.participants?.length || 0 }}</td>
            <td>{{ r.messages?.length || 0 }}</td>
            <td>{{ r.updatedAt }}</td>
            <td>
              <button class="btn danger" @click="remove(r)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && !rooms.length" class="note">데이터 없음</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const loading=ref(false), error=ref(''), rooms=ref([]);

async function load(){
  loading.value=true; error.value='';
  try{
    console.log('[ADMIN] GET /api/admin/chatrooms');
    const r=await fetch('/api/admin/chatrooms',{credentials:'include'});
    if(!r.ok){ error.value=`조회 실패 (${r.status})`; return; }
    const data=await r.json();
    rooms.value=data.rooms||[];
  }catch(e){ console.error(e); error.value='네트워크 오류'; }
  finally{ loading.value=false; }
}
async function remove(room){
  if(!confirm('삭제하시겠습니까?')) return;
  try{
    const r=await fetch(`/api/admin/chatrooms/${room._id}`,{method:'DELETE',credentials:'include'});
    if(!r.ok){ alert('삭제 실패'); return; }
    load();
  }catch(e){ console.error(e); }
}
onMounted(load);
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.btn.danger{border-color:#b00020}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
.table-wrap{overflow:auto;border:1px solid #eee;border-radius:8px;margin-top:8px;}
.table{width:100%;border-collapse:collapse;min-width:720px;}
th,td{border-bottom:1px solid #eee;padding:8px 10px;text-align:left;color:black;}
</style>
