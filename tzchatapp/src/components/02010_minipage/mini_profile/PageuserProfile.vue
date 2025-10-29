<!-- src/02010_minipage/mini_profile/PageuserProfile.vue -->
<template>
  <div class="page-wrapper">
    <div class="container">

      <!-- 프로필 카드 -->
      <div class="card pf-scope">
        <div class="card-header">
          <h3 class="card-title">
            <IonIcon :icon="icons.personCircleOutline" class="title-icon" />
            {{ user.nickname || '-' }}
          </h3>
          <button class="title-action-btn" type="button" @click="goBack" aria-label="뒤로가기">
            <IonIcon :icon="icons.chevronBackOutline" class="action-icon" />
            <span class="action-text">뒤로</span>
          </button>
        </div>

        <div class="photo-slot">
          <ProfilePhotoViewer
            :user-id="user._id || String(route.params.id)"
            :gender="user.gender || ''"
            :size="125"
          />
        </div>

        <table class="info-table">
          <colgroup><col class="pf-col-th"/><col class="pf-col-td"/></colgroup>
          <tbody>
            <tr>
              <td class="pf-th"><IonIcon :icon="icons.maleFemaleOutline" class="row-icon"/><strong class="label">성별</strong></td>
              <td class="pf-td readonly">{{ user.gender === 'man' ? '남자' : user.gender === 'woman' ? '여자' : '-' }}</td>
            </tr>
            <tr>
              <td class="pf-th"><IonIcon :icon="icons.calendarOutline" class="row-icon"/><strong class="label">출생년도</strong></td>
              <td class="pf-td readonly">{{ user.birthyear || '-' }}</td>
            </tr>
            <tr>
              <td class="pf-th"><IonIcon :icon="icons.locationOutline" class="row-icon"/><strong class="label">지역</strong></td>
              <td class="pf-td readonly">{{ user.region1 || '' }} {{ user.region2 || '' }}</td>
            </tr>
            <tr>
              <td class="pf-th"><IonIcon :icon="icons.sparklesOutline" class="row-icon"/><strong class="label">특징</strong></td>
              <td class="pf-td readonly">{{ viewerIsPremium ? (user.preference || '-') : '🔒' }}</td>
            </tr>
            <tr>
              <td class="pf-th"><IonIcon :icon="icons.sparklesOutline" class="row-icon"/><strong class="label">결혼</strong></td>
              <td class="pf-td readonly">{{ viewerIsPremium ? (user.marriage || '-') : '🔒' }}</td>
            </tr>
          </tbody>
        </table>

        <table class="info-table">
          <colgroup><col class="pf-col-th"/><col class="pf-col-td"/></colgroup>
          <tbody>
            <tr class="editable-row" @click="openIntroModal" tabindex="0" @keydown.enter="openIntroModal">
              <td class="pf-th"><IonIcon :icon="icons.chatbubbleEllipsesOutline" class="row-icon"/><strong class="label">소개</strong></td>
              <td class="pf-td editable-text intro-cell">
                <span class="intro-preview">{{ user.selfintro || '없음' }}</span>
                <span class="intro-more"><IonIcon :icon="icons.chevronForwardOutline" class="more-icon"/></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 액션 영역 -->
      <div class="card pf-scope">
        <!-- ✅ 3열 그리드 배치
             1열: 버튼A(두 줄 높이로 세로 확장)
             2~3열(상단): 대화하기(두 칸 가로 확장)
             2열(하단): 차단하기
             3열(하단): 신고하기 -->
        <div class="action-grid" role="group" aria-label="사용자 액션">

          <!-- ░ 버튼A (친구신청/신청취소/수락하기/친구삭제/차단해제) : 왼쪽, 두 줄 높이 -->
          <!-- 수락하기 -->
          <ion-button
            v-if="!user.isFriend && hasIncomingRequest && !user.isBlocked"
            type="button"
            class="btn-primary slot-a"
            :disabled="isSubmitting"
            @click="acceptIncomingRequest"
          >
            <IonIcon :icon="icons.checkmarkCircleOutline" class="btn-icon" />
            수락하기
          </ion-button>

          <!-- 친구신청 -->
          <ion-button
            v-else-if="!user.isFriend && !hasPendingRequest && !hasIncomingRequest && !user.isBlocked"
            type="button"
            class="btn-outline slot-a"
            :disabled="showRequestModal || isSubmitting"
            @click="onOpenFriendRequest"
          >
            <IonIcon :icon="icons.personAddOutline" class="btn-icon" />
            친구신청
          </ion-button>

          <!-- 신청취소 -->
          <ion-button
            v-else-if="!user.isFriend && hasPendingRequest && !user.isBlocked"
            type="button"
            class="btn-warning slot-a"
            :disabled="isSubmitting"
            @click="cancelFriendRequest"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            신청취소
          </ion-button>

          <!-- 친구삭제 -->
          <ion-button
            v-else-if="user.isFriend && !user.isBlocked"
            type="button"
            class="btn-danger slot-a"
            :disabled="isSubmitting"
            @click="removeFriend(user._id)"
          >
            <IonIcon :icon="icons.personRemoveOutline" class="btn-icon" />
            친구삭제
          </ion-button>

          <!-- 차단해제 -->
          <ion-button
            v-else
            type="button"
            class="btn-muted slot-a"
            :disabled="isSubmitting"
            @click="unblockUser(user._id)"
          >
            <IonIcon :icon="icons.checkmarkCircleOutline" class="btn-icon" />
            차단해제
          </ion-button>

          <!-- ░ 대화하기 : 오른쪽 상단, 두 칸 가로 확장 -->
          <ion-button
            type="button"
            class="btn-primary slot-chat"
            :disabled="!user.isFriend || isSubmitting"
            @click="startChat(user._id)"
          >
            <IonIcon :icon="icons.chatbubblesOutline" class="btn-icon" />
            대화하기
          </ion-button>

          <!-- ░ 차단하기 : 오른쪽 하단-왼쪽 칸 -->
          <ion-button
            v-if="!user.isBlocked"
            type="button"
            class="btn-warning slot-block"
            :disabled="isSubmitting"
            @click="blockUser(user._id)"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            차단하기
          </ion-button>

          <!-- ░ 신고하기 : 오른쪽 하단-오른쪽 칸 -->
          <ion-button
            type="button"
            class="btn-secondary slot-report"
            :disabled="isSubmitting"
            @click="reportUser(user._id)"
          >
            <IonIcon :icon="icons.alertCircleOutline" class="btn-icon" />
            신고하기
          </ion-button>
        </div>
      </div>

      <!-- 소개 모달 -->
      <div v-if="showIntroModal" class="popup-overlay" role="presentation" @click.self="closeIntroModal">
        <div class="popup-content" role="dialog" aria-modal="true" aria-labelledby="intro-modal-title">
          <h3 id="intro-modal-title">소개</h3>
          <p class="intro-full">{{ user.selfintro || '소개가 없습니다.' }}</p>
          <div class="footer-btns">
            <ion-button type="button" class="btn-primary" expand="block" @click="closeIntroModal">확인</ion-button>
          </div>
        </div>
      </div>

      <!-- 친구 신청 모달 -->
      <div v-if="showRequestModal" class="popup-overlay" role="presentation" @click.self="onCloseFriendRequest">
        <div class="popup-content" role="dialog" aria-modal="true" aria-labelledby="fr-modal-title">
          <h3 id="fr-modal-title">친구 신청</h3>
          <textarea v-model="requestMessage" class="request-input" placeholder="인사말을 입력하세요 (선택)" rows="4"></textarea>
          <div class="footer-btns">
            <ion-button type="button" class="btn-primary" expand="block" :disabled="isSubmitting" @click="sendFriendRequest">신청 보내기</ion-button>
            <ion-button type="button" class="btn-muted"   expand="block" :disabled="isSubmitting" @click="onCloseFriendRequest">취소</ion-button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { IonButton as ionButton, IonIcon } from '@ionic/vue'
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/lib/api'
import { isAxiosError } from 'axios'
import ProfilePhotoViewer from '@/components/02010_minipage/mini_profile/ProfilePhotoViewer.vue'

