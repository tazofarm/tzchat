<!-- src/02010_minipage/mini_profile/PageuserProfile.vue -->
<template>
  <!-- ✅ 6_profile 스타일을 적용한 사용자 프로필 상세 페이지 -->
  <div class="page-wrapper">
    <div class="container">

      <!-- ░░ 프로필 카드 (타이틀 + 뒤로가기 버튼 한 줄) ░░ -->
      <div class="card pf-scope">
        <div class="card-header">
          <h3 class="card-title">
            <IonIcon :icon="icons.personCircleOutline" class="title-icon" />
            {{ user.nickname || '-' }}
          </h3>

          <!-- 뒤로가기 -->
          <button
            class="title-action-btn"
            type="button"
            @click="goBack"
            aria-label="뒤로가기"
          >
            <IonIcon :icon="icons.chevronBackOutline" class="action-icon" />
            <span class="action-text">뒤로</span>
          </button>
        </div>

        <!-- ░░ 사진 뷰어: 대표 보이기 + 클릭 시 확대/스와이프 ░░ -->
        <div class="photo-slot">
          <ProfilePhotoViewer
            :user-id="user._id || String(route.params.id)"
            :gender="user.gender || ''"
            :size="125"
          />
        </div>

        <table class="info-table">
          <colgroup>
            <col class="pf-col-th" />
            <col class="pf-col-td" />
          </colgroup>
          <tbody>
            <!-- 성별 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.maleFemaleOutline" class="row-icon" />
                <strong class="label">성별</strong>
              </td>
              <td class="pf-td readonly">
                {{ user.gender === 'man' ? '남자'
                    : user.gender === 'woman' ? '여자' : '-' }}
              </td>
            </tr>

            <!-- 출생년도 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.calendarOutline" class="row-icon" />
                <strong class="label">출생년도</strong>
              </td>
              <td class="pf-td readonly">{{ user.birthyear || '-' }}</td>
            </tr>

            <!-- 지역 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.locationOutline" class="row-icon" />
                <strong class="label">지역</strong>
              </td>
              <td class="pf-td readonly">{{ user.region1 || '' }} {{ user.region2 || '' }}</td>
            </tr>

            <!-- 특징 (등급별 노출 제어: 뷰어 기준) -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">특징</strong>
              </td>
              <td class="pf-td readonly">{{ viewerIsPremium ? (user.preference || '-') : 'Premium 전용' }}</td>
            </tr>

            <!-- 결혼 (등급별 노출 제어: 뷰어 기준) -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">결혼</strong>
              </td>
              <td class="pf-td readonly">{{ viewerIsPremium ? (user.marriage || '-') : 'Premium 전용' }}</td>
            </tr>
          
          </tbody>
        </table>

        <!-- 소개 (셀 클릭 시 모달 오픈) -->
        <table class="info-table">
          <colgroup>
            <col class="pf-col-th" />
            <col class="pf-col-td" />
          </colgroup>
          <tbody>
            <tr
              class="editable-row"
              @click="openIntroModal"
              tabindex="0"
              @keydown.enter="openIntroModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.chatbubbleEllipsesOutline" class="row-icon" />
                <strong class="label">소개</strong>
              </td>
              <td class="pf-td editable-text intro-cell">
                <span class="intro-preview">{{ user.selfintro || '없음' }}</span>
                <span class="intro-more">
                  <IonIcon :icon="icons.chevronForwardOutline" class="more-icon" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ░░ 액션 영역 (대화하기/친구신청/차단/신고) ░░ -->
      <div class="card pf-scope">
        <!-- 대화하기 -->
        <div class="chat-button">
          <ion-button
            type="button"
            expand="block"
            class="btn-primary"
            :disabled="!user.isFriend || isSubmitting"
            @click="startChat(user._id)"
          >
            <IonIcon :icon="icons.chatbubblesOutline" class="btn-icon" />
            대화하기
          </ion-button>
        </div>

        <!-- 버튼 그룹 -->
        <div class="button-group" role="group" aria-label="사용자 액션">
          <ion-button
            type="button"
            v-if="!user.isFriend && hasIncomingRequest && !user.isBlocked"  
            class="btn-primary"
            :disabled="isSubmitting"
            @click="acceptIncomingRequest"
          >
            <IonIcon :icon="icons.checkmarkCircleOutline" class="btn-icon" />
            수락하기
          </ion-button>

          <ion-button
            type="button"
            v-if="!user.isFriend && !hasPendingRequest && !hasIncomingRequest && !user.isBlocked"
            class="btn-outline"
            @click="onOpenFriendRequest"
            :disabled="showRequestModal || isSubmitting"
          >
            <IonIcon :icon="icons.personAddOutline" class="btn-icon" />
            친구신청
          </ion-button>

          <ion-button
            type="button"
            v-if="!user.isFriend && hasPendingRequest && !user.isBlocked"
            class="btn-warning"
            :disabled="isSubmitting"
            @click="cancelFriendRequest"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            신청 취소
          </ion-button>

          <ion-button
            type="button"
            v-if="user.isFriend"
            class="btn-danger"
            :disabled="isSubmitting"
            @click="removeFriend(user._id)"
          >
            <IonIcon :icon="icons.personRemoveOutline" class="btn-icon" />
            친구 삭제
          </ion-button>

          <ion-button
            type="button"
            v-if="!user.isBlocked"
            class="btn-warning"
            :disabled="isSubmitting"
            @click="blockUser(user._id)"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            차단하기
          </ion-button>
          <ion-button
            type="button"
            v-else
            class="btn-muted"
            :disabled="isSubmitting"
            @click="unblockUser(user._id)"
          >
            <IonIcon :icon="icons.checkmarkCircleOutline" class="btn-icon" />
            차단 해제
          </ion-button>

          <ion-button
            type="button"
            class="btn-secondary"
            :disabled="isSubmitting"
            @click="reportUser(user._id)"
          >
            <IonIcon :icon="icons.alertCircleOutline" class="btn-icon" />
            신고하기
          </ion-button>
        </div>
      </div>

      <!-- ░░ 소개 모달 (읽기 전용) ░░ -->
      <div
        v-if="showIntroModal"
        class="popup-overlay"
        role="presentation"
        @click.self="closeIntroModal"
      >
        <div
          class="popup-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="intro-modal-title"
        >
          <h3 id="intro-modal-title">소개</h3>
          <p class="intro-full">{{ user.selfintro || '소개가 없습니다.' }}</p>

          <div class="footer-btns">
            <ion-button
              type="button"
              class="btn-primary"
              expand="block"
              @click="closeIntroModal"
            >확인</ion-button>
          </div>
        </div>
      </div>

      <!-- ░░ 친구 신청 모달 ░░ -->
      <div
        v-if="showRequestModal"
        class="popup-overlay"
        role="presentation"
        @click.self="onCloseFriendRequest"
      >
        <div
          class="popup-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fr-modal-title"
        >
          <h3 id="fr-modal-title">친구 신청</h3>
          <textarea
            v-model="requestMessage"
            class="request-input"
            placeholder="인사말을 입력하세요 (선택)"
            rows="4"
          ></textarea>

          <div class="footer-btns">
            <ion-button
              type="button"
              class="btn-primary"
              expand="block"
              :disabled="isSubmitting"
              @click="sendFriendRequest"
            >신청 보내기</ion-button>
            <ion-button
              type="button"
              class="btn-muted"
              expand="block"
              :disabled="isSubmitting"
              @click="onCloseFriendRequest"
            >취소</ion-button>
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

