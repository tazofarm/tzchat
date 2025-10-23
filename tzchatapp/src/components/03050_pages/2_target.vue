<template>
  <!-- 스크롤 기준 앵커 -->
  <div ref="listTop" style="height:1px;"></div>

  <!-- 공통 리스트 컴포넌트 사용 -->
  <UserList
    :users="users"
    :isLoading="isLoading"
    :viewer-level="viewerLevel"
    :is-premium="isPremium"
    emptyText="조건에 맞는 사용자가 없습니다."
    @select="u => goToUserProfile(u._id)"
  />

  <!-- 새로운 친구 보기 (리셋) -->
  <div style="margin-top: 12px; display:flex; justify-content:center;">
    <button
      type="button"
      @click="openResetConfirm"
      :disabled="resetUsed >= resetLimit || isLoading"
      style="padding:10px 14px; border-radius:10px; border:1px solid #2a2a2e; background:#151518; color:#d7d7d9; cursor:pointer; opacity: var(--op, 1);"
      :style="{ '--op': (resetUsed >= resetLimit || isLoading) ? 0.5 : 1 }"
      aria-label="새로운 친구 보기"
    >
      새로운 친구 보기 ({{ resetUsed }}/{{ resetLimit }})
    </button>
  </div>

  <!-- ✅ 확인/취소 모달 -->
  <div
    v-if="showResetConfirm"
    class="reset-modal-overlay"
    @click.self="cancelReset"
  >
    <div
      class="reset-modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-title"
    >
      <h3 id="reset-title">새로운 친구 보기</h3>
      <p class="reset-modal-text">
        지금 보이는 7명이 바뀝니다. 진행할까요?
      </p>
      <div class="reset-modal-actions">
        <button class="btn-confirm" type="button" @click="confirmReset">확인</button>
        <button class="btn-cancel"  type="button" @click="cancelReset">취소</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import { applyTotalFilterNormal } from '@/components/04210_Page2_target/Filter/Total_Filter_normal'
import { applyDistributedSelection } from '@/components/04210_Page2_target/Logic/distribution'
import { connectSocket, getSocket } from '@/lib/socket'

/** 상태 */
const users = ref([])
const rawServerList = ref([]) // 서버에서 받은 원본(필터 전)
const nickname = ref('')
const currentUser = ref({})
const isLoading = ref(true)
const excludeIds = ref(new Set()) // 프리체크 제외(친구/차단/대기/채팅상대)
const socket = ref(null)

/** 리스트 상단 스크롤 앵커 */
const listTop = ref(null)

/** ✅ Premium 가림 로직용 */
const viewerLevel = ref('')  // '일반회원' | '라이트회원' | '프리미엄회원'
const isPremium = ref(false)

/** 리셋(새로운 친구 보기) 카운트 */
const resetLimit = 500
const resetUsed = ref(0)
const resetIndex = ref(0)
const seedDay = ref('')        // KST yyyymmdd
const viewerId = ref('')       // 시청자 고정

/** 소켓 핸들러 보관 */
const sockHandlers = {
  connect: null,
  disconnect: null,
  connect_error: null,
  users_refresh: null,
  users_patch: null,
  users_last_login: null,
}

const LOG = { init: true, socket: true, patch: true, sort: false, filter: true, relation: true }
const router = useRouter()

/* ===================== 혼합콘텐츠/로컬호스트 URL 보정 ===================== */
// … (이하 기존 toAbsolute / normalizeUser 등 유틸 코드 동일) …

/** 유틸: 시간/정렬 */
function toTS(v) {
  if (!v) return 0
  try { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0 } catch { return 0 }
}

/* =================== 분산 노출 관련 호출 =================== */
const recompute = (me) => {
  users.value = applyDistributedSelection(rawServerList.value, me, {
    seedDay: seedDay.value,
    viewerId: viewerId.value,
    resetIndex: resetIndex.value,
    excludeIdsSet: excludeIds.value,
    applyTotalFilter: applyTotalFilterNormal
  })
}

