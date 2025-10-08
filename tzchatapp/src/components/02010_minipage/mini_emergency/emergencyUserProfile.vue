<template>
  <!-- ✅ 6_profile 스타일을 적용한 사용자 프로필 상세 페이지 -->
  <div class="page-wrapper">
    <div class="container">

      <!-- ░░ 프로필 카드 (타이틀 + 뒤로가기 버튼 한 줄) ░░ -->
      <div class="card pf-scope">
        <div class="card-header">
          <h3 class="card-title">
            <IonIcon :icon="icons.personCircleOutline" class="title-icon" />
            {{ user.nickname || '-' }} pre
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
         <!-- 대표 썸네일 크기 (150~180 선호) -->
        <div class="photo-slot">
          <ProfilePhotoViewer
            :user-id="user._id || String(route.params.id)"
            :gender="user.gender || ''"
            :size="120"
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

            <!-- 특징 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">특징</strong>
              </td>
              <td class="pf-td readonly">{{ user.preference || '-' }}</td>
            </tr>

            <!-- 소개 (셀 클릭 시 모달 오픈) -->
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

            <!-- 최근접속 (회원전용) -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">최근접속</strong>
              </td>
              <td class="pf-td readonly">{회원전용}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ░░ 액션 영역 (대화하기/친구신청/차단/신고) ░░ -->
      <div class="card pf-scope">

        <!-- 대화하기 -->
        <div class="chat-button">
          <ion-button
            expand="block"
            class="btn-primary"
            :disabled="!user.isFriend"
            @click="startChat(user._id)"
          >
            <IonIcon :icon="icons.chatbubblesOutline" class="btn-icon" />
            대화하기
          </ion-button>
        </div>

        <!-- 버튼 그룹 -->
        <div class="button-group" role="group" aria-label="사용자 액션">
          <!-- ▼ 상태 1: 친구 아님 && 보낸신청 없음 => '친구신청' -->
          <ion-button
            v-if="!user.isFriend && !hasPendingRequest && !user.isBlocked"
            class="btn-outline"
            @click="onOpenFriendRequest"
            :disabled="showRequestModal"
          >
            <IonIcon :icon="icons.personAddOutline" class="btn-icon" />
            친구신청
          </ion-button>

          <!-- ▼ 상태 2: 친구 아님 && 보낸신청 pending => '신청 취소' -->
          <ion-button
            v-if="!user.isFriend && hasPendingRequest && !user.isBlocked"
            class="btn-warning"
            :disabled="isSubmitting"
            @click="cancelFriendRequest"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            신청 취소
          </ion-button>

          <!-- ▼ 상태 3: 친구임 => '친구 삭제' -->
          <ion-button
            v-if="user.isFriend"
            class="btn-danger"
            :disabled="isSubmitting"
            @click="removeFriend(user._id)"
          >
            <IonIcon :icon="icons.personRemoveOutline" class="btn-icon" />
            친구 삭제
          </ion-button>

          <!-- 차단 / 차단 해제 -->
          <ion-button
            v-if="!user.isBlocked"
            class="btn-warning"
            :disabled="isSubmitting"
            @click="blockUser(user._id)"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            차단하기
          </ion-button>
          <ion-button
            v-else
            class="btn-muted"
            :disabled="isSubmitting"
            @click="unblockUser(user._id)"
          >
            <IonIcon :icon="icons.checkmarkCircleOutline" class="btn-icon" />
            차단 해제
          </ion-button>

          <!-- 신고 -->
          <ion-button
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
              class="btn-primary"
              expand="block"
              :disabled="isSubmitting"
              @click="sendFriendRequest"
            >신청 보내기</ion-button>
            <ion-button
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
import {
  IonButton,
  IonIcon
} from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/lib/api'
import { isAxiosError } from 'axios'

/* ✅ 상대방 사진 뷰어 (읽기 전용) */
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