import {
  personCircleOutline,
  maleFemaleOutline,
  calendarOutline,
  locationOutline,
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  chevronBackOutline,
  statsChartOutline,
  chatbubblesOutline,
  personAddOutline,
  personRemoveOutline,
  removeCircleOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  sparklesOutline
} from 'ionicons/icons'

const icons = {
  personCircleOutline,
  maleFemaleOutline,
  calendarOutline,
  locationOutline,
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  chevronBackOutline,
  statsChartOutline,
  chatbubblesOutline,
  personAddOutline,
  personRemoveOutline,
  removeCircleOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  sparklesOutline
};

const route = useRoute()
const router = useRouter()

const user = ref<any>({
  _id: '',
  username: '',
  nickname: '',
  gender: '',
  birthyear: '',
  region1: '',
  region2: '',
  preference: '',
  marriage: '',
  selfintro: '',
  user_level: '',
  isFriend: false,
  isBlocked: false,
  sentRequestCountTotal: 0,
  receivedRequestCountTotal: 0,
  acceptedChatCountTotal: 0
})

const viewerLevel = ref<string>('')
const viewerIsPremium = computed<boolean>(() => {
  const lv = (viewerLevel.value || '').trim().toLowerCase()
  if (['프리미엄회원','premium','premium_member','prem'].includes(lv)) return true
  const lvLS = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim().toLowerCase()
  if (['프리미엄회원','premium','premium_member','prem'].includes(lvLS)) return true
  const boolish = (localStorage.getItem('isPremium') || '').trim().toLowerCase()
  if (['true','1','yes','y'].includes(boolish)) return true
  return false
})
const isPremium = viewerIsPremium

