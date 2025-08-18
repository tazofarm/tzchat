<template>
  <div class="card">
    <div class="head">
      <h3>00500 · 유저 액션</h3>
    </div>

    <div v-if="!selectedUser" class="note">테이블에서 유저를 선택하세요.</div>

    <div v-else class="body">
      <div class="row"><b>username</b><span>{{ selectedUser.username }}</span></div>
      <div class="row"><b>nickname</b><span>{{ selectedUser.nickname }}</span></div>
      <div class="row"><b>gender</b><span>{{ selectedUser.gender ?? '-' }}</span></div>
      <div class="row"><b>birthyear</b><span>{{ selectedUser.birthyear ?? '-' }}</span></div>

      <div class="btns">
        <button class="btn warn" @click="forceLogout">강제 로그아웃 (TODO)</button>
        <button class="btn danger" @click="block">차단 (TODO)</button>
        <button class="btn" @click="unblock">차단 해제 (TODO)</button>
        <button class="btn" @click="promote">관리자 승격 (role=master) (TODO)</button>
        <button class="btn" @click="demote">일반 사용자로 (role=user) (TODO)</button>
      </div>

      <div class="hint">※ API가 아직 없는 항목은 TODO로 로그만 출력(백엔드 라우터 추가 시 바로 연결 가능)</div>
    </div>
  </div>
</template>

<script setup>
// 선택된 유저에 대해 액션 수행
// - 현재 프로젝트에 바로 사용 가능한 API: 없음(이 영역은 관리자 전용 라우터로 추가 예정)
// - 지금은 TODO 로그 + 부모로 이벤트만 보냄

const props = defineProps({
  selectedUser: { type: Object, default: null }
});
const emit = defineEmits(['acted']);

function ensure() {
  if (!props.selectedUser) {
    alert('유저를 먼저 선택하세요.');
    return false;
  }
  return true;
}
function forceLogout() {
  if (!ensure()) return;
  // TODO: POST /api/admin/users/:id/force-logout
  console.warn('[ADMIN] TODO forceLogout', props.selectedUser.username);
  emit('acted', { action: 'forceLogout', user: props.selectedUser });
}
function block() {
  if (!ensure()) return;
  // TODO: PUT /api/admin/users/:id/block
  console.warn('[ADMIN] TODO block', props.selectedUser.username);
  emit('acted', { action: 'block', user: props.selectedUser });
}
function unblock() {
  if (!ensure()) return;
  // TODO: PUT /api/admin/users/:id/unblock
  console.warn('[ADMIN] TODO unblock', props.selectedUser.username);
  emit('acted', { action: 'unblock', user: props.selectedUser });
}
function promote() {
  if (!ensure()) return;
  // TODO: PUT /api/admin/users/:id/role { role: 'master' }
  console.warn('[ADMIN] TODO promote to master', props.selectedUser.username);
  emit('acted', { action: 'promote', user: props.selectedUser, role: 'master' });
}
function demote() {
  if (!ensure()) return;
  // TODO: PUT /api/admin/users/:id/role { role: 'user' }
  console.warn('[ADMIN] TODO demote to user', props.selectedUser.username);
  emit('acted', { action: 'demote', user: props.selectedUser, role: 'user' });
}
</script>

<style scoped>
.card { border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; color:black; }
.head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.note { color:#555; font-size:13px; margin-top:8px; }
.body { margin-top:8px; }
.row { display:grid; grid-template-columns: 140px 1fr; gap:8px; margin-bottom:6px; }
.btns { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.btn { background:none; border:1px solid #333; padding:6px 10px; border-radius:8px; color:black; cursor:pointer; }
.btn.warn { border-color:#aa7700; }
.btn.danger { border-color:#b00020; }
.hint { margin-top:8px; font-size:12px; color:#666; }
</style>
