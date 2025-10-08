<!-- src/components/03050_pages/0_emergency.vue -->
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
        <!-- ===== 상단 토글: 공용 컴포넌트 사용 ===== -->
        <EmergencySwitch
          :emergency-on="emergencyOn"
          :formatted-time="formattedTime"
          :icons="icons"
          :pill-vars="pillVars"
          @toggle="onPillToggleClick"
        />

        <!-- ===== 스와이프 카드: 공용 컴포넌트 사용 ===== -->
        <SwapeList
          :users="emergencyUsers"
          :is-loading="isLoading"
          @userClick="goToUserProfile"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { IonPage, IonContent, IonModal } from '@ionic/vue'

/* 공용 컴포넌트 */
import EmergencySwitch from '@/components/02010_minipage/mini_emergency/emergencySwitch.vue'
import SwapeList from '@/components/02010_minipage/mini_list/swapeList.vue'

/* 기타 의존성 */
import ModalAdv from '@/components/04010_Page0_emergency/Modal_adv.vue'
import {
  flameOutline,
  calendarOutline,
  maleOutline,
  femaleOutline,
  locationOutline,
  chatbubblesOutline,
  timeOutline,
  timerOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons'

import { applyTotalFilter } from '@/components/04210_Page2_target/total/Filter_total'
import { buildExcludeIdsSet } from '@/components/04210_Page2_target/Filter_List'
import { connectSocket as connectSharedSocket } from '@/lib/socket'

/* ===== 상태/로직 ===== */
const router = useRouter()

const nickname = ref('')
const emergencyOn = ref(false)
const emergencyUsers = ref([])
const isLoading = ref(true)
const remainingSeconds = ref(0)
const currentUser = ref({})

let countdownInterval = null
const showAdvModal = ref(false)
const socket = ref(null)
const excludeIds = ref(new Set())

const icons = {
  flameOutline,
  calendarOutline,
  maleOutline,
  femaleOutline,
  locationOutline,
  chatbubblesOutline,
  timeOutline,
  timerOutline,
  shieldCheckmarkOutline,
}

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

const goToUserProfile = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}

/* ✅ 커스텀 스위치 토글 */
const onPillToggleClick = async () => {
  const newState = !emergencyOn.value
  if (newState) showAdvModal.value = true
  await updateEmergencyState(newState)
}
const closeAdv = () => { showAdvModal.value = false }
const onAdvDidDismiss = () => { showAdvModal.value = false }

/* ===== (나머지 기존 로직 동일) ===== */
function isEmergencyActive(u) {
  try {
    const em = u?.emergency || {}
    if (typeof em.remainingSeconds === 'number') {
      return em.isActive === true && em.remainingSeconds > 0
    }
    if (em.isActive && em.activatedAt) {
      const activatedAt = new Date(em.activatedAt).getTime()
      const now = Date.now()
      const ONE_HOUR = 60 * 60 * 1000
      return now - activatedAt < ONE_HOUR
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
            const selfFiltered = applyTotalFilter([me], me, { excludeIds: excludeIds.value })
            pass = selfFiltered.length > 0
          }
          if (pass) upsertMeToTop(me)
        }
        await nextTick()
        setTimeout(() => startCountdown(remaining), 80)
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

    list = list.filter(isEmergencyActive)
    list = applyTotalFilter(list, me, { excludeIds: excludeIds.value })
    list = sortByLastAccessDesc(list)

    const iAmActive = isEmergencyActive(me)
    if (INCLUDE_ME_WHEN_ON && iAmActive) {
      let addMe = true
      if (APPLY_FILTERS_TO_ME) {
        const selfFiltered = applyTotalFilter([me], me, { excludeIds: excludeIds.value })
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

const startCountdown = (initial) => {
  clearCountdown()
  let localRemaining = initial
  countdownInterval = setInterval(async () => {
    if (localRemaining > 0) {
      localRemaining--
      remainingSeconds.value = localRemaining
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

function initSocket() {
  try {
    const s = connectSharedSocket()
    socket.value = s

    s.on('connect', () => {
      try { s.emit('subscribe', { room: 'emergency' }) } catch (_) {}
    })

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

    s.on('disconnect', () => {})
    s.on('connect_error', (err) => console.error('❌ [socket] connect_error:', err?.message))
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
  } finally {
    socket.value = null
  }
}

onMounted(async () => {
  try {
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    nickname.value = me?.nickname || ''
    emergencyOn.value = me?.emergency?.isActive === true

    await fetchRelations()

    if (emergencyOn.value && me?.emergency?.remainingSeconds > 0) {
      remainingSeconds.value = me.emergency.remainingSeconds
      await nextTick()
      setTimeout(() => startCountdown(remainingSeconds.value), 80)
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

/* ✅ 스위치 크기/여백/글씨크기: inline CSS 변수 */
const pillVars = {
  '--pill-w': '86px',
  '--pill-h': '36px',
  '--knob': '28px',
  '--gap': '4px',
  '--side-pad': 'calc(var(--knob) + var(--gap) * 2)',
  '--pill-font': '14px',
}
</script>

<style scoped>
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
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: contain;
}

:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus); border-radius: 10px; }
</style>
