<!-- src/components/04010_Page0_emergency/Emergency.vue -->
<template>
  <ion-page>
    <ion-content>
      <!-- 보상형 광고 모달 -->
      <ion-modal
        :is-open="showAdvModal"
        @didDismiss="onAdvDidDismiss"
        :backdrop-dismiss="true"
      >
        <ModalAdv @close="closeAdv" />
      </ion-modal>

      <div class="ion-padding">
        <!-- ===== Speed Matching 헤더 ===== -->
        <EmergencySwitch
          :emergencyOn="emergencyOn"
          :formattedTime="formattedTime"
          @toggle="onHeaderToggle"
        />

        <!-- ✅ 리스트 상단 스크롤 앵커 -->
        <div ref="listTop" style="height:1px;"></div>

        <!-- ===== 공통 리스트 컴포넌트 ===== -->
        <UserList
          :users="emergencyUsers"
          :isLoading="isLoading"
          :viewer-level="viewerLevel"
          :is-premium="isPremium"
          emptyText="현재 긴급 사용자 없음"
          @select="u => goToUserProfile(u._id)"
        />

        <!-- ✅ 새로운 친구 보기 (리셋) — emergencyOn 일 때만 노출 -->
        <div
          v-if="emergencyOn"
          style="margin-top: 12px; display:flex; justify-content:center;"
        >
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
            지금 보이는 긴급 사용자 목록이 바뀝니다. 진행할까요?
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
   Emergency 페이지 (필터 정리 반영)
   - Total_Filter_premium 내부에 "자기자신 제외 + 리스트/채팅상대 제외" 통합
   - 프론트 프리체크 제외 세트(친구/차단/대기/채팅상대)도 AND 적용
   - 새로운 친구 보기(리셋): 일/사용자별 카운트·시드 관리, 회전, 스크롤
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import ModalAdv from '@/components/04010_Page0_emergency/Modal_adv.vue'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import EmergencySwitch from '@/components/02010_minipage/mini_emergency/emergencySwitch.vue'
import { applyTotalFilterPremium } from '@/components/04210_Page2_target/Filter/Total_Filter_premium'
import { connectSocket as connectSharedSocket } from '@/lib/socket'
import { IonPage, IonContent, IonModal } from '@ionic/vue'

/* ===== 상태 ===== */
const emergencyUsers = ref([])
const isLoading = ref(true)
const emergencyOn = ref(false)
const remainingSeconds = ref(0)
const currentUser = ref({})
const showAdvModal = ref(false)
const router = useRouter()
const socket = ref(null)
const excludeIds = ref(new Set()) // 친구/차단/대기/채팅상대 프리체크 제외

/* ✅ 리스트 상단 앵커 */
const listTop = ref(null)

/* ✅ 프리미엄 판정 전달 */
const viewerLevel = ref('')
const isPremium = ref(false)

/* ===== 제외목록 유틸 ===== */
const filterByExcludeIds = (list, set) =>
  Array.isArray(list)
    ? list.filter(u => u && u._id && !(set instanceof Set ? set.has(String(u._id)) : false))
    : []

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
  for (const id of toIdList(chats)) set.add(id)         // ✅ 채팅상대(기존 대화 + 신규) 제외
  return set
}

/* ===== 타이머 포맷 ===== */
const formattedTime = computed(() => {
  const sec = remainingSeconds.value
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (sec <= 0) return ''
  if (h > 0) return `${h}시간 ${m}분 ${s}초`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
})

/* ===== 내비 ===== */
const goToUserProfile = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}

/* ===== 스크롤 유틸 ===== */
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

/* ===== 리셋 상태(일/사용자별) ===== */
const resetLimit = 500 // target.vue와 동일
const resetUsed = ref(0)
const resetIndex = ref(0)
const seedDay = ref('')
const viewerId = ref('')

function yyyymmddKST(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = fmt.formatToParts(date).reduce((o,p)=>{ o[p.type]=p.value; return o }, {})
  return `${parts.year}${parts.month}${parts.day}`
}
function loadResetState() {
  const day = yyyymmddKST()
  seedDay.value = day
  const key = `emg:${viewerId.value || 'anon'}:${day}`
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    resetUsed.value = Number(saved.used || 0)
    resetIndex.value = Number(saved.idx || 0)
  } catch {
    resetUsed.value = 0
    resetIndex.value = 0
  }
}
function saveResetState() {
  const key = `emg:${viewerId.value || 'anon'}:${seedDay.value || yyyymmddKST()}`
  localStorage.setItem(key, JSON.stringify({ used: resetUsed.value, idx: resetIndex.value }))
}

