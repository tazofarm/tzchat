<!-- src/components/04910_Page9_Admin/01100_NoticeManager.vue -->
<template>
  <div class="card">
    <!-- ✅ 상단 헤더 -->
    <div class="head">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
      <h3>01100 · 공지 관리</h3>
      <button class="btn" @click="load">새로고침</button>
    </div>

    <!-- ✅ 입력 영역 -->
    <div class="row">
      <input class="input" v-model="form.title" placeholder="제목" />
      <input class="input" v-model="form.body" placeholder="내용" />
      <label class="ck"><input type="checkbox" v-model="form.isActive" /> 활성</label>
      <button class="btn" @click="create">추가</button>
    </div>

    <!-- ✅ 상태 -->
    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <!-- ✅ 목록 -->
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const notices = ref([])
const loading = ref(false)
const error = ref('')
const form = ref({ title: '', body: '', isActive: true })

function goBack () {
  console.log('[ADMIN] 뒤로가기 클릭')
  router.back()
}

async function load () {
  loading.value = true; error.value = ''
  try {
    console.log('[ADMIN] GET /api/admin/notices')
    const r = await fetch('/api/admin/notices', { credentials: 'include' })
    if (!r.ok) { error.value = `실패 (${r.status})`; return }
    const data = await r.json()
    notices.value = data.notices || []
  } catch (e) {
    console.error(e); error.value = '네트워크 오류'
  } finally { loading.value = false }
}

async function create () {
  try {
    const r = await fetch('/api/admin/notices', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    if (!r.ok) { alert('추가 실패'); return }
    form.value = { title: '', body: '', isActive: true }
    load()
  } catch (e) { console.error(e) }
}

async function toggle (n) {
  try {
    const r = await fetch(`/api/admin/notices/${n._id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...n, isActive: !n.isActive })
    })
    if (!r.ok) { alert('수정 실패'); return }
    load()
  } catch (e) { console.error(e) }
}

async function remove (n) {
  if (!confirm('삭제하시겠습니까?')) return
  try {
    const r = await fetch(`/api/admin/notices/${n._id}`, { method: 'DELETE', credentials: 'include' })
    if (!r.ok) { alert('삭제 실패'); return }
    load()
  } catch (e) { console.error(e) }
}

onMounted(load)
</script>

<style scoped>
/* ✅ 다크 테마 + 흰색 글씨 + 모바일 대응 */
.card {
  border: 1px solid #444;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  color: #fff;
  background-color: #1e1e1e;
}

/* 상단 헤더 */
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.head h3 {
  font-size: clamp(16px, 4vw, 18px);
  margin: 0;
  font-weight: 700;
}

.back-btn,
.btn {
  background: none;
  border: 1px solid #666;
  padding: 8px 12px;
  border-radius: 8px;
  color: #fff;
  font-size: clamp(14px, 4vw, 16px);
  cursor: pointer;
}
.back-btn:hover,
.btn:hover { background: #333; }
.btn.danger { border-color: #b00020 }

/* 입력 행 */
.row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
  flex-wrap: wrap;
}
.input {
  flex: 1;
  border: 1px solid #555;
  border-radius: 8px;
  padding: 8px;
  color: #fff;
  background: #121212;
  font-size: clamp(14px, 3.8vw, 16px);
}
.input::placeholder { color: #9a9a9a; }
.ck { display: flex; align-items: center; gap: 6px; font-size: clamp(13px,3.5vw,15px); }

/* 아이템 */
.item {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px;
  margin-top: 10px;
  background: #161616;
}
.meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.dim { color: #aaa; font-size: clamp(12px,3.2vw,13px); }
.body { margin-top: 6px; color: #fff; font-size: clamp(14px,3.8vw,16px); }
.btns { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }

/* 상태 */
.note { color: #bbb; font-size: clamp(13px,3.5vw,15px); margin-top: 8px; }
.error { color: #ff6b6b; margin-top: 8px; }
</style>
