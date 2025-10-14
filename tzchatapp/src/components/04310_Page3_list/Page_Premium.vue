<template>
  <div class="receive-only-wrapper">
    <!-- ✅ 상단 헤더: 받은 친구 신청 (N / X) -->
    <div class="section-header" role="heading" aria-level="2">
      <ion-icon :icon="icons.mailOpenOutline" class="section-icon" aria-hidden="true" />
      <h3 class="section-title">
        받은 친구 신청
        <span class="count">({{ pendingCount }} / {{ receiveLimit }})</span>
      </h3>
    </div>

    <!-- ✅ 공통 리스트 컴포넌트 + 하단 액션 버튼 슬롯 -->
    <UserList
      :key="usersKey"
      :users="users"
      :isLoading="isLoading"
      :viewer-level="viewerLevel"
      :is-premium="isPremium"
      emptyText="받은 친구 신청이 없습니다."
      @select="u => goToUserProfile(u._id)"
    >
      <!-- 각 유저 행 하단 버튼 -->
      <template #item-actions="{ user }">
        <ion-button
          size="default"
          color="primary"
          class="btn-gold-solid"
          :disabled="!reqByUserId[user._id] || isBusy(reqByUserId[user._id]?._id)"
          @click.stop="onIntroClick(reqByUserId[user._id])"
        >인사말</ion-button>

        <ion-button
          size="default"
          color="success"
          class="btn-gold-solid"
          :disabled="!reqByUserId[user._id] || isBusy(reqByUserId[user._id]?._id)"
          @click.stop="onAcceptClick(reqByUserId[user._id]?._id)"
        >수락</ion-button>

        <ion-button
          size="default"
          color="medium"
          class="btn-gold-outline"
          :disabled="!reqByUserId[user._id] || isBusy(reqByUserId[user._id]?._id)"
          @click.stop="onRejectClick(reqByUserId[user._id]?._id)"
        >거절</ion-button>

        <ion-button
          size="default"
          color="danger"
          class="btn-gold-outline"
          :disabled="!reqByUserId[user._id] || isBusy(reqByUserId[user._id]?._id)"
          @click.stop="onBlockClick(reqByUserId[user._id]?._id)"
        >차단</ion-button>
      </template>
    </UserList>

    <!-- ✅ 인사말 모달 -->
    <ion-modal :is-open="introModal.open" @didDismiss="closeIntro">
      <ion-header translucent>
        <ion-toolbar>
          <ion-title>인사말</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeIntro">닫기</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="intro-meta" v-if="introModal.req">
          <div class="intro-row">
            <span class="label">보낸 사람</span>
            <span class="value">{{ introFromName }}</span>
          </div>
          <div class="intro-row">
            <span class="label">요청 ID</span>
            <span class="value mono">{{ introModal.req._id }}</span>
          </div>
        </div>
        <div class="intro-block">
          <div class="intro-title">메시지</div>
          <div class="intro-text" v-if="introText" v-text="introText" />
          <div class="intro-empty" v-else>인사말 메시지가 없습니다.</div>
        </div>
        <div class="intro-actions">
          <ion-button expand="block" @click="copyIntro" :disabled="!introText">복사</ion-button>
          <ion-button expand="block" color="success" @click="acceptFromIntro" :disabled="!introModal.req || isBusy(introModal.req._id)">수락</ion-button>
          <ion-button expand="block" color="medium" @click="rejectFromIntro" :disabled="!introModal.req || isBusy(introModal.req._id)">거절</ion-button>
          <ion-button expand="block" color="danger" @click="blockFromIntro" :disabled="!introModal.req || isBusy(introModal.req._id)">차단</ion-button>
        </div>
      </ion-content>
    </ion-modal>

    <!-- ✅ IonToast (useIonToast 제거 대체) -->
    <ion-toast
      :is-open="toastState.open"
      :message="toastState.message"
      :color="toastState.color"
      duration="1600"
      position="top"
      @didDismiss="toastState.open = false"
    />
  </div>
</template>

<script setup>
/* -----------------------------------------------------------
   Received Only: 나에게 친구 신청한 사람 전용 페이지
   - 배지 동기화, per-request busy, 토스트 알림
   - ✅ UserList에 viewerLevel / isPremium 전달(특징·결혼 Premium 전용 처리)
----------------------------------------------------------- */
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import {
  IonButton, IonIcon, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonToast
} from '@ionic/vue'
import { mailOpenOutline } from 'ionicons/icons'

const receiveLimit = ref(20)

const router = useRouter()
const icons = { mailOpenOutline }

/* ===== 상태 ===== */
const users = ref([])                 // 화면 표시용 사용자 (받은신청 보낸 사람만)
const isLoading = ref(true)
const receivedRequests = ref([])      // [{ _id, from, intro/message, status:'pending', ... }]

