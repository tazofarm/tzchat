<template>
  <div class="sent-only-wrapper">
    <!-- ✅ 상단 헤더: 보낸 친구 신청 (N) -->
    <div class="section-header" role="heading" aria-level="2">
      <ion-icon :icon="icons.sendOutline" class="section-icon" aria-hidden="true" />
      <h3 class="section-title">
        보낸 친구 신청
        <span class="count">({{ pendingCount }})</span>
      </h3>
    </div>

    <!-- ✅ 공통 리스트 + 하단 액션(취소/차단)
         ✅ 프리미엄회원 가림을 위해 viewer-level / is-premium 전달 -->
    <UserList
      :users="users"
      :isLoading="isLoading"
      :viewer-level="viewerLevel"
      :is-premium="isPremium"
      emptyText="보낸 친구 신청이 없습니다."
      @select="u => goToUserProfile(u._id)"
    >
      <template #item-actions="{ user }">
        <ion-button
          size="small"
          color="medium"
          class="btn-gold-outline"
          :disabled="!reqByUserId[user._id]"
          @click.stop="onCancelClick(reqByUserId[user._id]?._id)"
        >신청 취소</ion-button>

        <!-- ✅ 차단은 FriendRequest의 id가 아니라 '대상 사용자 id'로 처리해야 함 -->
        <ion-button
          size="small"
          color="danger"
          class="btn-gold-outline"
          :disabled="!reqByUserId[user._id]"
          @click.stop="onBlockClick(user._id)"
        >차단</ion-button>
      </template>
    </UserList>
  </div>
</template>

<script setup>
/* -----------------------------------------------------------
   Sent Only: '내가 보낸 친구 신청' 전용
   - 상단: 보낸 신청 수 (pending 기준)
   - 각 행 하단: "취소" + "차단" 버튼
   - 응답 포맷 다양성 대응 (requests/pendingIds/ids/객체배열)
   - 일괄조회(bulk) → 의심 시 개별 조회 폴백 → 최종 id 필터
   - 🔧 수정 요점:
     • '차단'은 /api/friend-request/:id/block(수신자 전용)이 아니라
       일반 차단 엔드포인트 /api/block/:userId 를 호출해야 동작합니다.
   - ✅ Premium 가림: viewerLevel / isPremium을 UserList로 전달
----------------------------------------------------------- */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import { IonButton, IonIcon } from '@ionic/vue'
import { sendOutline } from 'ionicons/icons'

const router = useRouter()
const icons = { sendOutline }

/* ===== 상태 ===== */
const users = ref([])            // 보낸신청 대상 유저들(to)만
const isLoading = ref(true)
const sentRequests = ref([])     // [{ _id, to, status:'pending', ... }...] (pending만 유지)

/* ✅ 프리미엄회원 가림 로직 전달용 */
const viewerLevel = ref('')  // '일반회원' | '라이트회원' | '프리미엄회원' 등
const isPremium   = ref(false)

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
/** UserList 정규화 */
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

/* ===== 보낸신청 → 수신자(to) ID 수집 ===== */
function extractPendingRequests(data) {
  const arr = Array.isArray(data) ? data
           : (Array.isArray(data?.requests) ? data.requests
           : (Array.isArray(data?.pending) ? data.pending
           : []))
  const reqs = (arr || []).filter(r => r && typeof r === 'object')
  return reqs.filter(r => (r.status ?? 'pending') === 'pending')
}
function extractRecipientIdsFromAny(data) {
  // 1) 표준/객체 경로
  const pendingReqs = extractPendingRequests(data)
  const ids1 = pendingReqs
    .map(r => (typeof r.to === 'object' ? r.to?._id : r.to))
    .filter(Boolean)
    .map(String)

  // 2) 단순 배열 경로 (ids/pendingIds/requests가 id 배열인 경우)
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
  let bulkList = []
  try {
    const res = await api.post('/api/search/users', { ids })
    bulkList = Array.isArray(res?.data?.users) ? res.data.users
             : (Array.isArray(res?.data) ? res.data : [])
  } catch (e) {
    console.warn('[sent] bulk search failed, fallback per-id:', e?.message || e)
  }

  if (Array.isArray(bulkList) && bulkList.length) {
    const set = new Set(ids.map(String))
    const filtered = bulkList.filter(u => u && set.has(String(u._id)))
    if (filtered.length === ids.length) return filtered
    console.warn('[sent] bulk suspicious; using per-id fallback')
  }

  const per = await Promise.all(ids.map(async id => {
    try {
      const r = await api.get(`/api/users/${id}`)
      return r?.data?.user || r?.data || null
    } catch { return null }
  }))
  return per.filter(Boolean)
}

