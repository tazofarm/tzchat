<!-- src/components/04910_Page9_Admin/01100_NoticeManager.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>01100 · 공지 관리</h3>
      <button class="btn" @click="load">새로고침</button>
    </div>

    <div class="row">
      <input class="input" v-model="form.title" placeholder="제목" />
      <input class="input" v-model="form.body" placeholder="내용" />
      <label class="ck"><input type="checkbox" v-model="form.isActive" /> 활성</label>
      <button class="btn" @click="create">추가</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-for="n in notices" :key="n._id" class="item">
      <div class="meta">
        <b>{{ n.title }}</b>
        <span class="dim">({{ n.isActive ? 'ON' : 'OFF' }})</span>
        <span class="dim">/ {{ n.createdAt }}</span>
      </div>
      <div class="body">{{ n.body }}</div>
      <div class="btns">
        <button class="btn" @click="toggle(n)">{{ n.isActive ? '비활성' : '활성' }}</button>
        <button class="btn danger" @click="remove(n)">삭제</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
const notices = ref([]);
const loading = ref(false);
const error = ref('');
const form = ref({ title: '', body: '', isActive: true });

async function load() {
  loading.value = true; error.value='';
  try {
    console.log('[ADMIN] GET /api/admin/notices');
    const r = await fetch('/api/admin/notices', { credentials: 'include' });
    if (!r.ok) { error.value = `실패 (${r.status})`; return; }
    const data = await r.json();
    notices.value = data.notices || [];
  } catch (e) { console.error(e); error.value='네트워크 오류'; }
  finally { loading.value = false; }
}
async function create() {
  try {
    const r = await fetch('/api/admin/notices', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form.value)
    });
    if (!r.ok) { alert('추가 실패'); return; }
    form.value = { title:'', body:'', isActive:true };
    load();
  } catch(e){ console.error(e); }
}
async function toggle(n) {
  try {
    const r = await fetch(`/api/admin/notices/${n._id}`, {
      method:'PUT', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...n, isActive: !n.isActive })
    });
    if (!r.ok) { alert('수정 실패'); return; }
    load();
  } catch(e){ console.error(e); }
}
async function remove(n) {
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    const r = await fetch(`/api/admin/notices/${n._id}`, { method:'DELETE', credentials:'include' });
    if (!r.ok) { alert('삭제 실패'); return; }
    load();
  } catch(e){ console.error(e); }
}
onMounted(load);
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.row{display:flex;gap:8px;align-items:center;margin:8px 0;}
.input{flex:1;border:1px solid #bbb;border-radius:8px;padding:8px;color:black;}
.ck{display:flex;align-items:center;gap:6px}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.btn.danger{border-color:#b00020}
.item{border:1px solid #eee;border-radius:8px;padding:10px;margin-top:8px}
.meta{display:flex;gap:8px;align-items:center}
.dim{color:#666;font-size:12px}
.body{margin-top:6px}
.btns{display:flex;gap:8px;margin-top:8px}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
</style>
