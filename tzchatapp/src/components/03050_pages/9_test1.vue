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
          <div class="toggle-title">
            <ion-icon :icon="icons.flameOutline" aria-hidden="true" class="title-icon" />
            <ion-label class="black-text">Speed Matcing</ion-label>
          </div>

          <ion-toggle
            :checked="emergencyOn"
            @ionChange="onToggleChange"
            color="danger"
            aria-label="Emergency Matching On/Off"
          ></ion-toggle>

          <span class="toggle-label black-text" :class="{ on: emergencyOn, off: !emergencyOn }">
            {{ emergencyOn ? 'ON' : 'OFF' }}
          </span>
        </div>

        <!-- 남은 시간 -->
        <div v-if="emergencyOn" class="countdown black-text" aria-live="polite">
          <ion-icon :icon="icons.timerOutline" aria-hidden="true" class="inline-icon" />
          남은 시간: {{ formattedTime }}
        </div>



        <!-- ===== 스와이프 카드 ===== -->
        <div v-if="!isLoading && emergencyUsers.length" class="swiper-area">
          <swiper
            class="user-cards"
            :modules="swiperModules"
            effect="cards"
            :grab-cursor="true"
            :loop="false"
            @swiper="onSwiperReady"
            @slideChange="onSlideChange"
          >
            <swiper-slide
              v-for="(user, idx) in emergencyUsers"
              :key="user._id || idx"
              @click="onCardTap(user)"
            >
              <div class="card" aria-label="사용자 카드">
                <!-- 📸 사진(가로 기준으로 꽉 채움) -->
                <div class="photo" :aria-label="`${user.nickname}의 대표 이미지`">
                  <ProfilePhotoViewer
                    :userId="user._id"
                    :gender="user.gender"
                    :size="800"
                  />
                </div>

                <!-- 🧾 아래 정보 -->
                <div class="info">
                  <h3 class="name"><span class="nick">{{ user.nickname }}</span></h3>

                  <p class="meta">
                    출생년도: {{ user.birthyear || '미입력' }} ·
                    성별: {{ user.gender === 'man' ? '남자' : '여자' }}
                  </p>

                  <p class="meta">
                    지역: {{ user.region1 || '미입력' }} / {{ user.region2 || '미입력' }}
                  </p>

                  <p class="meta">
                    성향: {{ user.preference || '미입력' }}
                  </p>

                  <p class="meta">최근접속: 회원전용</p>

                  <p class="meta">
                    멘션:
                    {{ ((user.selfintro ?? user.selfIntro ?? '') + '').trim() || '미입력' }}
                  </p>
                </div>
              </div>
            </swiper-slide>
          </swiper>
          <!-- 필요 시 진행 표시
          <div class="progress">{{ currentIndex + 1 }} / {{ emergencyUsers.length }}</div>
          -->
        </div>

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
  IonText, IonToggle, IonIcon
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

/* ✅ Swiper 추가 */
import { Swiper as SwiperCore } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'

import { applyTotalFilter } from '@/components/04210_Page2_target/Filter_total'
import { buildExcludeIdsSet } from '@/components/04210_Page2_target/Filter_List'
import { connectSocket as connectSharedSocket } from '@/lib/socket'

const swiperModules = [EffectCards]
const swiperRef = ref(null)
const currentIndex = ref(0)

const onSwiperReady = (swiper) => {
  swiperRef.value = swiper
  currentIndex.value = swiper?.activeIndex ?? 0
}
const onSlideChange = () => {
  if (!swiperRef.value) return
  currentIndex.value = swiperRef.value.activeIndex ?? 0
}
const onCardTap = (user) => {
  if (!user?._id) return
  router.push(`/home/user/${user._id}`)
}

/* ===== 기존 상태/로직 그대로 유지 ===== */
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