/** 관계 데이터 로딩 */
async function fetchRelations() {
  try {
    console.time('[Users] relations')
    const [friendsRes, blocksRes, sentRes, recvRes, chatsRes] = await Promise.all([
      api.get('/api/friends'),
      api.get('/api/blocks'),
      api.get('/api/friend-requests/sent'),
      api.get('/api/friend-requests/received'),
      api.get('/api/chatrooms/partners'),
    ])

    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []
    const chatUserIds = chatsRes?.data?.ids ?? []

    excludeIds.value = new Set([
      ...friends.map(String),
      ...blocks.map(String),
      ...pendingSent.map(String),
      ...pendingRecv.map(String),
      ...chatUserIds.map(String)
    ])

    currentUser.value = {
      ...currentUser.value,
      chatUserIds
    }

    if (LOG.relation) console.log('[Users] excludeIds size:', excludeIds.value.size, '| chatUserIds:', chatUserIds.length)
  } catch (e) {
    console.error('❌ 관계 데이터 로딩 실패:', e)
    excludeIds.value = new Set()
  } finally {
    console.timeEnd('[Users] relations')
  }
}

/** 스크롤 상단 이동 */
function scrollToTopSmooth() {
  const ion = document.querySelector('ion-content')
  if (ion && typeof ion.scrollToTop === 'function') {
    ion.scrollToTop(300)
    return
  }
  if (listTop.value && typeof listTop.value.scrollIntoView === 'function') {
    listTop.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
}

/** 리셋 모달/버튼 핸들링 */
const showResetConfirm = ref(false)

function openResetConfirm() {
  if (resetUsed.value >= resetLimit || isLoading.value) return
  showResetConfirm.value = true
}
function cancelReset() {
  showResetConfirm.value = false
}
async function confirmReset() {
  showResetConfirm.value = false
  if (resetUsed.value >= resetLimit) return
  resetUsed.value += 1
  resetIndex.value += 1
  localStorage.setItem(`reco:${viewerId.value || 'anon'}:${seedDay.value}`, JSON.stringify({ used: resetUsed.value, idx: resetIndex.value }))
  recompute(currentUser.value)
  await nextTick()
  scrollToTopSmooth()
}

/** 소켓 이벤트 초기화 */
function initUsersSocket(me) {
  const s = connectSocket()
  socket.value = s

  sockHandlers.connect = () => {
    if (LOG.socket) console.log('✅ [Socket] connected:', s.id)
    try { s.emit('users:join', { scope: 'list' }) } catch {}
  }
  sockHandlers.disconnect = (reason) => console.warn('⚠️ [Socket] disconnected:', reason)
  sockHandlers.connect_error = (err) => console.error('❌ [Socket] connect_error:', err?.message || err)

  sockHandlers.users_refresh = (payload) => {
    if (LOG.socket) console.log('🟦 [Socket] users:refresh len=', payload?.length)
    rawServerList.value = payload || []
    recompute(me)
  }
  sockHandlers.users_patch = (u) => {
    if (LOG.patch) console.log('🟨 [Socket] users:patch:', u?._id, u?.nickname)
    if (!u || !u._id) return
    const nu = normalizeUser(u)
    if (excludeIds.value.has(String(nu._id))) return

    const idx = rawServerList.value.findIndex(x => x._id === nu._id)
    if (idx >= 0) rawServerList.value[idx] = { ...rawServerList.value[idx], ...nu }
    else rawServerList.value.push(nu)
    // debounce 적용 가능
    recompute(me)
  }
  sockHandlers.users_last_login = ({ userId, last_login }) => {
    const idx = rawServerList.value.findIndex(x => x._id === userId)
    if (idx >= 0) {
      rawServerList.value[idx] = { ...rawServerList.value[idx], last_login }
      recompute(me)
    }
  }

  s.on('connect', sockHandlers.connect)
  s.on('disconnect', sockHandlers.disconnect)
  s.on('connect_error', sockHandlers.connect_error)
  s.on('users:refresh', sockHandlers.users_refresh)
  s.on('users:patch', sockHandlers.users_patch)
  s.on('users:last_login', sockHandlers.users_last_login)
}

/** 라이프사이클 */
onMounted(async () => {
  try {
    console.time('[Users] init')
    const meResp = await api.get('/api/me')
    const me = meResp.data.user
    currentUser.value = me
    viewerId.value = String(me?._id || '')
    nickname.value = me?.nickname || ''
    if (LOG.init) console.log('✅ me:', me)

    const levelFromApi = me?.level || me?.user_level || me?.membership || ''
    viewerLevel.value = String(levelFromApi || '').trim()
    const premiumBool = me?.isPremium ?? me?.premium ?? (viewerLevel.value === '프리미엄회원')
    isPremium.value = Boolean(premiumBool)

    // 리셋 상태 로드
    const day = (() => {
      const fmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' });
      const parts = fmt.formatToParts(new Date()).reduce((o,p)=>{ o[p.type]=p.value; return o; }, {});
      return `${parts.year}${parts.month}${parts.day}`;
    })();
    seedDay.value = day
    const key = `reco:${viewerId.value || 'anon'}:${day}`
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}')
      resetUsed.value = Number(saved.used || 0)
      resetIndex.value = Number(saved.idx || 0)
    } catch {
      resetUsed.value = 0
      resetIndex.value = 0
    }

    // 관계 + 채팅상대 로딩
    await fetchRelations()

    // 초기 사용자 리스트
    const regionFilter = me.search_regions || []
    const res = await api.post('/api/search/users', { regions: regionFilter })
    rawServerList.value = res.data || []
    recompute(me)

    initUsersSocket(me)
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', e)
  } finally {
    isLoading.value = false
    console.timeEnd('[Users] init')
  }
})

