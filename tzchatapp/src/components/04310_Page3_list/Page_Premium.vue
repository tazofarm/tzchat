<template>
  <div class="receive-only-wrapper">
    <!-- ✅ 상단 헤더: 받은 친구 신청 (N / 20) -->
    <div class="section-header" role="heading" aria-level="2">
      <ion-icon :icon="icons.mailOpenOutline" class="section-icon" aria-hidden="true" />
      <h3 class="section-title">
        받은 친구 신청
        <span class="count">({{ pendingCount }} / 20)</span>
      </h3>
    </div>

    <!-- ✅ 공통 리스트 컴포넌트 + 하단 액션 버튼 슬롯 -->
    <UserList
      :users="users"
      :isLoading="isLoading"
      emptyText="받은 친구 신청이 없습니다."
      @select="u => goToUserProfile(u._id)"
    >
      <!-- 각 유저 행 하단 버튼 -->
      <template #item-actions="{ user }">
        <ion-button
          size="default"
          color="primary"
          class="btn-gold-solid"
          :disabled="!reqByUserId[user._id]"
          @click.stop="onIntroClick(reqByUserId[user._id])"
        >인사말</ion-button>

        <ion-button
          size="default"
          color="success"
          class="btn-gold-solid"
          :disabled="!reqByUserId[user._id]"
          @click.stop="onAcceptClick(reqByUserId[user._id]?._id)"
        >수락</ion-button>

        <ion-button
          size="default"
          color="medium"
          class="btn-gold-outline"
          :disabled="!reqByUserId[user._id]"
          @click.stop="onRejectClick(reqByUserId[user._id]?._id)"
        >거절</ion-button>

        <ion-button
          size="default"
          color="danger"
          class="btn-gold-outline"
          :disabled="!reqByUserId[user._id]"
          @click.stop="onBlockClick(reqByUserId[user._id]?._id)"
        >차단</ion-button>
      </template>
    </UserList>
  </div>
</template>

<script setup>
/* -----------------------------------------------------------
   Received Only: '나에게 친구 신청한 사람' + 상단 카운트 + 하단 액션
   - 상단: 받은신청 수(pending) / 20
   - 하단: 소개/수락/거절/차단 버튼 (요청ID 필요 → userId→request 매핑 사용)
----------------------------------------------------------- */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import { IonButton, IonIcon } from '@ionic/vue'
import { mailOpenOutline } from 'ionicons/icons'

const router = useRouter()
const icons = { mailOpenOutline }

/* ===== 상태 ===== */
const users = ref([])                 // 화면 표시용 사용자 (받은신청 보낸 사람만)
const isLoading = ref(true)
const receivedRequests = ref([])      // 서버에서 받은 원본 요청 배열 (pending만 포함)
                                      // [{ _id, from, status:'pending', ... }, ...] 형태 기대

/* ===== 유틸 ===== */
const uniq = (arr = []) => Array.from(new Set(arr.map(String)))

function toTS(v) {
  if (!v) return 0
  try { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0 } catch { return 0 }
}
function sortByRecent(list) {
  return [...list].sort((a, b) => {
    const aTS = toTS(a.last_login || a.lastLogin || a.updatedAt || a.createdAt)
    const bTS = toTS(b.last_login || b.lastLogin || b.updatedAt || b.createdAt)
    return bTS - aTS
  })
}
/** UserList에서 기대하는 키로 정규화 */
function normalizeUser(u = {}) {
  const r1 =
    u.region1 ?? u.region1Name ?? u.regionName1 ?? u.city1 ?? u.area1 ??
    (Array.isArray(u.region) ? u.region[0] : undefined) ?? '/'
  const r2 =
    u.region2 ?? u.region2Name ?? u.regionName2 ?? u.city2 ?? u.area2 ??
    (Array.isArray(u.region) ? u.region[1] : undefined) ?? '/'

  const pref =
    u.preference ?? u.preferenceText ?? u.pref ?? u.trait ?? u.feature ??
    (Array.isArray(u.tags) ? u.tags.join(', ') : undefined) ?? '-'

  const lastLogin = u.last_login || u.lastLogin || u.updatedAt || u.createdAt

  return { ...u, region1: r1, region2: r2, preference: pref, last_login: lastLogin }
}

