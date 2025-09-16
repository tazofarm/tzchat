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
        <!-- ===== 상단 토글(한 줄) ===== -->
        <div class="emergency-toggle" role="group" aria-label="Emergency Matching Toggle">
          <!-- 좌측: 타이틀 -->
          <div class="toggle-title">
            <ion-icon :icon="icons.flameOutline" aria-hidden="true" class="title-icon" />
            <ion-label class="black-text">Speed Matching</ion-label>
          </div>

          <!-- 가운데: 남은 시간 -->
          <div v-if="emergencyOn" class="inline-timer black-text" aria-live="polite">
            <ion-icon :icon="icons.timerOutline" aria-hidden="true" class="inline-icon" />
            <span class="timer-text"> {{ formattedTime }}</span>
          </div>

          <!-- 우측: 커스텀 캡슐 스위치 -->
          <button
            type="button"
            class="pill-switch"
            :class="{ on: emergencyOn, off: !emergencyOn }"
            role="switch"
            :aria-checked="emergencyOn ? 'true' : 'false'"
            aria-label="Speed Matching On/Off"
            @click="onPillToggleClick"
          >
            <span class="knob" aria-hidden="true"></span>
            <span class="pill-text">{{ emergencyOn ? 'ON' : 'OFF' }}</span>
          </button>
        </div>

        <!-- ===== 섹션 타이틀 ===== -->
        <div class="section-title-wrap" role="heading" aria-level="2">
          <div class="section-title-row">
            <ion-icon :icon="icons.shieldCheckmarkOutline" aria-hidden="true" class="section-icon" />
            <h2 class="section-title-text black-text">Speed Matching List</h2>
          </div>
          <div class="section-divider" aria-hidden="true"></div>
        </div>

        <!-- ===== 목록 (2_target과 동일 규격) ===== -->
        <ion-list v-if="!isLoading && emergencyUsers.length" class="users-list">
          <ion-item
            v-for="user in emergencyUsers"
            :key="user._id"
            :button="true"
            :detail="true"
            class="user-item"
            @click="goToUserProfile(user._id)"
          >
            <!-- 좌측: 대표사진(원형 90px, 라이트박스 비활성) -->
            <div class="list-avatar" slot="start">
              <ProfilePhotoViewer
                :userId="user._id"
                :gender="user.gender"
                :size="90"
              />
            </div>

            <!-- 본문 -->
            <ion-label class="black-text">
              <h3 class="title">
                <span class="nickname">{{ user.nickname }}</span>
              </h3>

              <p class="meta">
                <ion-icon :icon="icons.calendarOutline" class="row-icon" aria-hidden="true" />
                출생년도 : {{ user.birthyear }}
              </p>

              <p class="meta">
                <ion-icon
                  :icon="user.gender === 'man' ? icons.maleOutline : icons.femaleOutline"
                  class="row-icon"
                  aria-hidden="true"
                />
                성별 : {{ user.gender === 'man' ? '남자' : '여자' }}
              </p>

              <p class="meta">
                <ion-icon :icon="icons.locationOutline" class="row-icon" aria-hidden="true" />
                지역 : {{ user.region1 }} / {{ user.region2 }}
              </p>

              <p class="meta">
                <ion-icon :icon="icons.chatbubblesOutline" class="row-icon" aria-hidden="true" />
                특징 : {{ user.preference }}
              </p>

              <p class="meta">
                <ion-icon :icon="icons.timeOutline" class="row-icon" aria-hidden="true" />
                최근 접속 : 회원전용
              </p>

              <p class="meta">
                <ion-icon :icon="icons.chatbubblesOutline" class="row-icon" aria-hidden="true" />
                멘션 : {{ user.selfintro }}
              </p>
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-text color="medium" v-else-if="!isLoading && !emergencyUsers.length">
          <p class="ion-text-center">현재 긴급 사용자 없음</p>
        </ion-text>

        <ion-text color="medium" v-else>
          <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
        </ion-text>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import {
  IonPage, IonContent, IonModal,
  IonText, IonList, IonItem, IonLabel, IonIcon
} from '@ionic/vue'
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
import ModalAdv from '@/components/04010_Page0_emergency/Modal_adv.vue'
import ProfilePhotoViewer from '@/components/02010_minipage/ProfilePhotoViewer.vue'

import { applyTotalFilter } from '@/components/04210_Page2_target/Filter_total'
import { buildExcludeIdsSet } from '@/components/04210_Page2_target/Filter_List'
import { connectSocket as connectSharedSocket } from '@/lib/socket'

const nickname = ref('')
const emergencyOn = ref(false)
const emergencyUsers = ref([])
const isLoading = ref(true)
const remainingSeconds = ref(0)
const currentUser = ref({})
let countdownInterval = null
const router = useRouter()
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
  if (!userId) return console.warn('❗ userId 없음')
  router.push(`/home/user/${userId}`)
}

/* 커스텀 캡슐 클릭 핸들러 */
const onPillToggleClick = async () => {
  const newState = !emergencyOn.value
  if (newState) showAdvModal.value = true
  await updateEmergencyState(newState)
}

const closeAdv = () => { showAdvModal.value = false }
const onAdvDidDismiss = () => { showAdvModal.value = false }

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
</script>

