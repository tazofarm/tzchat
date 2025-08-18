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
            <ion-label class="black-text">Emergency Matching</ion-label>
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

        <!-- ===== 섹션 타이틀 ===== -->
        <div class="section-title-wrap" role="heading" aria-level="2">
          <div class="section-title-row">
            <ion-icon :icon="icons.shieldCheckmarkOutline" aria-hidden="true" class="section-icon" />
            <h2 class="section-title-text black-text">Emergency Matching List</h2>
          </div>
          <div class="section-divider" aria-hidden="true"></div>
        </div>

        <!-- ===== 목록 ===== -->
        <ion-list v-if="!isLoading && emergencyUsers.length" class="compact-list">
          <ion-item
            v-for="user in emergencyUsers"
            :key="user._id"
            :button="true"
            :detail="true"
            @click="goToUserProfile(user._id)"
          >
            <ion-icon :icon="icons.personCircleOutline" slot="start" class="list-leading-icon" />
            <ion-label class="black-text">
              <h3 class="row-title">
                <span class="nickname">{{ user.nickname }}</span>
              </h3>
              <p class="sub">
                <ion-icon :icon="icons.calendarOutline" aria-hidden="true" class="row-icon" />
                출생년도: {{ user.birthyear }}
              </p>
              <p class="sub">
                <ion-icon
                  :icon="user.gender === 'man' ? icons.maleOutline : user.gender === 'woman' ? icons.femaleOutline : icons.helpOutline"
                  aria-hidden="true"
                  class="row-icon"
                />
                성별:
                {{
                  user.gender === 'man' ? '남자'
                  : user.gender === 'woman' ? '여자'
                  : '미입력'
                }}
              </p>
              <!-- 마지막 접속 표시(정렬 기준) -->
              <p class="sub">
                <ion-icon :icon="icons.timerOutline" aria-hidden="true" class="row-icon" />
                마지막 접속: {{ formatLastAccess(user) }}
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
/* ------------------------------------------------------
   ✅ 변경 요약
   - Black + Gold 테마 유지, 섹션 타이틀 가시성 대폭 강화
   - 로직/이벤트 명/데이터 흐름 변경 없음
   - 풍부한 로그와 방어 코드 유지
------------------------------------------------------ */
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'
import {
  IonPage, IonContent, IonModal,
  IonText, IonList, IonItem, IonLabel, IonToggle, IonIcon
} from '@ionic/vue'
import {
  flameOutline,
  personCircleOutline,
  calendarOutline,
  maleOutline,
  femaleOutline,
  helpOutline,
  timerOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons'
import ModalAdv from '@/components/04010_Page0_emergency/Modal_adv.vue'

/* ✅ 통합 필터/관계 제외 */
import { applyTotalFilter } from '@/components/04210_Page2_target/Filter_total'
import { buildExcludeIdsSet } from '@/components/04210_Page2_target/Filter_List'

/* 🧩 Socket.IO 클라이언트 */
import { io } from 'socket.io-client'

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

/* ✅ 관계 제외용 ID Set */
const excludeIds = ref(new Set())

const icons = {
  flameOutline,
  personCircleOutline,
  calendarOutline,
  maleOutline,
  femaleOutline,
  helpOutline,
  timerOutline,
  shieldCheckmarkOutline,
}

/* 빌드 정보 로깅 */
console.log('[BUILD INFO]', {
  MODE: import.meta.env.MODE,
  BASE: import.meta.env.BASE_URL,
  API: import.meta.env.VITE_API_URL
})

/* 남은 시간 포맷 */
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

/* 라우팅 */
const goToUserProfile = (userId) => {
  if (!userId) return console.warn('❗ userId 없음')
  console.log('➡️ 사용자 프로필 페이지로 이동:', userId)
  router.push(`/home/user/${userId}`)
}

/* 토글 변경 */
const onToggleChange = async (event) => {
  const newState = event.detail.checked
  console.log('🛎️ onToggleChange:', { newState })
  if (newState) {
    console.log('🎬 보상형 광고 모달 오픈')
    showAdvModal.value = true
  }
  await updateEmergencyState(newState)
}

/* 모달 제어 */
const closeAdv = () => {
  console.log('🧹 모달 수동 닫기')
  showAdvModal.value = false
}
const onAdvDidDismiss = () => {
  console.log('✅ 모달 didDismiss 이벤트 수신')
  showAdvModal.value = false
}

/* 긴급 활성 여부 */
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
  } catch (e) {
    console.warn('⚠️ isEmergencyActive 예외:', e)
    return false
  }
}