const onToggleChange = async (event) => {
  const newState = event.detail.checked
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

/* 상단 토글 */
.emergency-toggle {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 6px 2px 10px;
  border-bottom: 1px solid var(--divider);
  color: var(--text);
}
.toggle-title { display: inline-flex; align-items: center; gap: 8px; }
.title-icon { font-size: 18px; color: var(--gold); }

/* 블랙 테마 밝은 글자 */
.black-text { color: var(--text-strong); }

/* ON/OFF 캡슐 */
.toggle-label {
  font-weight: 800;
  color: var(--text-strong);
  font-size: 14px;
  letter-spacing: 0.2px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(212,175,55,0.35);
  background: linear-gradient(180deg, rgba(212,175,55,0.09), rgba(212,175,55,0.04));
}
.toggle-label.on {
  color: #f2f2f5;
  background: linear-gradient(180deg, var(--gold-2), var(--gold));
  border-color: var(--gold);
}
.toggle-label.off { color: var(--text-dim); }

/* 남은 시간 */
.countdown {
  color: var(--text);
  font-size: 14px;
  text-align: right;
  margin: 8px 0 10px;
}
.inline-icon { margin-right: 6px; vertical-align: -2px; color: var(--gold); }

/* 섹션 타이틀 */
.section-title-wrap { margin: 6px 0 6px; }
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 8px 2px 6px;
}
.section-icon { font-size: 18px; color: var(--gold); }
.section-title-text.black-text {
  color: var(--gold) !important;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.3px;
  margin: 0;
  line-height: 1.22;
}
.section-divider {
  height: 1px;
  margin: 6px 0 0;
  background: linear-gradient(90deg, rgba(212,175,55,0.0), rgba(212,175,55,0.8), rgba(212,175,55,0.0));
}

/* ===== 스와이프 레이아웃 ===== */
.swiper-area{
  width:100%;
  /* 카드 영역 높이 (상단 영역 제외하고 적당히) */
  height: clamp(460px, 72vh, 820px);
  padding:0; margin:10px 0 16px;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden;
}

.user-cards{
  width:100%;
  height:100%;
  overflow:hidden;
}

/* Swiper 내부도 100%로 맞춤 */
.user-cards :deep(.swiper-wrapper),
.user-cards :deep(.swiper-slide){
  width:100%;
  height:100%;
  overflow:hidden;
}

/* 카드 레이아웃 */
.card{
  width:100%; height:100%;
  display:flex; flex-direction:column;
  background:#000;
  border-radius: 12px;
}

/* 사진 박스 (원하는 폭/비율 유지) */
.photo{
  width:100%;
  max-width:100%;
  aspect-ratio: 4 / 4;       /* ← 사진 높이 비율 조절 포인트 */
  margin:0 auto;
  overflow:hidden;
  background:#000;
  display:flex; justify-content:center; align-items:center;
}

/* ProfilePhotoViewer 내부 이미지 채우기 */
.photo :deep(.viewer-host){ width:100%; height:100%; }
.photo :deep(.avatar){
  width:100% !important;
  height:100% !important;
  object-fit:cover;
  border-radius:0 !important;
  box-shadow:none !important;
  pointer-events:none;
}

/* 정보 영역은 남는 공간을 채우고, 내부만 스크롤 */
.info{
  flex:1;
  padding:14px 16px 16px;
  background:linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.55) 70%, rgba(0,0,0,0));
  color:#fff;
  overflow:auto;
}

.name{
  margin:0 0 6px;
  font-size:clamp(18px, 3.6vw, 22px);
  font-weight:900;
  color:#fff;
  line-height:1.25;
}
.nick{ font-weight:900; }
.meta{
  margin:0;
  color:#d0d0d0;
  font-size:clamp(14px, 2.8vw, 16px);
  line-height:1.45;
}
.pref{
  margin:8px 0 0;
  font-size:clamp(14px, 2.8vw, 16px);
  color:#f1f1f1;
}

/* (선택) 진행표시 */
.progress{
  position:fixed; bottom:10px; left:50%;
  transform:translateX(-50%);
  color:#eee; font-weight:700; font-size:14px;
}

/* 포커스 */
:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus); border-radius: 10px; }

/* 작은 화면 보정 */
@media (max-width: 360px){
  .info{ padding:12px 12px 14px; }
}
</style>