/* ✅ 프리미엄 가림 전달용 (서버 우선 → 로컬 폴백) */
const viewerLevel = ref('')  // '일반회원' | '여성회원' | '프리미엄' 등
const isPremium   = ref(false)

/* ===== 배지 동기화 방송/응답 ===== */
function updateBadge() {
  const hasNew = (receivedRequests.value?.length || 0) > 0
  try {
    window.dispatchEvent(new CustomEvent('friends:state', { detail: { hasNew } }))
  } catch {}
}
function onRequestState() {
  updateBadge()
}

/* ===== 인사말(모달) ===== */
const introModal = ref({ open: false, req: null })
const introText = computed(() => {
  const r = introModal.value.req
  return r?.intro ?? r?.message ?? r?.note ?? r?.memo ?? ''
})
const introFromName = computed(() => {
  const r = introModal.value.req
  const u = (r && typeof r.from === 'object') ? r.from : null
  return u?.nickname || u?.name || u?.username || u?._id || '알 수 없음'
})

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
const goToUserProfile = (userId) => { if (userId) router.push(`/home/user/${userId}`) }

/* ===== 받은신청 파싱 ===== */
function extractPendingRequests(data) {
  const arr = Array.isArray(data) ? data
           : (Array.isArray(data?.requests) ? data.requests
           : (Array.isArray(data?.pending) ? data.pending
           : []))
  const reqs = (arr || []).filter(r => r && typeof r === 'object')
  return reqs.filter(r => (r.status ?? 'pending') === 'pending')
}
function extractSenderIdsFromAny(data) {
  const pendingReqs = extractPendingRequests(data)
  const ids1 = pendingReqs
    .map(r => (typeof r.from === 'object' ? r.from?._id : r.from))
    .filter(Boolean)
    .map(String)
  const idList =
    (Array.isArray(data?.pendingIds) && data.pendingIds) ||
    (Array.isArray(data?.ids) && data.ids) ||
    (Array.isArray(data) && typeof data[0] !== 'object' && data) ||
    []
  const ids2 = idList.map(String)
  return uniq([...ids1, ...ids2])
}

/* ===== 사용자 조회: bulk → per-id 보강 ===== */
async function fetchUsersByIdsStrict(ids = []) {
  if (!ids.length) return []
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
  }
  const results = await Promise.all(ids.map(async id => {
    try {
      const r = await api.get(`/api/users/${id}`)
      return r?.data?.user || r?.data || null
    } catch { return null }
  }))
  return results.filter(Boolean)
}

/* ===== 상단 카운트 & 강제 리렌더 키 ===== */
const pendingCount = computed(() => receivedRequests.value.length)
const usersKey = computed(() => {
  const ids = users.value.map(u => u._id).join(',')
  return `${ids}|${pendingCount.value}`
})

/* ===== userId → request 매핑 ===== */
const reqByUserId = computed(() => {
  const m = Object.create(null)
  for (const r of receivedRequests.value) {
    const uid = typeof r?.from === 'object' ? r.from?._id : r?.from
    if (uid) m[String(uid)] = r
  }
  return m
})

/* ===== per-request busy 관리 ===== */
const busy = ref({}) // { [reqId]: true/false }
const isBusy = (reqId) => !!reqId && !!busy.value[String(reqId)]
async function withBusy(reqId, fn) {
  if (!reqId) return
  const key = String(reqId)
  busy.value = { ...busy.value, [key]: true }
  try {
    await fn?.()
  } finally {
    const next = { ...busy.value }
    delete next[key]
    busy.value = next
  }
}

/* ===== 공통 후처리(수락/거절/차단 후 즉시 반영) ===== */
function removeRequestLocally(id) {
  if (!id) return
  const mapping = reqByUserId.value
  const uid = Object.keys(mapping).find(k => mapping[k]?._id === id)

  if (uid) {
    users.value = users.value.filter(u => String(u._id) !== String(uid))
  }

  receivedRequests.value = receivedRequests.value.filter(x => x._id !== id)
  updateBadge()
}

/* ===== IonToast 상태 + 도우미 ===== */
const toastState = ref({ open: false, message: '', color: 'dark' })
function toast(message = '', color = 'dark') {
  toastState.value = { open: true, message, color }
  setTimeout(() => (toastState.value.open = false), 1600)
}

