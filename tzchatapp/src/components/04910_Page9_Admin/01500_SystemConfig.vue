<!-- src/components/04910_Page9_Admin/01500_SystemConfig.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>01500 · 시스템 설정</h3>
      <button class="btn" @click="load">새로고침</button>
    </div>

    <div class="row">
      <input class="input" v-model="editKey" placeholder="KEY (예: EMERGENCY_DURATION)" />
      <input class="input" v-model="editValue" placeholder="VALUE (문자/숫자/JSON)" />
      <button class="btn" @click="save">저장</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div class="table-wrap" v-if="!loading && items.length">
      <table class="table">
        <thead><tr><th>KEY</th><th>VALUE</th><th>수정</th></tr></thead>
        <tbody>
          <tr v-for="it in items" :key="it._id">
            <td>{{ it.key }}</td>
            <td><code>{{ stringify(it.value) }}</code></td>
            <td>
              <button class="btn" @click="pick(it)">편집</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && !items.length" class="note">항목 없음</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const items=ref([]), loading=ref(false), error=ref('');
const editKey=ref(''), editValue=ref('');

function stringify(v){ try{return JSON.stringify(v);}catch{return String(v)} }

async function load(){
  loading.value=true; error.value='';
  try{
    console.log('[ADMIN] GET /api/admin/config');
    const r=await fetch('/api/admin/config',{credentials:'include'});
    if(!r.ok){ error.value=`조회 실패 (${r.status})`; return; }
    const data=await r.json();
    items.value=data.items||[];
  }catch(e){ console.error(e); error.value='네트워크 오류'; }
  finally{ loading.value=false; }
}
function pick(it){
  editKey.value = it.key;
  editValue.value = stringify(it.value);
}
async function save(){
  if(!editKey.value) return alert('KEY를 입력하세요');
  try{
    let val;
    try{ val = JSON.parse(editValue.value); }catch{ val = editValue.value; }
    const r=await fetch(`/api/admin/config/${encodeURIComponent(editKey.value)}`,{
      method:'PUT', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ value: val })
    });
    if(!r.ok){ alert('저장 실패'); return; }
    editKey.value=''; editValue.value='';
    load();
  }catch(e){ console.error(e); }
}
onMounted(load);
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.row{display:flex;gap:8px;align-items:center;margin:8px 0;}
.input{flex:1;border:1px solid #bbb;border-radius:8px;padding:8px;color:black;}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
.table-wrap{overflow:auto;border:1px solid #eee;border-radius:8px;margin-top:8px;}
.table{width:100%;border-collapse:collapse;min-width:720px;}
th,td{border-bottom:1px solid #eee;padding:8px 10px;text-align:left;color:black;}
code{word-break:break-all}
</style>
