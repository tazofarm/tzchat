<!-- src/components/03050_pages/2_target_merge.vue -->
<template>
  <ion-page>
    <!-- ✅ A안: ion-header + ion-content 구조 (헤더 고정) -->
    <ion-header class="em-fixed-header">
      <div class="em-header">
        <EmergencySwitch
          :emergencyOn="emergencyOn"
          :formattedTime="formattedTime"
          @toggle="onHeaderToggle"
        />
      </div>
    </ion-header>

    <ion-content class="no-gutter">
      <!-- ✅ 보상형 광고 모달 (Emergency ON 전시) -->
      <ion-modal
        :is-open="showAdvModal"
        @didDismiss="onAdvDidDismiss"
        :backdrop-dismiss="true"
      >
        <ModalAdv @close="closeAdv" />
      </ion-modal>

      <!-- ✅ 리스트 상단 스크롤 앵커 -->
      <div ref="listTop" style="height:1px;"></div>

      <!-- ===== 공통 리스트 컴포넌트 ===== -->
      <UserList
        :users="displayUsers"
        :isLoading="isLoading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        :emptyText="emergencyOn ? '현재 긴급 사용자 없음' : '조건에 맞는 사용자가 없습니다.'"
        @select="u => goToUserProfile(u?._id || u?.id)"
      />

      <!-- ✅ 새로운 친구 보기(리셋): 두 모드 공통으로 같은 카운트/시드 사용 -->
      <div
        v-if="displayUsers.length"
        class="reset-btn-wrap"
      >
        <button
          type="button"
          @click="openResetConfirm"
          :disabled="reset.used >= reset.limit || isLoading"
          class="reset-action-card two-lines"
          aria-label="새로운 친구 보기"
        >
          <span class="line1">새로운 친구 보기 ({{ reset.used }}/{{ reset.limit }})</span>
          <span class="line2">(오전 11:00 리셋)</span>
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
            {{ emergencyOn ? '지금 보이는 긴급 사용자 목록이 바뀝니다. 진행할까요?' : '지금 보이는 7명이 바뀝니다. 진행할까요?' }}
          </p>
          <div class="reset-modal-actions">
            <button class="btn-confirm" type="button" @click="confirmReset">확인</button>
            <button class="btn-cancel"  type="button" @click="cancelReset">취소</button>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
/* -----------------------------------------------------------
   통합 Emergency/Target 페이지 (A안: ion-header + ion-content)
   - ion-header에 EmergencySwitch 고정, 나머지는 ion-content 스크롤
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import ModalAdv from '@/components/04010_Page0_emergency/Modal_adv.vue'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import EmergencySwitch from '@/components/02010_minipage/mini_emergency/emergencySwitch.vue'
import { applyTotalFilterPremium } from '@/components/04210_Page2_target/Filter/Total_Filter_premium'
import { applyTotalFilterNormal } from '@/components/04210_Page2_target/Filter/Total_Filter_normal'
import { applyDistributedSelection } from '@/components/04210_Page2_target/Logic/distribution'
import { connectSocket, getSocket } from '@/lib/socket'
import { IonPage, IonContent, IonModal, IonHeader } from '@ionic/vue'

/* ===== 공통 상태 ===== */
const isLoading = ref(true)
const router = useRouter()

const viewerLevel = ref('')
const isPremium = ref(false)
const currentUser = ref({})
const viewerId = ref('')

/* 제외 세트 (친구/차단/대기/채팅상대) */
const excludeIds = ref(new Set())

/* 리스트 상단 앵커 */
const listTop = ref(null)

/* ===== Emergency 모드 상태 ===== */
const emergencyOn = ref(false)
const showAdvModal = ref(false)
const remainingSeconds = ref(0)

const rawEmergencyList = ref([])   // 서버 긴급 원본
const emergencyUsers = ref([])     // 화면 표시(선정 결과)

/* 옵션: 나 포함 */
const INCLUDE_ME_WHEN_ON = true
const APPLY_FILTERS_TO_ME = false   // 나 포함시 필터 무시(옵션)

/* ===== Target(일반 추천) 모드 상태 ===== */
const rawServerList = ref([])      // 검색/추천 원본
const targetUsers = ref([])        // 화면 표시(선정 결과)