/* ===== 서버 액션 ===== */
async function acceptFriendRequest(id) {
  if (!id) return
  await withBusy(id, async () => {
    await api.put(`/api/friend-request/${id}/accept`, {})
    removeRequestLocally(id)
    toast('친구로 수락했습니다.')
  })
}
async function rejectFriendRequest(id) {
  if (!id) return
  await withBusy(id, async () => {
    await api.put(`/api/friend-request/${id}/reject`, {})
    removeRequestLocally(id)
    toast('요청을 거절했습니다.')
  })
}
async function blockFriendRequest(id) {
  if (!id) return
  await withBusy(id, async () => {
    await api.put(`/api/friend-request/${id}/block`, {})
    removeRequestLocally(id)
    toast('해당 사용자를 차단했습니다.')
  })
}

/* ===== 버튼 핸들러 ===== */
const onIntroClick  = (requestObj) => { introModal.value = { open: true, req: requestObj || null } }
const onAcceptClick = (payload) => acceptFriendRequest(typeof payload === 'string' ? payload : payload?._id)
const onRejectClick = (payload) => rejectFriendRequest(typeof payload === 'string' ? payload : payload?._id)
const onBlockClick  = (payload) => blockFriendRequest(typeof payload === 'string' ? payload : payload?._id)

/* ===== 인사말 모달 동작 ===== */
function closeIntro() { introModal.value = { open: false, req: null } }
async function copyIntro() {
  try {
    await navigator.clipboard.writeText(introText.value || '')
    toast('인사말을 복사했습니다.')
  } catch { toast('복사에 실패했습니다.', 'danger') }
}
function acceptFromIntro() { if (introModal.value.req) onAcceptClick(introModal.value.req._id) }
function rejectFromIntro() { if (introModal.value.req) onRejectClick(introModal.value.req._id) }
function blockFromIntro()  { if (introModal.value.req) onBlockClick(introModal.value.req._id) }

/* ===== 초기 로딩 ===== */
onMounted(async () => {
  window.addEventListener('friends:requestState', onRequestState)

  try {
    isLoading.value = true

    // ✅ 뷰어 등급/프리미엄 여부 설정 (서버 우선 → 로컬 폴백)
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
        (String(levelFromApi || '').trim() === '프리미엄')
      isPremium.value = Boolean(premiumBool)
    } catch {
      const lv = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim().toLowerCase()
      viewerLevel.value = lv
      const boolish = (localStorage.getItem('isPremium') || '').trim().toLowerCase()
      isPremium.value = ['프리미엄','premium','premium_member','prem'].includes(lv) ||
                        ['true','1','yes','y'].includes(boolish)
    }

    const res = await api.get('/api/friend-requests/received')
    const pendingReqs = extractPendingRequests(res?.data)
    receivedRequests.value = pendingReqs

    const senderIds = extractSenderIdsFromAny(res?.data)
    if (!senderIds.length) {
      users.value = []
      updateBadge()
      return
    }
    const raw = await fetchUsersByIdsStrict(senderIds)
    const set = new Set(senderIds.map(String))
    const strictFinal = raw.filter(u => u && set.has(String(u._id)))
    users.value = sortByRecent(strictFinal.map(normalizeUser))
  } catch (e) {
    console.error('❌ 받은신청 전용 리스트 로딩 실패:', e)
    users.value = []
    receivedRequests.value = []
    toast('받은 친구 신청을 불러오지 못했습니다.', 'danger')
  } finally {
    isLoading.value = false
    updateBadge()
  }
})

onUnmounted(() => {
  window.removeEventListener('friends:requestState', onRequestState)
})

/* ===== 감시: 목록 변화가 생기면 배지 최신화(보조용) ===== */
watch(() => receivedRequests.value.length, () => updateBadge())
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
  --height: 18px;
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
.btn-gold-outline {
  --background: transparent;
  --color: var(--gold-weak, #e6c964);
  border: 1.5px solid var(--gold, #d4af37);
}

:deep(.actions-bar) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  padding: 0 0;
}

/* 인사말 모달 스타일 */
.intro-meta { display:grid; gap:6px; margin-bottom:12px; }
.intro-row { display:flex; justify-content:space-between; gap:10px; font-size:12px; color:#bbb; }
.intro-row .label{ color:#888; }
.intro-row .value{ font-weight:700; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.intro-block { background:#101010; border:1px solid rgba(212,175,55,.15); border-radius:10px; padding:12px; }
.intro-title{ font-weight:800; color:var(--gold, #d4af37); margin-bottom:6px; }
.intro-text{ white-space:pre-wrap; line-height:1.5; }
.intro-empty{ color:#888; }
.intro-actions{ display:grid; gap:8px; margin-top:14px; }

/* 배경(페이지 컨텍스트에 맞춰 최소만 지정) */
:root, :host{ --bg:#0b0b0d; --text:#d7d7d9; }
.receive-only-wrapper{ color:var(--text); }
</style>