/* ===== 상단 카운트 ===== */
const pendingCount = computed(() => sentRequests.value.length)

/* ===== userId → request 매핑 (취소 버튼 활성화) ===== */
const reqByUserId = computed(() => {
  const m = Object.create(null)
  for (const r of sentRequests.value) {
    const uid = typeof r?.to === 'object' ? r.to?._id : r?.to
    if (uid) m[String(uid)] = r
  }
  return m
})

/* ===== 액션: 취소 & 차단 ===== */
// ✅ 신청 취소: FriendRequest 문서 id 필요
async function cancelFriendRequest (friendRequestId) {
  if (!friendRequestId) return
  await api.delete(`/api/friend-request/${friendRequestId}`)
  // 요청/화면 동기화
  sentRequests.value = sentRequests.value.filter(x => x._id !== friendRequestId)
  const uid = users.value.find(u => reqByUserId.value[u._id]?._id === friendRequestId)?._id
  if (uid) users.value = users.value.filter(u => u._id !== uid)
}
// ✅ 차단: '대상 사용자 id'로 일반 차단 엔드포인트 호출
async function blockUser (userId) {
  if (!userId) return
  await api.put(`/api/block/${userId}`, {})
  // 차단 시 관련 pending 신청은 서버에서 일괄 rejected 처리됨
  // 화면에서도 해당 사용자 제거
  const fr = reqByUserId.value[userId]
  if (fr) sentRequests.value = sentRequests.value.filter(x => x._id !== fr._id)
  users.value = users.value.filter(u => String(u._id) !== String(userId))
}
const onCancelClick = (payload) => cancelFriendRequest(typeof payload === 'string' ? payload : payload?._id)
// 🔧 변경: userId를 직접 전달
const onBlockClick  = (userId) => blockUser(userId)

/* ===== 초기 로딩 ===== */
onMounted(async () => {
  try {
    isLoading.value = true

    // ✅ 뷰어 등급/회원 여부 설정 (서버 우선 → 로컬 폴백)
    try {
      const me = (await api.get('/api/me')).data?.user || {}
      const levelFromApi =
        me?.level ||
        me?.user_level ||
        me?.membership ||
        ''
      viewerLevel.value = String(levelFromApi || '').trim()
      const premiumBool =
        me?.isPremium ??
        me?.premium ??
        (String(levelFromApi || '').trim() === '프리미엄회원')
      isPremium.value = Boolean(premiumBool)
    } catch {
      const lv = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim().toLowerCase()
      viewerLevel.value = lv
      const boolish = (localStorage.getItem('isPremium') || '').trim().toLowerCase()
      isPremium.value = ['프리미엄회원','premium','premium_member','prem'].includes(lv) ||
                        ['true','1','yes','y'].includes(boolish)
    }

    // 1) 보낸 친구 신청 목록
    const res = await api.get('/api/friend-requests/sent')

    // 2) pending만 보관 (상단 카운트/버튼용)
    const pendingReqs = extractPendingRequests(res?.data)
    sentRequests.value = pendingReqs

    // 3) 수신자(to) id 수집
    const recipientIds = extractRecipientIdsFromAny(res?.data)
    if (!recipientIds.length) { users.value = []; return }

    // 4) 해당 id 사용자만 조회(+최종 id 필터)
    const raw = await fetchUsersByIdsStrict(recipientIds)
    const set = new Set(recipientIds.map(String))
    const strictFinal = raw.filter(u => u && set.has(String(u._id)))

    // 5) 정규화 + 정렬
    users.value = sortByRecent(strictFinal.map(normalizeUser))
  } catch (e) {
    console.error('❌ 보낸신청 전용 리스트 로딩 실패:', e)
    users.value = []
    sentRequests.value = []
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
  font-size:15px
}
.section-icon{ font-size:18px; color:var(--gold, #d4af37); }
.count{ font-weight:800; color:var(--gold-weak, #e6c964); }

/* 버튼 크기/폰트/라운드(두 클래스 모두에 적용) */
.btn-gold-solid,
.btn-gold-outline {
  --height: 18px;      /* ✅ 버튼 높이 지정 */
  --border-radius: 12px;
  --padding-start: 1px;
  --padding-end: 1px;
  --padding-top: 0;
  --padding-bottom: 0;

  font-size: 12px;
  font-weight: 800;
  min-width: 65px;
  min-height: 30px;

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
  justify-content: flex-start;
  gap: 12px;
  padding: 0px 20px;
}

/* 배경 */
:root, :host{ --bg:#0b0b0d; --text:#d7d7d9; }
.sent-only-wrapper{ color:var(--text); }
</style>
