<template>
  <div class="card">
    <div class="head">
      <h3>00400 · 회원 목록</h3>
      <button class="btn" @click="load">새로고침</button>
    </div>

    <div v-if="loading" class="note">불러오는 중...</div>
    <div v-if="errorText" class="error">{{ errorText }}</div>

    <div class="table-wrap" v-if="!loading && users.length">
      <table class="table">
        <thead>
          <tr>
            <th>username</th>
            <th>nickname</th>
            <th>birthyear</th>
            <th>gender</th>
            <th>region1</th>
            <th>region2</th>
            <th>preference</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="u in filtered"
            :key="u._id"
            :class="{ selected: selected?. _id === u._id }"
            @click="select(u)"
            title="클릭하면 아래 액션패널에 선택됩니다"
          >
            <td>{{ u.username }}</td>
            <td>{{ u.nickname }}</td>
            <td>{{ u.birthyear ?? '-' }}</td>
            <td>{{ u.gender ?? '-' }}</td>
            <td>{{ u.region1 ?? '-' }}</td>
            <td>{{ u.region2 ?? '-' }}</td>
            <td>{{ u.preference ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && !users.length" class="note">데이터 없음</div>
  </div>
</template>

<script setup>
// /api/users (authRouter) 공개 API 사용
// - 필터는 클라이언트에서 간단 contains로 처리
// - 선택된 유저를 부모로 emit('selected', user)

import { ref, watch, computed, onMounted } from 'vue';

const props = defineProps({
  filters: { type: Object, default: () => ({ q: '' }) }
});
const emit = defineEmits(['selected']);

const users = ref([]);
const errorText = ref('');
const loading = ref(false);
const selected = ref(null);

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    console.log('[ADMIN] load /api/users');
    const r = await fetch('/api/users', { credentials: 'include' });
    if (!r.ok) {
      errorText.value = `목록 조회 실패 (status ${r.status})`;
      console.warn('[ADMIN] users not ok', r.status);
      return;
    }
    const data = await r.json();
    users.value = data?.users || [];
    console.log('[ADMIN] users loaded', users.value.length);
  } catch (e) {
    console.error('[ADMIN] users error', e);
    errorText.value = '네트워크 오류';
  } finally {
    loading.value = false;
  }
}

function select(u) {
  selected.value = u;
  console.log('[ADMIN] select user', u?.username);
  emit('selected', u);
}

const filtered = computed(() => {
  const q = (props.filters?.q || '').toLowerCase();
  if (!q) return users.value;
  return users.value.filter(u => {
    // 간단 contains 필터: username, nickname, region1/2, gender, preference 포함
    const s = [
      u.username, u.nickname, u.region1, u.region2, u.gender, u.preference
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return s.includes(q);
  });
});

watch(() => props.filters, () => {
  console.log('[ADMIN] filters changed', props.filters);
});

onMounted(() => {
  load();
});
</script>

<style scoped>
.card { border:1px solid #ddd; border-radius:10px; padding:12px; margin-bottom:12px; color:black; }
.head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.btn { background:none; border:1px solid #333; padding:6px 10px; border-radius:8px; color:black; cursor:pointer; }
.note { color:#555; font-size:13px; margin-top:8px; }
.error { color:#b00020; margin-top:8px; }
.table-wrap { overflow:auto; border:1px solid #eee; border-radius:8px; }
.table { width:100%; border-collapse:collapse; min-width:720px; }
th, td { border-bottom:1px solid #eee; padding:8px 10px; text-align:left; color:black; }
tr:hover { background:#fafafa; cursor:pointer; }
tr.selected { background:#f0f7ff; }
</style>
