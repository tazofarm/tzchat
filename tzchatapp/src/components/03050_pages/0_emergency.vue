<!-- src/components/04010_Page0_emergency/Emergency.vue -->
<template>
  <ion-page>
    <ion-content fullscreen class="no-gutter">
      <!-- 보상형 광고 모달 -->
      <ion-modal
        :is-open="showAdvModal"
        @didDismiss="onAdvDidDismiss"
        :backdrop-dismiss="true"
      >
        <ModalAdv @close="closeAdv" />
      </ion-modal>

      <!-- ===== Speed Matching 헤더 ===== -->
      <div class="em-header">
        <EmergencySwitch
          :emergencyOn="emergencyOn"
          :formattedTime="formattedTime"
          @toggle="onHeaderToggle"
        />
      </div>

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
        class="reset-btn-wrap"
      >
        <button
          type="button"
          @click="openResetConfirm"
          :disabled="resetUsed >= resetLimit || isLoading"
          class="reset-action-card"
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
   Emergency 페이지 (distribution.js 적용 버전)
   - 서버 "긴급 활성" 유저 원본(rawEmergencyList)을 유지
   - 분산 선정 applyDistributedSelection으로 7명 노출
   - 옵션: 자기포함(INCLUDE_ME_WHEN_ON) 시 최상단 배치
   - 프리미엄 Total 필터: applyTotalFilterPremium 사용
   - 프리체크 제외: 친구/차단/대기/채팅상대 AND 적용
   - 리셋: seedDay + viewerId + resetIndex로 재분배
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import ModalAdv from '@/components/04010_Page0_emergency/Modal_adv.vue'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import EmergencySwitch from '@/components/02010_minipage/mini_emergency/emergencySwitch.vue'
import { applyTotalFilterPremium } from '@/components/04210_Page2_target/Filter/Total_Filter_premium'
import { connectSocket as connectSharedSocket } from '@/lib/socket'
import { applyDistributedSelection } from '@/components/04210_Page2_target/Logic/distribution'
import { IonPage, IonContent, IonModal } from '@ionic/vue'

/* ===== 상태 ===== */
const emergencyUsers = ref([])        // 화면 표시용(선정 결과 7명)
const rawEmergencyList = ref([])      // 서버 원본(긴급 활성)
const isLoading = ref(true)
const emergencyOn = ref(false)
const remainingSeconds = ref(0)
const currentUser = ref({})
const showAdvModal = ref(false)
const router = useRouter()
const socket = ref(null)
const excludeIds = ref(new Set())     // 친구/차단/대기/채팅상대 프리체크 제외

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
const resetLimit = 20 // target.vue와 동일
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

/* ===== 긴급 활성 판정 ===== */
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

/* 옵션: 나 포함 제어 */
const INCLUDE_ME_WHEN_ON = true     // ✅ 나 포함
const APPLY_FILTERS_TO_ME = false   // 포함할 때는 필터도 건너뜀

/* ===== 분산 재선정 ===== */
function recompute() {
  const me = currentUser.value
  // 분산 입력 리스트: 긴급 활성만 대상으로 사용
  let baseList = rawEmergencyList.value

  // 프리체크 제외(AND) → distribution 내부에도 excludeIdsSet를 전달
  baseList = filterByExcludeIds(baseList, excludeIds.value)

  // 분산 선정 실행 (프리미엄 필터를 applyTotalFilter로 전달)
  const selected = applyDistributedSelection(baseList, me, {
    seedDay: seedDay.value,
    viewerId: viewerId.value,
    resetIndex: resetIndex.value,
    excludeIdsSet: excludeIds.value,
    applyTotalFilter: (list, meArg) => applyTotalFilterPremium(list, meArg, { log: false }),
  })

  // 옵션: 나 자신이 긴급 활성인 경우 0번에 고정 배치
  if (INCLUDE_ME_WHEN_ON && isEmergencyActive(me)) {
    const withoutMe = selected.filter(u => u._id !== me._id)
    emergencyUsers.value = [me, ...withoutMe].slice(0, 7)
  } else {
    emergencyUsers.value = selected
  }
}

/* ===== API/갱신 ===== */
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
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []
    const chatUserIds = chatsRes?.data?.ids ?? []

    // 프리체크 제외 세트
    excludeIds.value  = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv, chats: chatUserIds })

    // me에 채팅상대 주입(내부 필터 참조용)
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
    const me = currentUser.value
    if (!me || !me._id) return

    // 원본: 긴급 활성 유저만
    let list = Array.isArray(res.data?.users) ? res.data.users : []
    list = list.filter(isEmergencyActive)

    rawEmergencyList.value = list
    recompute()
  } catch (err) {
    console.error('❌ 목록 로딩 실패:', err)
  }
}

/* ===== 긴급 on/off ===== */
const onHeaderToggle = async (next) => {
  if (next) showAdvModal.value = true
  await updateEmergencyState(next)
}
const closeAdv = () => { showAdvModal.value = false }
const onAdvDidDismiss = () => { showAdvModal.value = false }

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
    const refetch = async () => { await fetchEmergencyUsers() }
    s.on('emergency:refresh', refetch)
    s.on('emergency:userOn', refetch)
    s.on('emergency:userOff', refetch)
    s.on('user:lastLogin', async ({ userId, last_login }) => {
      let touched = false
      rawEmergencyList.value = rawEmergencyList.value.map(u => {
        if (u._id === userId) { touched = true; return { ...u, last_login } }
        return u
      })
      if (touched) {
        recompute()
      } else {
        await fetchEmergencyUsers()
      }
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
  recompute()
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

/* ✅ target.vue와 동일한 패딩 규칙(좌우 여백 제거) */
.no-gutter {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

/* 헤더 컨테이너(필요 시 최소 패딩만) */
.em-header {
  padding: 12px 12px 6px;
}

/* 리스트 래퍼: target와 폭 일치 (음수 마진 제거) */
.reset-btn-wrap {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  padding: 0 12px 16px;
}

/* ===== target.vue와 동일한 버튼 룰 ===== */
.reset-action-card {
  width: 100%;
  aspect-ratio: 2.5 / 1;  /* 정사각형 카드 */
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