/** 프로필 대상 사용자 */
const user = ref<any>({
  _id: '',
  username: '',
  nickname: '',
  gender: '',
  birthyear: '',
  region1: '',
  region2: '',
  preference: '',
  selfintro: '',
  isFriend: false,
  isBlocked: false,
  sentRequestCountTotal: 0,
  receivedRequestCountTotal: 0,
  acceptedChatCountTotal: 0
})

/** 모달/폼 상태 */
const showIntroModal = ref(false)
const showRequestModal = ref(false)
const requestMessage = ref('')

/** 전송/로딩 제어 */
const isSubmitting = ref(false)

/** ✅ 보낸 친구신청 '대기중' 여부 및 해당 신청 id */
const hasPendingRequest = ref(false)
const pendingRequestId = ref<string | null>(null)

/* ========== 유틸 ========== */
function extractError(e: unknown) {
  if (isAxiosError(e)) return e.response?.data ?? e.message
  if (e instanceof Error) return e.message
  try { return JSON.stringify(e) } catch { return String(e) }
}

/* ========== 모달 ========== */
function openIntroModal() { showIntroModal.value = true }
function closeIntroModal() { showIntroModal.value = false }

/* ========== 데이터 로드 ========== */
async function loadUser() {
  const targetId = route.params.id
  const res = await axios.get(`/api/users/${targetId}`, { withCredentials: true })
  const data = (res.data as any)?.user ?? res.data ?? {}
  user.value = {
    ...user.value,
    ...data,
    isFriend:  !!data.isFriend,
    isBlocked: !!data.isBlocked,
    sentRequestCountTotal: data.sentRequestCountTotal ?? 0,
    receivedRequestCountTotal: data.receivedRequestCountTotal ?? 0,
    acceptedChatCountTotal: data.acceptedChatCountTotal ?? 0
  }
}

/** ✅ 현재 대상에게 보낸 친구신청이 '대기중'인지 확인 */
async function syncPendingRequestState() {
  try {
    const targetId = user.value._id || route.params.id
    if (!targetId) return
    const res = await axios.get('/api/friend-requests/sent', { withCredentials: true })
    const list = (res.data?.requests ?? res.data ?? []) as any[]
    const pending = list.find((r:any) =>
      (r.to?._id === targetId || r.to === targetId) &&
      (r.status === 'pending' || r.status === 'PENDING')
    )
    hasPendingRequest.value = !!pending
    pendingRequestId.value = pending?._id ?? null
  } catch {
    hasPendingRequest.value = false
    pendingRequestId.value = null
  }
}

onMounted(async () => {
  try {
    await loadUser()
    await syncPendingRequestState()
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', extractError(e))
  }
})

/* ========== 액션 ========== */
function onOpenFriendRequest() {
  if (!user.value._id || user.value.isBlocked || hasPendingRequest.value) return
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
    pendingRequestId.value = res.data?.request?._id ?? res.data?._id ?? null
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

function startChat(targetId: string) { console.log('💬 대화 시작:', targetId) }

async function removeFriend(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.delete(`/api/friend/${targetId}`, { withCredentials: true })
    user.value.isFriend = false
  } finally {
    isSubmitting.value = false
  }
}

async function blockUser(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.put(`/api/block/${targetId}`, {}, { withCredentials: true })
    user.value.isBlocked = true
    hasPendingRequest.value = false
    pendingRequestId.value = null
    try { await router.push('/home/3page') } catch {}
  } finally {
    isSubmitting.value = false
  }
}

async function unblockUser(targetId: string) {
  try {
    isSubmitting.value = true
    await axios.delete(`/api/block/${targetId}`, { withCredentials: true })
    user.value.isBlocked = false
  } finally {
    isSubmitting.value = false
  }
}

function reportUser(id: string) { console.log('⚠️ 신고 요청:', id) }
function goBack() { router.back() }
</script>

<style scoped>
/* ===========================================================
   블랙+골드 테마 (가독성 향상)
   =========================================================== */
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