/* 옵션 */
const INCLUDE_ME_WHEN_ON = true
const APPLY_FILTERS_TO_ME = false

/* 정렬 기준 */
function getLastAccessTs(u) {
  const lastLogin = u?.last_login ? new Date(u.last_login).getTime() : 0
  const updatedAt = u?.updatedAt ? new Date(u.updatedAt).getTime() : 0
  const activatedAt = u?.emergency?.activatedAt ? new Date(u.emergency.activatedAt).getTime() : 0
  return Math.max(lastLogin, updatedAt, activatedAt, 0)
}
function sortByLastAccessDesc(list) {
  return [...list].sort((a, b) => getLastAccessTs(b) - getLastAccessTs(a))
}

/* 내 계정 상단 배치/제거 */
function upsertMeToTop(meObj) {
  if (!meObj?._id) return
  emergencyUsers.value = emergencyUsers.value.filter(u => u._id !== meObj._id)
  emergencyUsers.value.unshift(meObj)
  console.log('👑 (즉시반영) 내 프로필을 목록 최상단에 배치')
}
function removeMeFromList(myId) {
  if (!myId) return
  const before = emergencyUsers.value.length
  emergencyUsers.value = emergencyUsers.value.filter(u => u._id !== myId)
  const after = emergencyUsers.value.length
  if (before !== after) console.log('🧹 (즉시반영) 내 프로필을 목록에서 제거')
}

/* 상태 변경(ON/OFF) */
const updateEmergencyState = async (newState) => {
  try {
    const endpoint = newState ? '/api/emergencyon' : '/api/emergencyoff'
    console.time(`[API] ${endpoint}`)
    const res = await axios.put(endpoint, {}, { withCredentials: true })
    console.timeEnd(`[API] ${endpoint}`)

    emergencyOn.value = newState
    console.log(`🚨 Emergency ${newState ? 'ON' : 'OFF'} 응답:`, res.data)

    if (newState) {
      const remaining = res.data.remainingSeconds
      if (remaining > 0) {
        remainingSeconds.value = remaining
        // 내 객체 반영
        currentUser.value = {
          ...currentUser.value,
          emergency: {
            ...(currentUser.value.emergency || {}),
            isActive: true,
            remainingSeconds: remaining,
            activatedAt: new Date().toISOString()
          }
        }
        // 즉시 목록 반영
        if (INCLUDE_ME_WHEN_ON) {
          let me = { ...currentUser.value }
          let pass = true
          if (APPLY_FILTERS_TO_ME) {
            const selfFiltered = applyTotalFilter([me], me, { excludeIds: excludeIds.value })
            pass = selfFiltered.length > 0
          }
          if (pass) upsertMeToTop(me)
          else console.log('ℹ️ 즉시반영: 필터 결과, 나는 제외(APPLY_FILTERS_TO_ME=true)')
        }
        // 카운트다운 시작
        await nextTick()
        setTimeout(() => startCountdown(remaining), 80)
      } else {
        console.warn('❌ 이미 만료됨 → 자동 OFF')
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

    // 서버 상태 동기화
    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 상태 변경 실패:', err)
    emergencyOn.value = false
    clearCountdown()
  }
}

/* 관계 데이터 로딩 */
async function fetchRelations() {
  try {
    console.time('[Users] relations')
    const [friendsRes, blocksRes, sentRes, recvRes] = await Promise.all([
      axios.get('/api/friends', { withCredentials: true }),
      axios.get('/api/blocks', { withCredentials: true }),
      axios.get('/api/friend-requests/sent', { withCredentials: true }),
      axios.get('/api/friend-requests/received', { withCredentials: true }),
    ])

    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []

    excludeIds.value = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv })

    console.log('[Emergency] excludeIds size:', excludeIds.value.size)
  } catch (e) {
    console.error('❌ 관계 데이터 로딩 실패:', e)
    excludeIds.value = new Set()
  } finally {
    console.timeEnd('[Users] relations')
  }
}

/* 목록 로드 + 필터 + 정렬 */
const fetchEmergencyUsers = async () => {
  console.time('[LOAD] /api/emergencyusers')
  try {
    const res = await axios.get('/api/emergencyusers', { withCredentials: true })
    let list = res.data?.users || []
    const me = currentUser.value

    if (!me || !me._id) {
      console.warn('⚠️ 현재 사용자 정보 없음 → 필터 스킵')
      return
    }

    list = list.filter(isEmergencyActive) // 긴급 ON만
    list = applyTotalFilter(list, me, { excludeIds: excludeIds.value }) // 통합 필터
    list = sortByLastAccessDesc(list) // 최신순

    // 나 자신 최상단(옵션)
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
        console.log('👑 내 프로필을 목록 최상단에 고정 표기')
      } else {
        console.log('ℹ️ 나 자신은 필터로 제외(APPLY_FILTERS_TO_ME=true)')
      }
    }

    emergencyUsers.value = list
    console.log(`📥 최종 긴급 사용자 목록(${list.length}명):`, list.map(u => ({ id: u._id, last_login: u.last_login })))
  } catch (err) {
    console.error('❌ 목록 로딩 실패:', err)
  } finally {
    console.timeEnd('[LOAD] /api/emergencyusers')
  }
}