/* ===== 셔플(회전) 유틸 ===== */
function murmur32(str) {
  let h = 0 ^ str.length, i = 0, k
  while (str.length >= i + 4) {
    k = (str.charCodeAt(i) & 0xff)
      | ((str.charCodeAt(i + 1) & 0xff) << 8)
      | ((str.charCodeAt(i + 2) & 0xff) << 16)
      | ((str.charCodeAt(i + 3) & 0xff) << 24)
    k = Math.imul(k, 0x5bd1e995)
    k ^= k >>> 24
    k = Math.imul(k, 0x5bd1e995)
    h = Math.imul(h, 0x5bd1e995) ^ k
    i += 4
  }
  switch (str.length - i) {
    case 3: h ^= (str.charCodeAt(i + 2) & 0xff) << 16
    case 2: h ^= (str.charCodeAt(i + 1) & 0xff) << 8
    case 1: h ^= (str.charCodeAt(i) & 0xff); h = Math.imul(h, 0x5bd1e995)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return h >>> 0
}
function rotateBySeed(arr, seed, tag='EM') {
  if (!Array.isArray(arr) || arr.length === 0) return arr
  const off = murmur32(`${seed}::${tag}`) % arr.length
  if (off === 0) return arr
  return arr.slice(off).concat(arr.slice(0, off))
}

/* ===== 헤더 토글 ===== */
const onHeaderToggle = async (next) => {
  if (next) showAdvModal.value = true
  await updateEmergencyState(next)
}
const closeAdv = () => { showAdvModal.value = false }
const onAdvDidDismiss = () => { showAdvModal.value = false }

/* ===== 긴급 활성/목록 ===== */
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
const INCLUDE_ME_WHEN_ON = true   // ✅ 나 포함
const APPLY_FILTERS_TO_ME = false // ✅ 포함할 때는 필터도 건너뜀

function getLastAccessTs(u) {
  const lastLogin = u?.last_login ? new Date(u.last_login).getTime() : 0
  const updatedAt = u?.updatedAt ? new Date(u.updatedAt).getTime() : 0
  const activatedAt = u?.emergency?.activatedAt ? new Date(u.emergency.activatedAt).getTime() : 0
  return Math.max(lastLogin, updatedAt, activatedAt, 0)
}
function sortByLastAccessDesc(list) {
  return [...list].sort((a, b) => getLastAccessTs(b) - getLastAccessTs(a))
}
function upsertMeToTop(meObj) {
  if (!meObj?._id) return
  emergencyUsers.value = emergencyUsers.value.filter(u => u._id !== meObj._id)
  emergencyUsers.value.unshift(meObj)
}
function removeMeFromList(myId) {
  if (!myId) return
  emergencyUsers.value = emergencyUsers.value.filter(u => u._id !== myId)
}

/* ===== API/갱신 ===== */
async function fetchRelations() {
  try {
    const [friendsRes, blocksRes, sentRes, recvRes, chatsRes] = await Promise.all([
      api.get('/api/friends'),
      api.get('/api/blocks'),
      api.get('/api/friend-requests/sent'),
      api.get('/api/friend-requests/received'),
      api.get('/api/chatrooms/partners'), // ✅ 내가 대화한 상대 ID (신규)
    ])
    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []
    const chatUserIds = chatsRes?.data?.ids ?? []

    // 프리체크 제외 세트
    excludeIds.value  = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv, chats: chatUserIds })

    // 내부 Total 필터(Filter_listchat)가 참고하도록 me에 주입
    currentUser.value = {
      ...currentUser.value,
      chatUserIds,
    }
  } catch {
    excludeIds.value = new Set()
  }
}

const fetchEmergencyUsers = async () => {
  try {
    const res = await api.get('/api/emergencyusers')
    let list = res.data?.users || []
    const me = currentUser.value
    if (!me || !me._id) return

    // 1) 긴급 활성 유저만
    list = list.filter(isEmergencyActive)
    // 2) 프리체크 제외(친구/차단/대기/채팅상대)
    list = filterByExcludeIds(list, excludeIds.value)
    // 3) Premium Total 필터 (내부에 자기자신/리스트·채팅상대 제외 포함)
    list = applyTotalFilterPremium(list, me, { log: false })
    // 4) 최근성 정렬
    list = sortByLastAccessDesc(list)
    // 5) 리셋 시드 기반 회전
    const seed = `${seedDay.value || yyyymmddKST()}#${viewerId.value || 'anon'}#${resetIndex.value}`
    list = rotateBySeed(list, seed, 'EM')

    // 6) 옵션: 나 자신 포함 처리 (필요 시 필터 적용)
    const iAmActive = isEmergencyActive(me)
    if (INCLUDE_ME_WHEN_ON && iAmActive) {
      let addMe = true
      if (APPLY_FILTERS_TO_ME) {
        const selfPremium = applyTotalFilterPremium([me], me, { log: false })
        const selfFiltered = filterByExcludeIds(selfPremium, excludeIds.value)
        addMe = selfFiltered.length > 0
      }
      if (addMe) {
        list = list.filter(u => u._id !== me._id)
        list.unshift(me)
      }
    }

    emergencyUsers.value = list
  } catch (err) {
    console.error('❌ 목록 로딩 실패:', err)
  }
}

