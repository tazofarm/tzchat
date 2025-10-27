<!-- src/components/04010_Page0_emergency/Emergency_swape.vue -->
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

      <!-- 상단 스위치 헤더 (패딩/마진 제거) -->
      <div class="em-header">
        <EmergencySwitch
          :emergencyOn="emergencyOn"
          :formattedTime="formattedTime"
          @toggle="onHeaderToggle"
        />
      </div>

      <!-- ✅ 공용 스와이프 리스트 (SwapeList) -->
      <SwapeList
        ref="swapeRef"
        :users="emergencyUsers"
        :is-loading="isLoading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        @userClick="u => goToUserProfile(u)"
      >
        <!-- ✅ 마지막에 붙는 '새로운 친구 보기' 카드 -->
        <template #tail>
          <div
            class="reset-card"
            role="button"
            tabindex="0"
            @click="openResetConfirm"
            @keyup.enter.space="openResetConfirm"
            :aria-disabled="resetUsed >= resetLimit || isLoading"
            :style="{ '--op': (resetUsed >= resetLimit || isLoading) ? 0.5 : 1 }"
          >
            <div class="reset-card-inner">
              <div class="reset-emoji">🔄</div>
              <div class="reset-title">새로운 친구 보기</div>
              <div class="reset-sub">({{ resetUsed }}/{{ resetLimit }})</div>
            </div>
          </div>
        </template>
      </SwapeList>

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
            지금 보이는 긴급 사용자 카드 구성이 바뀝니다. 진행할까요?
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
   Emergency (스와이프 카드형)
   - 맨 끝에 '새로운 친구 보기' 카드 추가 (#tail 슬롯)
   - 클릭 시 리셋 → 목록 재계산 → 첫 카드로 이동
   - 프리미엄 판정/필터/소켓/카운트다운 로직 유지
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import ModalAdv from '@/components/04010_Page0_emergency/Modal_adv.vue'
import EmergencySwitch from '@/components/02010_minipage/mini_emergency/emergencySwitch.vue'
import SwapeList from '@/components/02010_minipage/mini_list/swapeList.vue'
import { applyTotalFilterPremium } from '@/components/04210_Page2_target/Filter/Total_Filter_premium'
import { connectSocket as connectSharedSocket } from '@/lib/socket'
import { IonPage, IonContent, IonModal } from '@ionic/vue'

/* ===== 상태 ===== */
const swapeRef = ref(null)
const emergencyUsers = ref([])
const isLoading = ref(true)
const emergencyOn = ref(false)
const remainingSeconds = ref(0)
const currentUser = ref({})
const showAdvModal = ref(false)
const router = useRouter()
const socket = ref(null)
const excludeIds = ref(new Set())

/* ✅ 프리미엄회원 판정 전달용 */
const viewerLevel = ref('')
const isPremium = ref(false)

/* ===== 리셋 상태(일/사용자별) ===== */
const resetLimit = 500        // target.vue와 동일
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

/* ===== 유틸: 제외목록 필터/구성 ===== */
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
function buildExcludeIdsSet({ friends = [], blocks = [], pendingSent = [], pendingRecv = [] } = {}) {
  const set = new Set()
  for (const id of toIdList(friends)) set.add(id)
  for (const id of toIdList(blocks)) set.add(id)
  for (const id of toIdList(pendingSent)) set.add(id)
  for (const id of toIdList(pendingRecv)) set.add(id)
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
const goToUserProfile = (u) => {
  const id = typeof u === 'string' ? u : u?._id
  if (!id) return
  router.push(`/home/user/${id}`)
}

/* ===== 헤더 토글 ===== */
const onHeaderToggle = async (next) => {
  if (next) showAdvModal.value = true
  await updateEmergencyState(next)
}
const closeAdv = () => { showAdvModal.value = false }
const onAdvDidDismiss = () => { showAdvModal.value = false }

/* ===== Emergency 상태/정렬 ===== */
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
const INCLUDE_ME_WHEN_ON = true
const APPLY_FILTERS_TO_ME = false

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
            activatedAt: new Date().toISOString(),
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
    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 상태 변경 실패:', err)
    emergencyOn.value = false
    clearCountdown()
  }
}

/* ===== 관계/목록 ===== */
async function fetchRelations() {
  try {
    const [friendsRes, blocksRes, sentRes, recvRes] = await Promise.all([
      api.get('/api/friends'),
      api.get('/api/blocks'),
      api.get('/api/friend-requests/sent'),
      api.get('/api/friend-requests/received'),
    ])
    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []
    excludeIds.value  = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv })
  } catch { excludeIds.value = new Set() }
}

const fetchEmergencyUsers = async () => {
  try {
    const res = await api.get('/api/emergencyusers')
    let list = res.data?.users || []
    const me = currentUser.value
    if (!me || !me._id) return

    list = list.filter(isEmergencyActive)
    list = filterByExcludeIds(list, excludeIds.value)
    list = applyTotalFilterPremium(list, me, { log: false })
    list = sortByLastAccessDesc(list)

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
  } catch (e) { console.error('❌ [socket] 초기화 실패:', e) }
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

/* ===== 리셋 카드 동작 ===== */
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
  // 새 목록 반영
  await fetchEmergencyUsers()
  // 첫 슬라이드로 이동
  await nextTick()
  goToFirstCard()
}

/* ===== 첫 카드로 이동 (SwapeList API 케이스 커버) ===== */
function goToFirstCard() {
  const c = swapeRef.value
  if (!c) { try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {} ; return }
  if (typeof c.slideTo === 'function') { c.slideTo(0); return }
  if (typeof c.goTo === 'function') { c.goTo(0); return }
  if (typeof c.goToStart === 'function') { c.goToStart(); return }
  try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
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
    const premiumBool =
      me?.isPremium ?? me?.premium ?? (String(levelFromApi || '').trim() === '프리미엄회원')
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
   Black + Gold Theme (스와이프 전용 여백 제거)
========================================================= */
:root, :host {
  --bg: #0b0b0d;
  --text: #d7d7d9;
  --panel: #121214;
  --panel-2: #17171a;
  --divider: #26262a;
}

.no-gutter {
  --background: var(--bg);
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  --ion-safe-area-top: 0;
  --ion-safe-area-bottom: 0;
  --ion-safe-area-left: 0;
  --ion-safe-area-right: 0;
  padding: 0 !important;
  margin: 0 !important;
  color: var(--text);
  overscroll-behavior: none;
}

.em-header { padding: 0; margin: 0; }

/* ✅ 스와이프 마지막 '새로운 친구 보기' 카드 */
.reset-card{
  width: 100%;
  height: 260px; /* 카드 높이는 SwapeList 카드 비율에 맞게 조정 */
  display:flex; align-items:center; justify-content:center;
  border:1px solid var(--divider);
  border-radius: 16px;
  background: #151518;
  cursor:pointer;
  opacity: var(--op, 1);
}
.reset-card-inner{
  text-align:center;
  line-height:1.35;
}
.reset-emoji{ font-size: 42px; margin-bottom: 6px; }
.reset-title{ font-size: 18px; font-weight: 700; }
.reset-sub{ font-size: 14px; color:#a9a9ad; margin-top: 2px; }

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