.page-wrapper { background: var(--bg); min-height: 100vh; padding: 12px; color: var(--text); }
.container     { max-width: 780px; margin: 0 auto; padding: 12px; }

.card { background: var(--card); border: 1px solid var(--divider); border-radius: 14px; padding: 14px; box-shadow: 0 0 0 1px #000 inset; }

/* 타이틀 */
.card-title { display:flex; align-items:center; gap:2px; margin:0; color: var(--text-strong); font-weight: 700; }
.title-icon  { font-size: 20px !important; color: var(--gold) !important; }

/* 새 컨테이너 (타이틀+뒤로 버튼) */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

/* 뒤로 버튼 */
.title-action-btn {
  position: static;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--gold);
  border: 1px solid var(--gold);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}
.title-action-btn .action-icon { font-size: 16px !important; color: var(--gold) !important; }
.title-action-btn .action-text { color: var(--gold); font-weight: 700; }

/* ░░ 사진 영역 중앙 정렬 + 여백 */
.photo-slot {
  display: flex;
  justify-content: center;
  padding: 8px 0 12px;
}
/* 필요시 페이지에서 썸네일 크기 오버라이드도 가능
.photo-slot :deep(.avatar) { max-width: 160px; }
*/

/* 테이블 */
.info-table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.4; }
.pf-col-th { width: 40%; } .pf-col-td { width: 60%; }
.pf-scope .pf-th { padding: 8px; text-align: left; color: var(--text); font-weight: 700; }
.pf-scope .pf-td { padding: 8px; text-align: left; color: var(--text); background: transparent !important; }

/* 아이콘/라벨 */
.pf-scope .row-icon { font-size: 14px !important; color: var(--gold) !important; margin-right: 6px; vertical-align: middle; }
.pf-scope .label { display: inline-block; max-width: calc(100% - 26px); color: var(--text) !important; font-weight: 700; }

/* 소개행: 클릭 가능 */
.editable-row { cursor: pointer; border-left: 2px solid transparent; }
.pf-scope .editable-row .pf-th, .pf-scope .editable-row .pf-td { color: #fff; font-weight: 600; }
.pf-scope .editable-row:hover .pf-td,
.pf-scope .editable-row:focus .pf-td { background: rgba(255,255,255,0.04) !important; }
.intro-cell { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.intro-preview { color: var(--text-dim); display:inline-block; max-width: calc(100% - 80px); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.more-icon { font-size: 14px !important; color: var(--gold) !important; }

/* 팝업 공통 */
.popup-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display:flex; align-items:center; justify-content:center; z-index: 9999;
}
.popup-content {
  width: min(680px, 92%); background: #111; border: 1px solid var(--gold);
  border-radius: 14px; padding: 14px; color: var(--text);
}
.popup-content h3 { margin-top: 0; color: var(--text-strong); font-weight: 900; }
.intro-full { white-space: pre-wrap; color: var(--text); }

.request-input {
  width: 100%; min-height: 100px; border-radius: 10px; border: 1px solid #333;
  background: #0f0f0f; color: #eaeaea; padding: 10px; font-size: 14px;
}

/* 모달 푸터 버튼 */
.footer-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }

/* 버튼 공통 */
ion-button { --border-radius: 12px; font-weight: 700; --padding-top: 4px; --padding-bottom: 4px; font-size: 12px; }
.chat-button ion-button { --padding-top: 2px; --padding-bottom: 2px; font-size: 12px; min-height: 28px; }

.button-group {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
}
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

/* 작은 화면 대응 */
@media (max-width: 360px) {
  .container { padding: 10px; }
  .card { padding: 10px; border-radius: 10px; }
  .info-table { font-size: 12px; }
  .pf-col-th { width: 46%; } .pf-col-td { width: 54%; }
  .pf-scope .pf-th, .pf-scope .pf-td { padding: 6px; }
}
</style>