const showIntroModal = ref(false)
const showRequestModal = ref(false)
const requestMessage = ref('')

const isSubmitting = ref(false)
const hasPendingRequest = ref(false)
const pendingRequestId = ref<string|null>(null)
const hasIncomingRequest = ref(false)
const incomingRequestId = ref<string|null>(null)

function extractError(e: unknown) {
  if (isAxiosError(e)) return e.response?.data ?? e.message
  if (e instanceof Error) return e.message
  try { return JSON.stringify(e) } catch { return String(e) }
}

function openIntroModal() { showIntroModal.value = true }
function closeIntroModal() { showIntroModal.value = false }

async function loadUser() {
  const targetId = String(route.params.id || '')
  const res = await axios.get(`/api/users/${targetId}`, { withCredentials: true })
  const data = (res.data as any)?.user ?? res.data ?? {}
  user.value = {
    ...user.value,
    ...data,
    _id: String(data._id || targetId),
    isFriend: !!data.isFriend,
    isBlocked: !!data.isBlocked,
    user_level: data.user_level || data.level || user.value.user_level || '일반회원',
    sentRequestCountTotal: data.sentRequestCountTotal ?? 0,
    receivedRequestCountTotal: data.receivedRequestCountTotal ?? 0,
    acceptedChatCountTotal: data.acceptedChatCountTotal ?? 0
  }
}

async function loadViewerLevel() {
  try {
    const meRes = await axios.get('/api/me', { withCredentials: true })
    const me = meRes?.data?.user ?? {}
    viewerLevel.value = String(me?.level || me?.user_level || me?.membership || '').trim()
  } catch {
    viewerLevel.value = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim()
  }
}

async function syncPendingRequestState() {
  try {
    const targetId = String(user.value._id || route.params.id || '')
    if (!targetId) return
    const res = await axios.get('/api/friend-requests/sent', { withCredentials: true })
    const list = (res.data?.requests ?? res.data ?? []) as any[]
    const pending = list.find((r:any) => (String(r.to?._id ?? r.to) === targetId) && String(r.status).toLowerCase() === 'pending')
    hasPendingRequest.value = !!pending
    pendingRequestId.value = pending?._id ?? null
  } catch {
    hasPendingRequest.value = false
    pendingRequestId.value = null
  }
}

async function syncIncomingRequestState() {
  try {
    const targetId = String(user.value._id || route.params.id || '')
    if (!targetId) return
    const res = await axios.get('/api/friend-requests/received', { withCredentials: true })
    const list = (res.data?.requests ?? res.data ?? []) as any[]
    const pending = list.find((r:any) => (String(r.from?._id ?? r.from) === targetId) && String(r.status).toLowerCase() === 'pending')
    hasIncomingRequest.value = !!pending
    incomingRequestId.value = pending?._id ?? null
  } catch {
    hasIncomingRequest.value = false
    incomingRequestId.value = null
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadUser(), loadViewerLevel()])
    await Promise.all([syncPendingRequestState(), syncIncomingRequestState()])
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', extractError(e))
  }
})

function onOpenFriendRequest() {
  if (!user.value._id || user.value.isBlocked || hasPendingRequest.value || hasIncomingRequest.value) return
  requestMessage.value = ''
  showRequestModal.value = true
}
function onCloseFriendRequest() { showRequestModal.value = false }