<style scoped>
/* =========================================================
   Black + Gold Theme (scoped)
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

/* 배경 */
ion-content {
  --background: var(--bg);
  color: var(--text);
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: contain;
}

/* ===== 상단 토글 한 줄 레이아웃 ===== */
.emergency-toggle {
  display: grid;
  grid-template-columns: 1fr auto auto; /* 타이틀 | 남은시간 | 스위치 */
  align-items: center;
  gap: 12px;
  padding: 6px 2px 10px;
  border-bottom: 1px solid var(--divider);
  color: var(--text);
}
.toggle-title { display: inline-flex; align-items: center; gap: 8px; }
.title-icon { font-size: 18px; color: var(--gold); }
.black-text { color: var(--text-strong); }

/* 가운데: 남은 시간 */
.inline-timer {
  display: inline-flex; align-items: center; gap: 6px;
  font-weight: 800; font-size: 14px; color: var(--text-strong);
  white-space: nowrap;
}
.inline-icon { margin-right: 0; vertical-align: -2px; color: var(--gold); }

/* ========= 우측 커스텀 캡슐 스위치 ========= */
/* ✅ 요구사항: ON일 때(초록) 동그라미 오른쪽 / OFF일 때(빨강) 동그라미 왼쪽 */
.pill-switch {
  position: relative;
  width: 86px;
  height: 36px;
  border-radius: 999px;
  border: 2px solid rgba(0,0,0,0.85);
  box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 10px rgba(0,0,0,0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.18s ease, border-color 0.18s ease;
  padding: 0;
  overflow: hidden;
}
.pill-switch .pill-text {
  font-weight: 900;
  letter-spacing: 0.6px;
  z-index: 1;
  pointer-events: none;
  color: #fff;               /* ✅ 글자색을 흰색으로 */
  font-size: 14px;
}
/* 동그라미 노브 */
.pill-switch .knob {
  position: absolute;
  top: 4px;
  left: 4px;                 /* ✅ 기본(OFF) = 왼쪽 */
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  transition: left 0.18s ease;
  z-index: 2;
}
/* 상태별 배경/노브 위치 */
.pill-switch.on  { background: linear-gradient(180deg, #6ad66a, #34c759); }  /* ✅ 초록 */
.pill-switch.off { background: linear-gradient(180deg, #ff8a8a, #f05a5a); }  /* ✅ 빨강 */
.pill-switch.on .knob { left: calc(100% - 4px - 28px); }  /* ✅ ON = 오른쪽 */

.pill-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus);
}

/* ===== 리스트 규격 ===== */
.users-list {
  background: var(--panel);
  margin: 10px 12px 16px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
}

/* 기본 ion-item 스타일은 두고, 실제 여백은 .user-item에서 제어 */
ion-item {
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--divider);
  --background: transparent;
  color: var(--text);
  transition: background 0.18s ease, transform 0.06s ease;
}
ion-item:last-of-type { --inner-border-width: 0; }
ion-item:hover { background: var(--panel-2); }
ion-item:active { transform: translateY(1px); }

/* 좌우 패딩 */
.user-item{
  --padding-start: 12px;
  --inner-padding-start: 12px;
  --padding-end: 10px;
  --inner-padding-end: 10px;
  --min-height: 60px;
}
.user-item::part(native){
  padding-left: 15px !important;
  padding-right: 10px !important;
}

/* start 슬롯 기본 여백 제거 */
.user-item [slot="start"]{
  margin-inline-start: 0 !important;
}

/* 아바타 */
.list-avatar{
  width: 90px; height: 90px; min-width: 90px;
  margin-right: 10px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10%;
  overflow: hidden;
  border: 1px solid rgba(212,175,55,0.18);
  background: rgba(212,175,55,0.08);
}
.list-avatar :deep(.viewer-host){ width:100%; height:100%; }
.list-avatar :deep(.avatar){
  width:100% !important; height:100% !important;
  object-fit: cover; border-radius:0 !important;
  box-shadow:none !important; pointer-events:none;
}

/* 본문 텍스트/타이틀 */
.title {
  color: var(--text-strong);
  font-size: clamp(15px, 2.6vw, 16px);
  font-weight: 800;
  margin: 0 0 4px;
  line-height: 1.28;
}
.nickname { font-weight: 800; letter-spacing: 0.2px; text-shadow: 0 0 10px rgba(212,175,55,0.08); }

.meta {
  display: flex; align-items: center; gap: 6px;
  color: var(--text); font-size: clamp(13px, 2.4vw, 14px);
  margin: 2px 0 0;
  line-height: 1.32; opacity: 0.94;
}
.row-icon { font-size: 15px; color: var(--gold); }

/* 안내문 */
ion-text p.ion-text-center {
  margin: 16px 0;
  font-size: clamp(14px, 2.6vw, 15px);
  color: var(--text-dim);
}

/* 작은 화면 보정 */
@media (max-width: 360px) {
  .emergency-toggle { gap: 8px; }
  .pill-switch { width: 78px; height: 32px; }
  .pill-switch .knob { width: 24px; height: 24px; top: 4px; }
  .pill-switch.on .knob { left: calc(100% - 4px - 24px); }

  .users-list { margin: 8px; border-radius: 12px; }
  .user-item{ --padding-end: 10px; --inner-padding-end: 10px; --min-height: 56px; }
}
</style>