/** 프로필 대상 사용자 (상대방) */
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
  user_level: '',        // 상대 유저의 등급(표시용)
  isFriend: false,
  isBlocked: false,
  sentRequestCountTotal: 0,
  receivedRequestCountTotal: 0,
  acceptedChatCountTotal: 0
})

/** ✅ 현재 로그인한 '뷰어'의 등급/프리미엄 여부 (노출 판단은 항상 뷰어 기준) */
const viewerLevel = ref<string>('') // '일반회원' | '여성회원' | '프리미엄' 등
const viewerIsPremium = computed<boolean>(() => {
  // 1) 서버 값 우선
  const lv = (viewerLevel.value || '').trim().toLowerCase()
  if (['프리미엄', 'premium', 'premium_member', 'prem'].includes(lv)) return true
  // 2) 로컬스토리지 폴백
  const lvLS = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim().toLowerCase()
  if (['프리미엄', 'premium', 'premium_member', 'prem'].includes(lvLS)) return true
  const boolish = (localStorage.getItem('isPremium') || '').trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(boolish)) return true
  return false
})

/** 템플릿에서 간단히 쓰기 위한 별칭 */
const isPremium = viewerIsPremium

/** 모달/폼 상태 */
const showIntroModal = ref(false)
const showRequestModal = ref(false)
const requestMessage = ref('')

