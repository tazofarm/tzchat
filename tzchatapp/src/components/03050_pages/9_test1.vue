<!-- src/components/04010_Page0_emergency/Emergency_swape.vue (기존 파일을 교체하려면 원래 경로/파일명으로 저장하세요) -->
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
        :users="emergencyUsers"
        :is-loading="isLoading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        @userClick="u => goToUserProfile(u)"
      />
    </ion-content>
  </ion-page>
</template>

<script setup>
/* -----------------------------------------------------------
   Emergency (스와이프 카드형)
   - UserList → SwapeList로 변경
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
const emergencyUsers = ref([])
const isLoading = ref(true)
const emergencyOn = ref(false)
const remainingSeconds = ref(0)
const currentUser = ref({})
const showAdvModal = ref(false)
const router = useRouter()
const socket = ref(null)
const excludeIds = ref(new Set())

/* ✅ SwapeList 프리미엄 판정 전달용 */
const viewerLevel = ref('')
const isPremium = ref(false)

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

/* ===== Emergency 상태 판정/정렬 ===== */
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

/* ===== 라이프사이클 ===== */
onMounted(async () => {
  try {
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    emergencyOn.value = me?.emergency?.isActive === true

    const levelFromApi = me?.level || me?.user_level || me?.membership || ''
    viewerLevel.value = String(levelFromApi || '').trim()
    const premiumBool =
      me?.isPremium ?? me?.premium ?? (String(levelFromApi || '').trim() === '프리미엄')
    isPremium.value = Boolean(premiumBool)

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
}

/* ion-content 여백/세이프에어리어 제거 */
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

/* 상단 스위치 헤더: 좌우·상하 여백 제거 */
.em-header { padding: 0; margin: 0; }

/* (참고) SwapeList 내부에서 슬라이드/카드 여백 제거 스타일을 이미 설정해두는 것이 가장 확실합니다. */
</style>