/* ===== 표시용 합성 ===== */
const displayUsers = computed(() => emergencyOn.value ? emergencyUsers.value : targetUsers.value)

/* ===== 타이머 포맷 ===== */
const formattedTime = computed(() => {
  const sec = remainingSeconds.value
  if (sec <= 0) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}시간 ${m}분 ${s}초`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
})

/* ===== 유틸 ===== */

function goToUserProfile(userId) {
  if (!userId) return
  const id = String(userId)
  const targetPath = emergencyOn.value
    ? `/home/premuimuser/${id}`  // ✅ Emergency ON → PagepremiumProfile.vue (철자 확인 필요)
    : `/home/user/${id}`         // ✅ Emergency OFF → PageuserProfile.vue
  router.push(targetPath)
}
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

function toIdList(src) {
  const arr = Array.isArray(src) ? src : []
  return arr
    .map(v => {
      if (!v) return null
      if (typeof v === 'string' || typeof v === 'number') return String(v)
      return String(v._id || v.id || v.userId || v.user_id || '')
    })
    .filter(Boolean)
}
function buildExcludeIdsSet({ friends = [], blocks = [], pendingSent = [], pendingRecv = [], chats = [] } = {}) {
  const set = new Set()
  for (const id of toIdList(friends)) set.add(id)
  for (const id of toIdList(blocks)) set.add(id)
  for (const id of toIdList(pendingSent)) set.add(id)
  for (const id of toIdList(pendingRecv)) set.add(id)
  for (const id of toIdList(chats)) set.add(id)
  return set
}
function yyyymmddKST(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = fmt.formatToParts(date).reduce((o,p)=>{ o[p.type]=p.value; return o }, {})
  return `${parts.year}${parts.month}${parts.day}`
}

/* ===== Emergency 활성 판정 ===== */
function isEmergencyActive(u) {
  try {
    const em = u?.emergency || {}
    if (typeof em.remainingSeconds === 'number') {
      return em.isActive === true && em.remainingSeconds > 0
    }
    if (em.isActive && em.activatedAt) {
      const ONE_HOUR = 60 * 60 * 1000
      return Date.now() - new Date(em.activatedAt).getTime() < ONE_HOUR
    }
    return false
  } catch { return false }
}

/* ===== 🔁 통합 리셋 상태 =====
   - 두 모드(Emergency/Target)에서 같은 카운트/인덱스/시드 공유
   - 키: unified:${viewerId}:${yyyymmdd}
----------------------------------------------------------- */
const reset = ref({ used: 0, idx: 0, limit: 20, seedDay: '' })

function loadResetState() {
  const day = yyyymmddKST()
  reset.value.seedDay = day
  const key = `unified:${viewerId.value || 'anon'}:${day}`
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    reset.value.used = Number(saved.used || 0)
    reset.value.idx  = Number(saved.idx  || 0)
  } catch {
    reset.value.used = 0
    reset.value.idx  = 0
  }
}
function saveResetState() {
  const key = `unified:${viewerId.value || 'anon'}:${reset.value.seedDay}`
  localStorage.setItem(key, JSON.stringify({ used: reset.value.used, idx: reset.value.idx }))
}

/* ===== 분산선정 ===== */
function recomputeEmergency() {
  const me = currentUser.value
  let baseList = rawEmergencyList.value
  // 프리체크 제외
  baseList = Array.isArray(baseList) ? baseList.filter(u => u && u._id && !excludeIds.value.has(String(u._id))) : []

  const selected = applyDistributedSelection(baseList, me, {
    seedDay: reset.value.seedDay,
    viewerId: viewerId.value,
    resetIndex: reset.value.idx,
    excludeIdsSet: excludeIds.value,
    applyTotalFilter: (list, meArg) =>
      (APPLY_FILTERS_TO_ME && isEmergencyActive(meArg))
        ? list
        : applyTotalFilterPremium(list, meArg, { log: false }),
  })

  if (INCLUDE_ME_WHEN_ON && isEmergencyActive(me)) {
    const withoutMe = selected.filter(u => String(u._id) !== String(me._id))
    emergencyUsers.value = [me, ...withoutMe].slice(0, 7)
  } else {
    emergencyUsers.value = selected
  }
}

function recomputeTarget() {
  const me = currentUser.value
  const selected = applyDistributedSelection(rawServerList.value, me, {
    seedDay: reset.value.seedDay,
    viewerId: viewerId.value,
    resetIndex: reset.value.idx,
    excludeIdsSet: excludeIds.value,
    applyTotalFilter: applyTotalFilterNormal
  })
  targetUsers.value = selected
}

/* ===== API ===== */
async function fetchRelations() {
  try {
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
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []  // ✅ fix: recvRes로 교체
    const chatUserIds = chatsRes?.data?.ids ?? []

    excludeIds.value  = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv, chats: chatUserIds })
    currentUser.value = { ...currentUser.value, chatUserIds }
  } catch {
    excludeIds.value = new Set()
  }
}

async function fetchEmergencyUsers() {
  try {
    const res = await api.get('/api/emergencyusers')
    let list = Array.isArray(res.data?.users) ? res.data.users : []
    list = list.filter(isEmergencyActive)
    rawEmergencyList.value = list
    recomputeEmergency()
  } catch (err) {
    console.error('❌ 긴급 목록 로딩 실패:', err)
  }
}

async function fetchTargetUsers() {
  try {
    const me = currentUser.value
    const regionFilter = me?.search_regions || []
    const res = await api.post('/api/search/users', { regions: regionFilter })
    rawServerList.value = (res.data || []).map(u => ({ ...u, _id: String(u._id ?? u.id ?? '') }))
    recomputeTarget()
  } catch (e) {
    console.error('❌ 추천 목록 로딩 실패:', e)
  }
}

/* ===== Emergency on/off ===== */
const onHeaderToggle = async (next) => {
  if (next) showAdvModal.value = true
  await updateEmergencyState(next)
}
const closeAdv = () => { showAdvModal.value = false }
const onAdvDidDismiss = () => { showAdvModal.value = false }

async function updateEmergencyState(newState) {
  try {
    const endpoint = newState ? '/api/emergencyon' : '/api/emergencyoff'
    const res = await api.put(endpoint)
    emergencyOn.value = newState

    if (newState) {
      const remaining = res?.data?.remainingSeconds ?? 0
      if (remaining > 0) {
        remainingSeconds.value = remaining
        currentUser.value = {
          ...currentUser.value,
          emergency: {
            ...(currentUser.value.emergency || {}),
            isActive: true,
            remainingSeconds: remaining,
            activatedAt: new Date().toISOString()
          }
        }
        await nextTick()
        startCountdown(remaining)
      } else {
        await updateEmergencyState(false)
      }
    } else {
      clearCountdown()
      currentUser.value = {
        ...currentUser.value,
        emergency: { ...(currentUser.value.emergency || {}), isActive: false, remainingSeconds: 0 }
      }
    }

    // 모드에 맞는 목록 갱신 + 상단 스크롤
    if (emergencyOn.value) {
      await fetchEmergencyUsers()
    } else {
      await fetchTargetUsers()
    }
    await nextTick()
    scrollToTopSmooth()
  } catch (err) {
    console.error('❌ 상태 변경 실패:', err)
    emergencyOn.value = false
    clearCountdown()
  }
}

/* ===== 소켓 =====
   - Emergency 채널: 'emergency' 룸
   - Target(추천) 채널: users:refresh/patch/last_login
   - 언마운트 시 disconnect() 금지 → 리스너만 off
*/
const socketRef = ref(null)
const sockHandlers = {
  connect: null,
  disconnect: null,
  connect_error: null,
  emergency_refresh: null,
  emergency_userOn: null,
  emergency_userOff: null,
  users_refresh: null,
  users_patch: null,
  users_last_login: null,
}

function initSocket() {
  try {
    const s = connectSocket()
    socketRef.value = s

    sockHandlers.connect = () => {
      try {
        s.emit('subscribe', { room: 'emergency' })
        s.emit('users:join', { scope: 'list' })
      } catch {}
    }
    sockHandlers.disconnect = () => {}
    sockHandlers.connect_error = (err) => console.error('❌ [Socket] connect_error:', err?.message || err)

    // Emergency 채널
    const refetchEmergency = async () => { await fetchEmergencyUsers() }
    sockHandlers.emergency_refresh = refetchEmergency
    sockHandlers.emergency_userOn  = refetchEmergency
    sockHandlers.emergency_userOff = refetchEmergency

    // Target 채널
    sockHandlers.users_refresh = (payload) => {
      rawServerList.value = (payload || []).map(u => ({ ...u, _id: String(u._id ?? u.id ?? '') }))
      recomputeTarget()
    }
    sockHandlers.users_patch = (u) => {
      if (!u || !u._id) return
      const nu = { ...u, _id: String(u._id) }
      if (excludeIds.value.has(nu._id)) return
      const idx = rawServerList.value.findIndex(x => x._id === nu._id)
      if (idx >= 0) rawServerList.value[idx] = { ...rawServerList.value[idx], ...nu }
      else rawServerList.value.push(nu)
      recomputeTarget()
    }
    sockHandlers.users_last_login = ({ userId, last_login }) => {
      const idx = rawServerList.value.findIndex(x => x._id === String(userId))
      if (idx >= 0) {
        rawServerList.value[idx] = { ...rawServerList.value[idx], last_login }
        recomputeTarget()
      }
    }

    s.on('connect', sockHandlers.connect)
    s.on('disconnect', sockHandlers.disconnect)
    s.on('connect_error', sockHandlers.connect_error)

    s.on('emergency:refresh', sockHandlers.emergency_refresh)
    s.on('emergency:userOn',   sockHandlers.emergency_userOn)
    s.on('emergency:userOff',  sockHandlers.emergency_userOff)

    s.on('users:refresh',      sockHandlers.users_refresh)
    s.on('users:patch',        sockHandlers.users_patch)
    s.on('users:last_login',   sockHandlers.users_last_login)
  } catch (e) {
    console.error('❌ [socket] 초기화 실패:', e)
  }
}

function cleanupSocket() {
  try {
    const s = getSocket()
    if (!s) return
    // 구독 해제만 실시 / disconnect 금지
    try { s.emit('unsubscribe', { room: 'emergency' }) } catch {}
    try { s.emit('users:leave', { scope: 'list' }) } catch {}

    if (sockHandlers.connect)          s.off('connect', sockHandlers.connect)
    if (sockHandlers.disconnect)       s.off('disconnect', sockHandlers.disconnect)
    if (sockHandlers.connect_error)    s.off('connect_error', sockHandlers.connect_error)

    if (sockHandlers.emergency_refresh) s.off('emergency:refresh', sockHandlers.emergency_refresh)
    if (sockHandlers.emergency_userOn)  s.off('emergency:userOn',  sockHandlers.emergency_userOn)
    if (sockHandlers.emergency_userOff) s.off('emergency:userOff', sockHandlers.emergency_userOff)

    if (sockHandlers.users_refresh)     s.off('users:refresh',      sockHandlers.users_refresh)
    if (sockHandlers.users_patch)       s.off('users:patch',        sockHandlers.users_patch)
    if (sockHandlers.users_last_login)  s.off('users:last_login',   sockHandlers.users_last_login)
  } catch (e) {
    console.error('❌ 소켓 정리 실패:', e)
  } finally {
    socketRef.value = null
  }
}

/* ===== 카운트다운 ===== */
let countdownInterval = null
function startCountdown(initial) {
  clearCountdown()
  let left = Number(initial || 0)
  countdownInterval = setInterval(async () => {
    if (left > 0) {
      left -= 1
      remainingSeconds.value = left
    } else {
      clearCountdown()
      await updateEmergencyState(false)
    }
  }, 1000)
}
function clearCountdown() {
  if (countdownInterval) clearInterval(countdownInterval)
  countdownInterval = null
  remainingSeconds.value = 0
}

/* ===== 리셋 공통 핸들링 ===== */
const showResetConfirm = ref(false)
function openResetConfirm() {
  if (reset.value.used >= reset.value.limit || isLoading.value) return
  showResetConfirm.value = true
}
function cancelReset() { showResetConfirm.value = false }

async function confirmReset() {
  showResetConfirm.value = false
  if (reset.value.used >= reset.value.limit) return
  reset.value.used += 1
  reset.value.idx  += 1
  saveResetState()

  if (emergencyOn.value) {
    recomputeEmergency()
  } else {
    recomputeTarget()
  }
  await nextTick()
  scrollToTopSmooth()
}

/* ===== 초기화 ===== */
onMounted(async () => {
  try {
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    viewerId.value = String(me?._id || '')
    emergencyOn.value = me?.emergency?.isActive === true

    const levelFromApi = me?.level || me?.user_level || me?.membership || ''
    viewerLevel.value = String(levelFromApi || '').trim()
    const premiumBool = me?.isPremium ?? me?.premium ?? (viewerLevel.value === '프리미엄회원')
    isPremium.value = Boolean(premiumBool)

    // 통합 리셋 상태 로드
    loadResetState()

    // 관계 로딩
    await fetchRelations()

    // 카운트다운 복원
    if (emergencyOn.value && me?.emergency?.remainingSeconds > 0) {
      remainingSeconds.value = me.emergency.remainingSeconds
      startCountdown(remainingSeconds.value)
    } else if (emergencyOn.value) {
      // isActive인데 남은시간이 0이면 OFF 처리
      await updateEmergencyState(false)
    }

    // 소켓
    initSocket()

    // 초기 목록들
    await Promise.all([
      fetchEmergencyUsers(),
      fetchTargetUsers(),
    ])
  } catch (err) {
    console.error('❌ 초기 로딩 실패:', err)
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  clearCountdown()
  cleanupSocket()   // disconnect 금지 / 리스너만 해제
})
</script>

<style scoped>
/* =========================================================
   Black + Gold Theme (리스트 스타일은 UserList.vue에서 관리)
========================================================= */
:root,
:host {
  --bg: #0b0b0d;
  --panel: #121214;
  --panel-2: #17171a;
  --text-strong: #f3f3f3;
  --text: #d7d7d9;
  --text-dim: #a9a9ad;
  --divider: #26262a;
  --gold: #d4af37;
  --gold-2: #f1cf5a;
  --focus: rgba(212, 175, 55, 0.45);
}

ion-content {
  --background: var(--bg);
  color: var(--text);
}

/* ✅ ion-header 스타일 (상단 고정 영역) */
.em-fixed-header {
  --background: var(--bg);
  border-bottom: 1px solid var(--divider);
}
.em-header {
  padding: 12px 12px 6px;
}

/* ✅ target.vue와 동일한 패딩 규칙(좌우 여백 제거) */
.no-gutter {
  --padding-start: 10px;
  --padding-end: 10px;
  --padding-top: 0;
  --padding-bottom: 0;
}

/* 리스트 하단 리셋 버튼 영역 */
.reset-btn-wrap {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  padding: 0 12px 16px;
  height : 100px;
}

/* 공통 카드형 버튼 */
.reset-action-card {
  width: 100%;
  aspect-ratio: 2.5 / 1;
  border-radius: 14px;
  border: 1px solid #2a2a2e;
  background: #151518;
  color: #d7d7d9;
  cursor: pointer;
}

/* ✅ 리셋 확인 모달 */
.reset-modal-overlay{
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  display:flex; align-items:center; justify-content:center;
  z-index: 9999; /* 헤더 위로 */
}
.reset-modal-card{
  width: min(88vw, 420px);
  background:#1a1a1d; color:#e7e7ea; border:1px solid #2a2a2e;
  border-radius:14px; padding:18px;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.reset-modal-text{ margin: 10px 0 18px; color:#bdbdc2; }
.reset-modal-actions{ display:flex; gap:10px; justify-content:flex-end; }
.btn-confirm, .btn-cancel{
  padding:8px 12px; border-radius:10px; border:1px solid #2a2a2e;
  background:#111114; color:#e7e7ea; cursor:pointer;
}
.btn-confirm{ background:#2a2a2e; }
.btn-confirm:focus, .btn-cancel:focus{ outline:2px solid #3a3a3f; outline-offset:2px; }

/* 두 줄 표시 강제 */
.reset-action-card.two-lines {
  display: block;
  white-space: normal !important;
}

/* 각 줄 스타일 */
.reset-action-card.two-lines .line1 {
  font-size: 1.20em;
  font-weight: 700;
}
.reset-action-card.two-lines .line2 {
  font-size: 0.92em;
  opacity: .85;
}

/* 방어 */
.reset-action-card.two-lines * {
  white-space: normal !important;
  display: block;
  line-height: 1.6;
}
</style>