/** 전송/로딩 제어 */
const isSubmitting = ref(false)

/** ✅ 내가 보낸 친구신청 pending 여부/ID */
const hasPendingRequest = ref(false)
const pendingRequestId = ref<string | null>(null)

/** ✅ 상대가 나에게 보낸 친구신청 pending 여부/ID (수락하기 용) */
const hasIncomingRequest = ref(false)
const incomingRequestId = ref<string | null>(null)

/* ========== 유틸 ========== */
function extractError(e: unknown) {
  if (isAxiosError(e)) return e.response?.data ?? e.message
  if (e instanceof Error) return e.message
  try { return JSON.stringify(e) } catch { return String(e) }
}

/* ✅ 신고자 정보(LocalStorage 폴백) */
function getReporterId() {
  return (
    localStorage.getItem('userId') ||
    localStorage.getItem('id') ||
    localStorage.getItem('_id') ||
    'unknown'
  )
}
function getReporterNickname() {
  return (
    localStorage.getItem('nickname') ||
    localStorage.getItem('username') ||
    localStorage.getItem('name') ||
    'unknown'
  )
}

/* ========== 모달 ========== */
function openIntroModal() { showIntroModal.value = true }
function closeIntroModal() { showIntroModal.value = false }

/* ========== 데이터 로드 ========== */
async function loadUser() {
  const targetId = String(route.params.id || '')
  const res = await axios.get(`/api/users/${targetId}`, { withCredentials: true })
  const data = (res.data as any)?.user ?? res.data ?? {}
  user.value = {
    ...user.value,
    ...data,
    _id: String(data._id || targetId),
    isFriend:  !!data.isFriend,
    isBlocked: !!data.isBlocked,
    user_level: data.user_level || data.level || user.value.user_level || '일반회원',
    sentRequestCountTotal: data.sentRequestCountTotal ?? 0,
    receivedRequestCountTotal: data.receivedRequestCountTotal ?? 0,
    acceptedChatCountTotal: data.acceptedChatCountTotal ?? 0
  }
}

/** ✅ 현재 로그인한 내 등급/프리미엄 여부를 서버에서 가져와서 설정 (노출 판단용) */
async function loadViewerLevel() {
  try {
    const meRes = await axios.get('/api/me', { withCredentials: true })
    const me = meRes?.data?.user ?? {}
    const levelFromApi =
      me?.level ||
      me?.user_level ||
      me?.membership ||
      ''
    viewerLevel.value = String(levelFromApi || '').trim()
  } catch (e) {
    // 서버 실패 시 로컬스토리지 폴백에만 의존
    viewerLevel.value = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim()
  }
}

/** ✅ 내가 보낸 친구신청 '대기중'인지 확인 */
async function syncPendingRequestState() {
  try {
    const targetId = String(user.value._id || route.params.id || '')
    if (!targetId) return
    const res = await axios.get('/api/friend-requests/sent', { withCredentials: true })
    const list = (res.data?.requests ?? res.data ?? []) as any[]
    const pending = list.find((r:any) =>
      (String(r.to?._id ?? r.to) === targetId) &&
      String(r.status).toLowerCase() === 'pending'
    )
    hasPendingRequest.value = !!pending
    pendingRequestId.value = pending?._id ?? null
  } catch {
    hasPendingRequest.value = false
    pendingRequestId.value = null
  }
}

/** ✅ 상대가 나에게 보낸 친구신청 '대기중'인지 확인 (수락하기 노출 조건) */
async function syncIncomingRequestState() {
  try {
    const targetId = String(user.value._id || route.params.id || '')
    if (!targetId) return
    const res = await axios.get('/api/friend-requests/received', { withCredentials: true })
    const list = (res.data?.requests ?? res.data ?? []) as any[]
    const pending = list.find((r:any) =>
      (String(r.from?._id ?? r.from) === targetId) &&
      String(r.status).toLowerCase() === 'pending'
    )
    hasIncomingRequest.value = !!pending
    incomingRequestId.value = pending?._id ?? null
  } catch {
    hasIncomingRequest.value = false
    incomingRequestId.value = null
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      loadUser(),
      loadViewerLevel(),
    ])
    await Promise.all([
      syncPendingRequestState(),
      syncIncomingRequestState(),
    ])
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', extractError(e))
  }
})