/* 마지막 접속 시간 포맷 */
function formatLastAccess(u) {
  const ts = getLastAccessTs(u)
  if (!ts) return '기록 없음'
  const d = new Date(ts)
  const y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${M}.${D} ${h}:${m}`
}

/* 카운트다운 */
const startCountdown = (initial) => {
  clearCountdown()
  let localRemaining = initial
  countdownInterval = setInterval(async () => {
    if (localRemaining > 0) {
      localRemaining--
      remainingSeconds.value = localRemaining
    } else {
      console.log('⏱️ 타이머 만료 → 자동 OFF')
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

/* Socket.IO */
function connectSocket() {
  try {
    const SERVER_URL = import.meta.env.VITE_API_URL
    socket.value = io(SERVER_URL, { withCredentials: true, transports: ['websocket'] })

    socket.value.on('connect', () => {
      console.log('🔌 [socket] connected:', socket.value.id)
      socket.value.emit('subscribe', { room: 'emergency' })
    })

    socket.value.on('emergency:refresh', async (payload) => {
      console.log('📡 [socket] emergency:refresh:', payload)
      await fetchEmergencyUsers()
    })
    socket.value.on('emergency:userOn', async (payload) => {
      console.log('📡 [socket] emergency:userOn:', payload)
      await fetchEmergencyUsers()
    })
    socket.value.on('emergency:userOff', async (payload) => {
      console.log('📡 [socket] emergency:userOff:', payload)
      await fetchEmergencyUsers()
    })

    socket.value.on('user:lastLogin', async ({ userId, last_login }) => {
      console.log('📡 [socket] user:lastLogin:', { userId, last_login })
      let found = false
      emergencyUsers.value = emergencyUsers.value.map(u => {
        if (u._id === userId) { found = true; return { ...u, last_login } }
        return u
      })
      if (found) {
        const meId = currentUser.value?._id
        const meActiveTop = INCLUDE_ME_WHEN_ON && isEmergencyActive(currentUser.value)
        const listWithoutMe = emergencyUsers.value.filter(u => u._id !== meId)
        const sorted = sortByLastAccessDesc(listWithoutMe)
        emergencyUsers.value = meActiveTop ? [currentUser.value, ...sorted] : sorted
        console.log('🔁 [socket] 부분업데이트 정렬 완료')
      } else {
        await fetchEmergencyUsers()
      }
    })

    socket.value.on('disconnect', (reason) => console.warn('🔌 [socket] disconnected:', reason))
    socket.value.on('connect_error', (err) => console.error('❌ [socket] connect_error:', err.message))
  } catch (e) {
    console.error('❌ [socket] 초기화 실패:', e)
  }
}
function disconnectSocket() {
  try {
    if (socket.value) {
      socket.value.emit('unsubscribe', { room: 'emergency' })
      socket.value.disconnect()
      console.log('🔌 [socket] disconnected by client')
    }
  } catch (e) {
    console.error('❌ [socket] disconnect 실패:', e)
  } finally {
    socket.value = null
  }
}

/* 마운트/언마운트 */
onMounted(async () => {
  console.time('[LOAD] /api/me')
  try {
    const me = (await axios.get('/api/me', { withCredentials: true })).data.user
    currentUser.value = me
    nickname.value = me?.nickname || ''
    emergencyOn.value = me?.emergency?.isActive === true

    await fetchRelations() // 먼저 관계 제외 세팅

    if (emergencyOn.value && me?.emergency?.remainingSeconds > 0) {
      remainingSeconds.value = me.emergency.remainingSeconds
      await nextTick()
      setTimeout(() => startCountdown(remainingSeconds.value), 80)
    } else if (emergencyOn.value) {
      await updateEmergencyState(false)
    }

    connectSocket()
    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 사용자 정보 로딩 실패:', err)
  } finally {
    console.timeEnd('[LOAD] /api/me')
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  clearCountdown()
  disconnectSocket()
})
</script>

<style scoped>
/* =========================================================
   Black + Gold Theme (scoped)
   - 딥블랙 배경, 다크 패널, 골드 포인트
   - 섹션 타이틀 가시성 극대화 (문제 해결)
========================================================= */
:root,
:host {
  --bg: #0b0b0d;            /* 전체 배경(딥블랙) */
  --panel: #121214;         /* 리스트/카드 배경 */
  --panel-2: #17171a;       /* hover/pressed */
  --text-strong: #f3f3f3;   /* 타이틀 텍스트 */
  --text: #d7d7d9;          /* 본문 텍스트 */
  --text-dim: #a9a9ad;      /* 보조 텍스트 */
  --divider: #26262a;       /* 아이템 구분선 */
  --gold: #d4af37;          /* 골드(메인) */
  --gold-2: #f1cf5a;        /* 밝은 골드(hover) */
  --focus: rgba(212, 175, 55, 0.45); /* 포커스 링 */
}

/* ===== 기본: 다크 배경 적용 ===== */
ion-content {
  --background: var(--bg);
  color: var(--text);
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: contain;
}

/* ===== 상단 토글(한 줄) ===== */
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

/* 블랙 테마에서도 밝은 글자색 */
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
  text-shadow: none;
}
.toggle-label.off { color: var(--text-dim); }

/* ===== 남은 시간 ===== */
.countdown {
  color: var(--text);
  font-size: 14px;
  text-align: right;
  margin: 8px 0 10px;
}
.inline-icon { margin-right: 6px; vertical-align: -2px; color: var(--gold); }

/* ===== 섹션 타이틀(가시성 강화) ===== */
.section-title-wrap {
  margin: 6px 0 6px;
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;   /* 좌측 정렬로 시선 고정 */
  gap: 10px;
  padding: 8px 2px 6px;
}
.section-icon {
  font-size: 18px;
  color: var(--gold);
  filter: drop-shadow(0 0 4px rgba(212,175,55,0.35));
}
/* ★ 문제 해결 포인트: 강한 대비 + 약한 외곽선 + 글로우 + !important */
.section-title-text.black-text {
  color: var(--gold) !important;          /* 골드로 확실히 */
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.3px;
  margin: 0;
  line-height: 1.22;
  -webkit-text-stroke: 0.2px rgba(0,0,0,0.35);   /* 어두운 배경에서도 테두리로 또렷 */
  text-shadow:
    0 0 8px rgba(212,175,55,0.30),
    0 1px 0 rgba(0,0,0,0.35);
  opacity: 1 !important;                   /* 혹시 낮춰진 opacity 방지 */
}
/* 타이틀 하단 골드 라인으로 구분감 추가 */
.section-divider {
  height: 1px;
  margin: 6px 0 0;
  background: linear-gradient(90deg, rgba(212,175,55,0.0), rgba(212,175,55,0.8), rgba(212,175,55,0.0));
}

/* ===== 리스트(컴팩트) ===== */
.compact-list {
  background: var(--panel);
  margin: 10px 0 12px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(212,175,55,0.18);
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
}
ion-item {
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--divider);
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 56px;
  --background: transparent;
  color: var(--text);
  transition: background 0.18s ease, transform 0.06s ease;
}
ion-item:last-of-type { --inner-border-width: 0; }
ion-item:hover { background: var(--panel-2); }
ion-item:active { transform: translateY(1px); }

.list-leading-icon { font-size: 22px; color: var(--gold); }

.row-title {
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 2px;
  line-height: 1.26;
}
.nickname {
  font-weight: 800;
  letter-spacing: 0.2px;
  text-shadow: 0 0 10px rgba(212,175,55,0.08);
}

/* 서브 정보 라인 */
p.sub {
  color: var(--text);
  font-size: 13.5px;
  margin: 0;
  line-height: 1.28;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.95;
}
.row-icon { font-size: 14px; color: var(--gold); }

/* ===== 상태 텍스트 ===== */
ion-text p.ion-text-center {
  margin: 12px 0;
  font-size: 14px;
  color: var(--text-dim);
}

/* ===== 모달(컨텐츠 영역) ===== */
ion-modal::part(content) {
  background: var(--panel);
  color: var(--text);
  border: 1px solid rgba(212,175,55,0.18);
  box-shadow: 0 10px 28px rgba(0,0,0,0.5);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* ===== 포커스 ===== */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus);
  border-radius: 10px;
}

/* 초소형 화면(<=360px) 보정 */
@media (max-width: 360px) {
  .emergency-toggle { gap: 8px; }
  .section-title-text.black-text { font-size: 16px; }
  ion-item { --padding-start: 10px; --inner-padding-end: 10px; --min-height: 52px; }
}
</style>