async function sendFriendRequest() {
  if (!user.value._id) return
  try {
    isSubmitting.value = true
    const payload = { to: user.value._id, message: requestMessage.value }
    const res = await axios.post('/api/friend-request', payload, { withCredentials: true })
    const reqId = res.data?._id ?? res.data?.request?._id ?? null
    pendingRequestId.value = reqId
    hasPendingRequest.value = true
    showRequestModal.value = false
  } finally { isSubmitting.value = false }
}

async function cancelFriendRequest() {
  if (!pendingRequestId.value) { await syncPendingRequestState(); if (!pendingRequestId.value) return }
  try {
    isSubmitting.value = true
    await axios.delete(`/api/friend-request/${pendingRequestId.value}`, { withCredentials: true })
    hasPendingRequest.value = false
    pendingRequestId.value = null
  } finally { isSubmitting.value = false }
}

async function acceptIncomingRequest() {
  if (!incomingRequestId.value) { await syncIncomingRequestState(); if (!incomingRequestId.value) return }
  try {
    isSubmitting.value = true
    await axios.put(`/api/friend-request/${incomingRequestId.value}/accept`, {}, { withCredentials: true })
    user.value.isFriend = true
    hasIncomingRequest.value = false
    incomingRequestId.value = null
    hasPendingRequest.value = false
    pendingRequestId.value = null
  } finally { isSubmitting.value = false }
}

function startChat(targetId: string) { console.log('💬 대화 시작:', targetId) }

async function removeFriend(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.delete(`/api/friend/${String(targetId)}`, { withCredentials: true })
    user.value.isFriend = false
  } finally { isSubmitting.value = false }
}

async function blockUser(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.put(`/api/block/${String(targetId)}`, {}, { withCredentials: true })
    user.value.isBlocked = true
    hasPendingRequest.value = false
    pendingRequestId.value = null
    hasIncomingRequest.value = false
    incomingRequestId.value = null
    try { await router.push('/home/3page') } catch {}
  } finally { isSubmitting.value = false }
}

async function unblockUser(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.delete(`/api/block/${String(targetId)}`, { withCredentials: true })
    user.value.isBlocked = false
  } finally { isSubmitting.value = false }
}