/* ===== 네비게이션 ===== */
const goToUserProfile = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}

/* ===== 받은신청 → 신청자 ID 수집 (모든 포맷 대응) ===== */
function extractPendingRequests(data) {
  const arr = Array.isArray(data) ? data
           : (Array.isArray(data?.requests) ? data.requests
           : (Array.isArray(data?.pending) ? data.pending
           : []))

  // 객체 배열만 필터 (문자열 배열인 경우는 아래 다른 경로에서 처리)
  const reqs = (arr || []).filter(r => r && typeof r === 'object')
  return reqs.filter(r => (r.status ?? 'pending') === 'pending')
}
function extractSenderIdsFromAny(data) {
  // 1) 표준/객체 경로
  const pendingReqs = extractPendingRequests(data)
  const ids1 = pendingReqs
    .map(r => (typeof r.from === 'object' ? r.from?._id : r.from))
    .filter(Boolean)
    .map(String)

  // 2) 단순 배열 경로 (ids / pendingIds / requests가 id 배열인 경우)
  const idList =
    (Array.isArray(data?.pendingIds) && data.pendingIds) ||
    (Array.isArray(data?.ids) && data.ids) ||
    (Array.isArray(data) && typeof data[0] !== 'object' && data) ||
    []
  const ids2 = idList.map(String)

  return uniq([...ids1, ...ids2])
}

/* ===== 사용자 조회: bulk → 개별, 최종 id 필터 ===== */
async function fetchUsersByIdsStrict(ids = []) {
  if (!ids.length) return []

  // bulk
  let bulkList = []
  try {
    const res = await api.post('/api/search/users', { ids })
    bulkList = Array.isArray(res?.data?.users) ? res.data.users
             : (Array.isArray(res?.data) ? res.data : [])
  } catch (e) {
    console.warn('[receive] bulk search failed, fallback to per-id:', e?.message || e)
  }

  if (Array.isArray(bulkList) && bulkList.length) {
    const set = new Set(ids.map(String))
    const filtered = bulkList.filter(u => u && set.has(String(u._id)))
    if (filtered.length === ids.length) return filtered
    // 의심스러운 경우 개별 조회로 보강
  }

  // per-id
  const results = await Promise.all(ids.map(async id => {
    try {
      const r = await api.get(`/api/users/${id}`)
      return r?.data?.user || r?.data || null
    } catch { return null }
  }))
  return results.filter(Boolean)
}

/* ===== 상단 카운트 ===== */
const pendingCount = computed(() => receivedRequests.value.length)

/* ===== userId → request 매핑 (하단 버튼 활성화를 위해) ===== */
const reqByUserId = computed(() => {
  const m = Object.create(null)
  for (const r of receivedRequests.value) {
    const uid = typeof r?.from === 'object' ? r.from?._id : r?.from
    if (uid) m[String(uid)] = r
  }
  return m
})

/* ===== Actions ===== */
async function acceptFriendRequest (id) {
  if (!id) return
  await api.put(`/api/friend-request/${id}/accept`, {})
  // 요청/사용자 제거
  receivedRequests.value = receivedRequests.value.filter(x => x._id !== id)
  const uid = users.value.find(u => reqByUserId.value[u._id]?._id === id)?._id
  if (uid) users.value = users.value.filter(u => u._id !== uid)
}
async function rejectFriendRequest (id) {
  if (!id) return
  await api.put(`/api/friend-request/${id}/reject`, {})
  receivedRequests.value = receivedRequests.value.filter(x => x._id !== id)
  const uid = users.value.find(u => reqByUserId.value[u._id]?._id === id)?._id
  if (uid) users.value = users.value.filter(u => u._id !== uid)
}
async function blockFriendRequest (id) {
  if (!id) return
  await api.put(`/api/friend-request/${id}/block`, {})
  receivedRequests.value = receivedRequests.value.filter(x => x._id !== id)
  const uid = users.value.find(u => reqByUserId.value[u._id]?._id === id)?._id
  if (uid) users.value = users.value.filter(u => u._id !== uid)
}