onBeforeUnmount(() => {
  try {
    const s = getSocket()
    if (s) {
      try { s.emit('users:leave', { scope: 'list' }) } catch {}
      if (sockHandlers.connect)          s.off('connect', sockHandlers.connect)
      if (sockHandlers.disconnect)       s.off('disconnect', sockHandlers.disconnect)
      if (sockHandlers.connect_error)    s.off('connect_error', sockHandlers.connect_error)
      if (sockHandlers.users_refresh)    s.off('users:refresh', sockHandlers.users_refresh)
      if (sockHandlers.users_patch)      s.off('users:patch', sockHandlers.users_patch)
      if (sockHandlers.users_last_login) s.off('users:last_login', sockHandlers.users_last_login)
    }
    socket.value = null
  } catch (e) {
    console.error('❌ 소켓 정리 실패:', e)
  }
})

/** 로그아웃 */
const logout = async () => {
  try { await api.post('/api/logout'); router.push('/login') }
  catch (e) { console.error('❌ 로그아웃 실패:', e) }
}
</script>

<style scoped>
:root,
:host {
  --bg: #0b0b0d;
  --text: #d7d7d9;
}
ion-content {
  --background: var(--bg);
  color: var(--text);
}

.reset-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  display:flex; align-items:center; justify-content:center;
  z-index: 9999;
}
.reset-modal-card {
  width: min(88vw, 420px);
  background:#1a1a1d; color:#e7e7ea; border:1px solid #2a2a2e;
  border-radius:14px; padding:18px;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.reset-modal-text {
  margin: 10px 0 18px; color:#bdbdc2;
}
.reset-modal-actions {
  display:flex; gap:10px; justify-content:flex-end;
}
.btn-confirm, .btn-cancel {
  padding:8px 12px; border-radius:10px; border:1px solid #2a2a2e;
  background:#111114; color:#e7e7ea; cursor:pointer;
}
.btn-confirm { background:#2a2a2e; }
.btn-confirm:focus, .btn-cancel:focus { outline:2px solid #3a3a3f; outline-offset:2px; }

button[aria-label*="새로운 친구"] {
  width: 100%;
  height: 160px;
  border-radius: 14px;
}
button[aria-label*="새로운 친구"] {
  width: 94%;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
}
</style>
