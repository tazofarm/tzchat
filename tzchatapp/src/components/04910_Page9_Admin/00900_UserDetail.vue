<!-- src/components/04910_Page9_Admin/00900_UserDetail.vue -->
<template>
  <div class="card">
    <div class="head">
      <h3>00900 · 회원 상세</h3>
      <button class="btn" @click="load" :disabled="!selectedUser">새로고침</button>
    </div>
    <div v-if="!selectedUser" class="note">위 테이블에서 유저를 선택하세요.</div>

    <div v-else>
      <div v-if="loading" class="note">불러오는 중...</div>
      <div v-if="error" class="error">{{ error }}</div>

      <div v-if="detail" class="grid">
        <div><b>아이디</b><span>{{ detail.username }}</span></div>
        <div><b>닉네임</b><span>{{ detail.nickname }}</span></div>
        <div><b>권한</b><span>{{ detail.role }}</span></div>
        <div><b>잠금</b><span>{{ detail.suspended ? 'ON' : 'OFF' }}</span></div>
        <div><b>생년</b><span>{{ detail.birthyear ?? '-' }}</span></div>
        <div><b>성별</b><span>{{ detail.gender ?? '-' }}</span></div>
        <div><b>지역</b><span>{{ detail.region1 }} / {{ detail.region2 }}</span></div>
        <div><b>특징</b><span>{{ detail.preference }}</span></div>
        <div><b>가입</b><span>{{ detail.createdAt }}</span></div>
        <div><b>마지막로그인</b><span>{{ detail.last_login ?? '-' }}</span></div>
        <div class="full">
          <b>자기소개</b>
          <div class="box">{{ detail.selfintro || '-' }}</div>
        </div>
        <div class="full">
          <b>친구</b>
          <div class="box small">
            <code v-for="f in detail.friendlist || []" :key="f._id">{{ f.nickname }} </code>
          </div>
        </div>
        <div class="full">
          <b>차단</b>
          <div class="box small">
            <code v-for="b in detail.blocklist || []" :key="b._id">{{ b.nickname }} </code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps({ selectedUser: { type: Object, default: null } });

const loading = ref(false);
const error = ref('');
const detail = ref(null);

async function load() {
  if (!props.selectedUser) return;
  loading.value = true; error.value = '';
  try {
    console.log('[ADMIN] GET /api/admin/users/:id', props.selectedUser._id);
    const r = await fetch(`/api/admin/users/${props.selectedUser._id}`, { credentials: 'include' });
    if (!r.ok) { error.value = `조회 실패 (${r.status})`; return; }
    const data = await r.json();
    detail.value = data.user;
  } catch (e) {
    console.error(e); error.value = '네트워크 오류';
  } finally {
    loading.value = false;
  }
}
watch(() => props.selectedUser?._id, () => load(), { immediate: true });
</script>

<style scoped>
.card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;color:black;}
.head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.btn{background:none;border:1px solid #333;padding:6px 10px;border-radius:8px;color:black;cursor:pointer;}
.note{color:#555;font-size:13px;margin-top:8px;}
.error{color:#b00020;margin-top:8px;}
.grid{display:grid;grid-template-columns: 160px 1fr;gap:8px;align-items:flex-start;margin-top:8px;}
.grid>div{display:contents}
.grid b{color:#222}
.grid span{color:black}
.full{grid-column:1/-1;display:block}
.box{border:1px solid #eee;border-radius:8px;padding:8px;white-space:pre-wrap}
.small code{margin-right:6px}
</style>