/* 버튼 핸들러(템플릿 바인딩용) */
const onIntroClick  = (requestObj) => {
  // 소개 버튼 클릭 시 동작 (모달/시트 띄우기 등)
  // 필요 시 Modal 컴포넌트 연동 가능. 여기서는 콘솔만 남깁니다.
  console.log('[intro] open for request:', requestObj?._id)
}
const onAcceptClick = (payload) => acceptFriendRequest(typeof payload === 'string' ? payload : payload?._id)
const onRejectClick = (payload) => rejectFriendRequest(typeof payload === 'string' ? payload : payload?._id)
const onBlockClick  = (payload) => blockFriendRequest(typeof payload === 'string' ? payload : payload?._id)

/* ===== 초기 로딩 ===== */
onMounted(async () => {
  try {
    isLoading.value = true

    // 1) 받은 친구 신청 목록 가져오기
    const res = await api.get('/api/friend-requests/received')

    // 2) pending만 남겨 보관 (상단 카운트/버튼용 원본)
    const pendingReqs = extractPendingRequests(res?.data)
    receivedRequests.value = pendingReqs

    // 3) 신청자 id 수집
    const senderIds = extractSenderIdsFromAny(res?.data)
    if (!senderIds.length) {
      users.value = []
      return
    }

    // 4) 해당 id 유저들만 강제 조회(+최종 id 필터)
    const raw = await fetchUsersByIdsStrict(senderIds)
    const set = new Set(senderIds.map(String))
    const strictFinal = raw.filter(u => u && set.has(String(u._id)))

    // 5) 정규화 + 정렬
    users.value = sortByRecent(strictFinal.map(normalizeUser))
  } catch (e) {
    console.error('❌ 받은신청 전용 리스트 로딩 실패:', e)
    users.value = []
    receivedRequests.value = []
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
/* 상단 헤더 */
.section-header{
  display:flex; align-items:center; gap:10px;
  padding:8px 10px; margin:4px 0 10px;
  border-left:4px solid var(--gold, #d4af37);
  background:#0f0f0f; border-radius:10px;
  box-shadow: inset 0 0 0 1px rgba(212,175,55,.08);
}
.section-title{
  display:flex; align-items:center; gap:8px;
  margin:0; color:var(--gold, #d4af37); font-weight:800;
  font-size:15px;
}
.section-icon{ font-size:18px; color:var(--gold, #d4af37); }
.count{ font-weight:800; color:var(--gold-weak, #e6c964); }

/* 버튼 크기/폰트/라운드(두 클래스 모두에 적용) */
.btn-gold-solid,
.btn-gold-outline {
  --height: 18px;      /* ✅ 버튼 높이 지정 (원하는 값으로 조절 가능) */
  --border-radius: 12px;   /* 모서리 둥글기 */
  --padding-start: 1px;   /* 좌우 여백 */
  --padding-end: 1px;
  --padding-top: 0;
  --padding-bottom: 0;

  font-size: 12px;         /* 글씨 크기 */
  font-weight: 800;
  min-width: 65px;         /* 최소 폭 */
  min-height :30px;
  
  /* 기존 색상 유지 */
  --background: linear-gradient(135deg, var(--gold, #d4af37), var(--gold-strong, #b18f1a));
  --color: #000;
}

/* 윤곽형 버튼(거절, 차단 등)도 동일 높이 유지 */
.btn-gold-outline {
  --background: transparent;
  --color: var(--gold-weak, #e6c964);
  border: 1.5px solid var(--gold, #d4af37);
}

:deep(.actions-bar) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;            /* 버튼 사이 간격 */
  padding: 0px 0;       /* ✅ 위아래 여백 (기존 10px 정도였다면 줄이거나 늘이세요) */
}

/* 배경(페이지 컨텍스트에 맞춰 최소만 지정) */
:root, :host{ --bg:#0b0b0d; --text:#d7d7d9; }
.receive-only-wrapper{ color:var(--text); }


</style>