const updateEmergencyState = async (newState) => {
  try {
    const endpoint = newState ? '/api/emergencyon' : '/api/emergencyoff'
    const res = await api.put(endpoint)
    emergencyOn.value = newState

    if (newState) {
      const remaining = res.data.remainingSeconds
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
        if (INCLUDE_ME_WHEN_ON) {
          let me = { ...currentUser.value }
          let pass = true
          if (APPLY_FILTERS_TO_ME) {
            const selfPremium = applyTotalFilterPremium([me], me, { log: false })
            const selfFiltered = filterByExcludeIds(selfPremium, excludeIds.value)
            pass = selfFiltered.length > 0
          }
          if (pass) upsertMeToTop(me)
        }
        await nextTick()
        startCountdown(remaining)
      } else {
        await updateEmergencyState(false)
      }
    } else {
      clearCountdown()
      removeMeFromList(currentUser.value?._id)
      currentUser.value = {
        ...currentUser.value,
        emergency: { ...(currentUser.value.emergency || {}), isActive: false, remainingSeconds: 0 }
      }
    }

    // 목록 갱신 + 상단 스크롤
    await fetchEmergencyUsers()
    await nextTick()
    scrollToTopSmooth()
  } catch (err) {
    console.error('❌ 상태 변경 실패:', err)
    emergencyOn.value = false
    clearCountdown()
  }
}

/* ===== 소켓 ===== */
function initSocket() {
  try {
    const s = connectSharedSocket()
    socket.value = s
    s.on('connect', () => { try { s.emit('subscribe', { room: 'emergency' }) } catch (_) {} })
    s.on('emergency:refresh', fetchEmergencyUsers)
    s.on('emergency:userOn', fetchEmergencyUsers)
    s.on('emergency:userOff', fetchEmergencyUsers)
    s.on('user:lastLogin', async ({ userId, last_login }) => {
      let found = false
      emergencyUsers.value = emergencyUsers.value.map(u => {
        if (u._id === userId) { found = true; return { ...u, last_login } }
        return u
      })
      if (!found) await fetchEmergencyUsers()
    })
  } catch (e) {
    console.error('❌ [socket] 초기화 실패:', e)
  }
}
function cleanupSocket() {
  try {
    if (socket.value) {
      try { socket.value.emit('unsubscribe', { room: 'emergency' }) } catch (_) {}
      socket.value.disconnect()
    }
  } finally { socket.value = null }
}

/* ===== 타이머 ===== */
let countdownInterval = null
const startCountdown = (initial) => {
  clearCountdown()
  let left = initial
  countdownInterval = setInterval(async () => {
    if (left > 0) {
      left--
      remainingSeconds.value = left
    } else {
      clearCountdown()
      await updateEmergencyState(false)
    }
  }, 1000)
}
const clearCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval)
  countdownInterval = null
  remainingSeconds.value = 0
}

/* ===== 리셋 버튼 동작 ===== */
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
  saveResetState()
  await fetchEmergencyUsers()
  await nextTick()
  scrollToTopSmooth()
}

/* ===== 라이프사이클 ===== */
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

    loadResetState()
    await fetchRelations()

    if (emergencyOn.value && me?.emergency?.remainingSeconds > 0) {
      remainingSeconds.value = me.emergency.remainingSeconds
      startCountdown(remainingSeconds.value)
    } else if (emergencyOn.value) {
      await updateEmergencyState(false)
    }

    initSocket()
    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 사용자 정보 로딩 실패:', err)
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  clearCountdown()
  cleanupSocket()
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

/* emergency는 .ion-padding 안에서 렌더 → 타겟과 폭 맞춤 */
:deep(.users-list){
  margin-left: -16px;
  margin-right: -16px;
}

/* ===== target.vue와 동일한 버튼 룰 ===== */
/* (1) 가로 100% + 고정 높이 */
button[aria-label*="새로운 친구"] {
  width: 100%;
  height: 160px;
  border-radius: 14px;
}
/* (2) 정사각 비율로 쓸 경우 — target.vue와 동일하게 존재 */
button[aria-label*="새로운 친구"] {
  width: 110%;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
}

/* ✅ 리셋 확인 모달 */
.reset-modal-overlay{
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  display:flex; align-items:center; justify-content:center;
  z-index: 9999;
}
.reset-modal-card{
  width: min(88vw, 420px);
  background:#1a1a1d; color:#e7e7ea; border:1px solid #2a2a2e;
  border-radius:14px; padding:18px;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.reset-modal-text{ margin: 10px 0 18px; color:#bdbdc2; }
.reset-modal-actions{
  display:flex; gap:10px; justify-content:flex-end;
}
.btn-confirm, .btn-cancel{
  padding:8px 12px; border-radius:10px; border:1px solid #2a2a2e;
  background:#111114; color:#e7e7ea; cursor:pointer;
}
.btn-confirm{ background:#2a2a2e; }
.btn-confirm:focus, .btn-cancel:focus{ outline:2px solid #3a3a3f; outline-offset:2px; }
</style>
