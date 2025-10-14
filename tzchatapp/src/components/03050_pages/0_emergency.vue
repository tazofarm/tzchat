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
        <!-- ===== 분리된 Speed Matching 헤더 사용 ===== -->
        <EmergencySwitch
          :emergencyOn="emergencyOn"
          :formattedTime="formattedTime"
          @toggle="onHeaderToggle"
        />

        <!-- ===== 공통 리스트 컴포넌트 (프리미엄 판정 전달) ===== -->
        <UserList
          :users="emergencyUsers"
          :isLoading="isLoading"
          :viewer-level="viewerLevel"
          :is-premium="isPremium"
          emptyText="현재 긴급 사용자 없음"
          @select="u => goToUserProfile(u._id)"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
/* -----------------------------------------------------------
   Emergency (= Target 공통 리스트 + EmergencySwitch 헤더)
   - UserList에 viewer-level / is-premium 전달로
     특징/결혼 항목을 등급별로 가림
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
const excludeIds = ref(new Set())

/* ✅ UserList 프리미엄 판정 전달용 */
const viewerLevel = ref('')   // '일반회원' | '여성회원' | '프리미엄' 등
const isPremium = ref(false)  // 프리미엄이면 true → 실제값 노출, 아니면 가림

/* ===== 유틸: 제외목록 필터 ===== */
const filterByExcludeIds = (list, set) =>
  Array.isArray(list)
    ? list.filter(u => u && u._id && !(set instanceof Set ? set.has(String(u._id)) : false))
    : []

/* ===== (누락되어 있던) 제외목록 Set 구성 유틸 ===== */
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
const goToUserProfile = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}

/* ===== 헤더 토글 핸들러(자식 컴포넌트에서 emit) ===== */
const onHeaderToggle = async (next) => {
  if (next) showAdvModal.value = true
  await updateEmergencyState(next)
}
const closeAdv = () => { showAdvModal.value = false }
const onAdvDidDismiss = () => { showAdvModal.value = false }

/* ===== Emergency 상태/목록 ===== */
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

    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 상태 변경 실패:', err)
    emergencyOn.value = false
    clearCountdown()
  }
}

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

    excludeIds.value = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv })
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

    // ✅ Emergency 활성 → 제외목록 제거 → Premium 체인 → 정렬
    list = list.filter(isEmergencyActive)
    list = filterByExcludeIds(list, excludeIds.value)
    list = applyTotalFilterPremium(list, me, { log: false })
    list = sortByLastAccessDesc(list)

    // ✅ 나 자신 포함 로직 (옵션)
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

/* ===== 라이프사이클 ===== */
onMounted(async () => {
  try {
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    emergencyOn.value = me?.emergency?.isActive === true

    /* ✅ 등급/프리미엄 여부 설정 (여러 백엔드 필드명 대응) */
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
</style>