function getReporterId() {
  return localStorage.getItem('userId') || localStorage.getItem('id') || localStorage.getItem('_id') || 'unknown'
}
function getReporterNickname() {
  return localStorage.getItem('nickname') || localStorage.getItem('username') || localStorage.getItem('name') || 'unknown'
}
function reportUser(targetId: string) {
  const email = 'tazocode@gmail.com'
  const subject = '(네네챗 사용자 신고)'
  const reporterId = getReporterId()
  const reporterNickname = getReporterNickname()
  const targetUserId = String(user.value._id || targetId || route.params.id || '')
  const targetNickname = user.value.nickname || user.value.username || '-'
  const bodyLines = [
    '아래 사용자에 대한 신고가 접수되었습니다.','','--- 신고자 정보 ---',
    `아이디: ${reporterId}`,`닉네임: ${reporterNickname}`,'','--- 신고 대상자 정보 ---',
    `아이디: ${targetUserId}`,`닉네임: ${targetNickname}`,'','--- 추가 작성 ---','신고 사유: ','관련 스크린샷/증빙이 있으면 첨부해 주세요.'
  ]
  const body = encodeURIComponent(bodyLines.join('\n'))
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`
}
function goBack() { router.back() }
</script>

<style scoped>
:root {
  --bg: #0f0f10;
  --card: #161616;
  --text: #eaeaea;
  --text-strong: #ffffff;
  --text-dim: #b8b8b8;
  --divider: #2b2b2b;
  --gold: #D4AF37;
  --gold-2: #c19b2e;
}
 
.page-wrapper { background: var(--bg); min-height: 100dvh; min-height: -webkit-fill-available; box-sizing: border-box; padding: 0px; color: var(--text); width: 100%; overflow-x: hidden; }
.container{ max-width: 780px; margin: 0 auto; padding: 12px; box-sizing: border-box; }

.card { background: var(--card); border: 1px solid var(--divider); border-radius: 14px; padding: 14px; box-shadow: 0 0 0 1px #000 inset; }
.card-title { display:flex; align-items:center; gap:2px; margin:0; color: var(--text-strong); font-weight: 700; }
.title-icon  { font-size: 20px !important; color: var(--gold) !important; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
.title-action-btn { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--gold); border: 1px solid var(--gold); border-radius: 10px; padding: 6px 10px; cursor: pointer; }
.title-action-btn .action-icon { font-size: 16px !important; color: var(--gold) !important; }
.title-action-btn .action-text { color: var(--gold); font-weight: 700; }

.photo-slot { display: flex; justify-content: center; padding: 8px 0 12px; }

.info-table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.4; table-layout: fixed; }
.pf-col-th { width: 40%; } .pf-col-td { width: 60%; }
.pf-scope .pf-th { padding: 8px; text-align: left; color: var(--text); font-weight: 700; }
.pf-scope .pf-td { padding: 8px; text-align: left; color: var(--text); background: transparent !important; word-break: word-break; }
.pf-scope .row-icon { font-size: 14px !important; color: var(--gold) !important; margin-right: 6px; vertical-align: middle; }
.pf-scope .label { display: inline-block; max-width: calc(100% - 26px); color: var(--text) !important; font-weight: 700; }

.editable-row { cursor: pointer; border-left: 2px solid transparent; }
.pf-scope .editable-row .pf-th, .pf-scope .editable-row .pf-td { color: #fff; font-weight: 600; }
.pf-scope .editable-row:hover .pf-td, .pf-scope .editable-row:focus .pf-td { background: rgba(255,255,255,0.04) !important; }
.intro-cell { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.intro-preview { color: var(--text-dim); display:inline-block; max-width: calc(100% - 80px); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.more-icon { font-size: 14px !important; color: var(--gold) !important; }

.popup-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index: 9999; }
.popup-content { width: min(680px, 92%); background: #111; border: 1px solid var(--gold); border-radius: 14px; padding: 14px; color: var(--text); box-sizing: border-box; }
.popup-content h3 { margin-top: 0; color: var(--text-strong); font-weight: 900; }
.intro-full { white-space: pre-wrap; color: var(--text); }

.request-input { width: 100%; min-height: 100px; border-radius: 10px; border: 1px solid #333; background: #0f0f0f; color: #eaeaea; padding: 10px; font-size: 14px; box-sizing: border-box; }
.footer-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }

/* ===== 버튼 공통 ===== */
ion-button { --border-radius: 12px; font-weight: 700; --padding-top: 4px; --padding-bottom: 4px; font-size: 10px; }

/* ===== 액션 그리드 (요청 배치 구현) =====
   [1열] 버튼A(두 줄 높이)
   [2~3열 상단] 대화하기(두 칸)
   [2열 하단] 차단하기
   [3열 하단] 신고하기
*/
.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-auto-rows: 40px; /* ← 한 줄 높이 */
  gap: 8px;            /* ← 버튼 사이 간격 */
  align-items: stretch;

}

/* 버튼A: 왼쪽, 세로 2행 고정 */
.slot-a {
  grid-column: 1 / 2;
  grid-row: 1 / span 2;
  font-size: 10px;
}

/* 대화하기: 상단 오른쪽, 두 칸 가로 확장 */
.slot-chat {
  grid-column: 2 / span 2;
  grid-row: 1 / 2;
  min-height: 30px;
}

/* 하단 두 버튼 */
.slot-block  { grid-column: 2 / 3; grid-row: 2 / 3; min-height: 30px;}
.slot-report { grid-column: 3 / 4; grid-row: 2 / 3; min-height: 30px;}

/* 테마 색상 */
.btn-primary   { --background: var(--gold); --background-activated: var(--gold-2); --background-hover: var(--gold-2); --color: #1a1a1a; }
.btn-outline   { --background: transparent; --color: var(--gold); --border-color: var(--gold); --border-style: solid; --border-width: 1px; }
.btn-warning   { --background: #666; --color: var(--gold); }
.btn-muted     { --background: transparent; --color: var(--text-dim); --border-color: var(--divider); --border-style: solid; --border-width: 1px; }
.btn-secondary { --background: #232323; --color: var(--gold); }
.btn-danger    { --background: #b00020; --color: #fff; }


@media (max-width: 360px) {
  .container { padding: 10px; }
  .card { padding: 10px; border-radius: 10px; }
  .info-table { font-size: 12px; }
  .pf-col-th { width: 46%; } .pf-col-td { width: 54%; }
  .pf-scope .pf-th, .pf-scope .pf-td { padding: 6px; }
}
</style>