/* ========== 액션 ========== */
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
  } finally {
    isSubmitting.value = false
  }
}

async function cancelFriendRequest() {
  if (!pendingRequestId.value) { await syncPendingRequestState(); if (!pendingRequestId.value) return }
  try {
    isSubmitting.value = true
    await axios.delete(`/api/friend-request/${pendingRequestId.value}`, { withCredentials: true })
    hasPendingRequest.value = false
    pendingRequestId.value = null
  } finally {
    isSubmitting.value = false
  }
}

/** ✅ 수락하기 */
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
  } finally {
    isSubmitting.value = false
  }
}

function startChat(targetId: string) {
  console.log('💬 대화 시작:', targetId)
}

async function removeFriend(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.delete(`/api/friend/${String(targetId)}`, { withCredentials: true })
    user.value.isFriend = false
  } finally {
    isSubmitting.value = false
  }
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
  } finally {
    isSubmitting.value = false
  }
}

async function unblockUser(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.delete(`/api/block/${String(targetId)}`, { withCredentials: true })
    user.value.isBlocked = false
  } finally {
    isSubmitting.value = false
  }
}

/* ✅ 신고 메일 연동 */
function reportUser(targetId: string) {
  const email = 'tazocode@gmail.com'
  const subject = '(네네챗 사용자 신고)'

  const reporterId = getReporterId()
  const reporterNickname = getReporterNickname()

  const targetUserId = String(user.value._id || targetId || route.params.id || '')
  const targetNickname = user.value.nickname || user.value.username || '-'

  const bodyLines = [
    '아래 사용자에 대한 신고가 접수되었습니다.',
    '',
    '--- 신고자 정보 ---',
    `아이디: ${reporterId}`,
    `닉네임: ${reporterNickname}`,
    '',
    '--- 신고 대상자 정보 ---',
    `아이디: ${targetUserId}`,
    `닉네임: ${targetNickname}`,
    '',
    '--- 추가 작성 ---',
    '신고 사유: ',
    '관련 스크린샷/증빙이 있으면 첨부해 주세요.',
  ]

  const body = encodeURIComponent(bodyLines.join('\n'))
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`
  window.location.href = mailto
}

function goBack() { router.back() }
</script>

<style scoped>
/* (기존 스타일 그대로) */
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
.page-wrapper { background: var(--bg); min-height: 100dvh; min-height: -webkit-fill-available; box-sizing: border-box; padding: 12px; color: var(--text); width: 100%; overflow-x: hidden; }
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

ion-button { --border-radius: 12px; font-weight: 700; --padding-top: 4px; --padding-bottom: 4px; font-size: 12px; }
.chat-button ion-button { --padding-top: 2px; --padding-bottom: 2px; font-size: 12px; min-height: 28px; }

.button-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.button-group ion-button {
  width: 100%; min-width: 0;
  --padding-top: 2px; --padding-bottom: 2px;
  --padding-start: 10px; --padding-end: 10px;
  font-size: 10px; --border-radius: 8px; min-height: 25px;
  white-space: nowrap;
}

.btn-primary   { --background: var(--gold); --background-activated: var(--gold-2); --background-hover: var(--gold-2); --color: #1a1a1a; }
.btn-outline   { --background: transparent; --color: var(--gold); --border-color: var(--gold); --border-style: solid; --border-width: 1px; }
.btn-warning   { --background: #3a2a0a; --color: var(--gold); }
.btn-muted     { --background: transparent; --color: var(--text-dim); --border-color: var(--divider); --border-style: solid; --border-width: 1px; }
.btn-secondary { --background: #232323; --color: var(--gold); }
.btn-danger    { --background: #b00020; --color: #fff; }

@media (max-width: 360px) {
  .container { padding: 10px; }
  .card { padding: 10px; border-radius: 10px; }
  .info-table { font-size: 12px; }
  .pf-col-th { width: 46%; } .pf-col-td { width: 54%; }
  .pf-col-thd { width: 26%; } .pf-col-tdd { width: 34%; }
  .pf-scope .pf-th, .pf-scope .pf-td { padding: 6px; }
}
</style>
