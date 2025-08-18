<!-- src/components/04910_Page9_Admin/01000_RoleManager.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>01000 · 권한/잠금 관리</h3>
    </div>

    <div v-if="!selectedUser" class="note">유저를 선택하세요.</div>

    <div v-else class="body">
      <div class="row"><b>현재 권한</b><span>{{ selectedUser.role }}</span></div>
      <div class="row"><b>잠금 상태</b><span>{{ selectedUser.suspended ? 'ON' : 'OFF' }}</span></div>

      <div class="btns">
        <button class="btn" @click="setRole('master')">승격: master</button>
        <button class="btn" @click="setRole('user')">강등: user</button>
        <button class="btn warn" @click="setSuspend(true)">계정 잠금</button>
        <button class="btn" @click="setSuspend(false)">잠금 해제</button>
        <button class="btn danger" @click="forceLogout">강제 로그아웃(플래그)</button>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="info" class="note">{{ info }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps({ selectedUser: { type: Object, default: null }});
const emit = defineEmits(['acted']);

const error = ref(''); const info = ref('');

watch(() => props.selectedUser, () => { error.value=''; info.value=''; });

async function setRole(role) {
  if (!props.selectedUser) return;
  error.value=''; info.value='';
  try {
    console.log('[ADMIN] PUT /api/admin/users/:id/role', role);
    const r = await fetch(`/api/admin/users/${props.selectedUser._id}/role`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    if (!r.ok) { error.value = `실패 (${r.status})`; return; }
    info.value = '권한 변경 완료';
    emit('acted', { action: 'setRole', role });
  } catch (e) { console.error(e); error.value='네트워크 오류'; }
}

async function setSuspend(suspended) {
  if (!props.selectedUser) return;
  error.value=''; info.value='';
  try {
    console.log('[ADMIN] PUT /api/admin/users/:id/suspend', suspended);
    const r = await fetch(`/api/admin/users/${props.selectedUser._id}/suspend`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended })
    });
    if (!r.ok) { error.value = `실패 (${r.status})`; return; }
    info.value = `잠금 ${suspended ? 'ON' : 'OFF'} 완료`;
    emit('acted', { action: 'suspend', suspended });
  } catch (e) { console.error(e); error.value='네트워크 오류'; }
}

async function forceLogout() {
  if (!props.selectedUser) return;
  error.value=''; info.value='';
  try {
    console.log('[ADMIN] POST /api/admin/users/:id/force-logout');
    const r = await fetch(`/api/admin/users/${props.selectedUser._id}/force-logout`, {
      method: 'POST', credentials: 'include'
    });
    if (!r.ok) { error.value = `실패 (${r.status})`; return; }
    const data = await r.json();
    info.value = data.message || '강제 로그아웃 플래그 설정';
    emit('acted', { action: 'forceLogout' });
  } catch (e) { console.error(e); error.value='네트워크 오류'; }
}
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.row{display:grid;grid-template-columns:140px 1fr;gap:8px;margin:6px 0;}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.btn.warn{border-color:#aa7700}
.btn.danger{border-color:#b00020}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
</style>
