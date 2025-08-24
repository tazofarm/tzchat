<template>
  <!-- ✅ 6_profile 스타일을 적용한 사용자 프로필 상세 페이지 -->
  <div class="page-wrapper">
    <div class="container">

      <!-- ░░ 프로필 카드 (타이틀 + 우상단 뒤로가기 버튼) ░░ -->
      <div class="card pf-scope">
        <h3 class="card-title">
          <IonIcon :icon="icons.personCircleOutline" class="title-icon" />
          {{ user.nickname || '-' }} 님의 프로필
        </h3>

        <!-- ✅ 6_profile 패턴: 우상단 절대배치 버튼 (설정→뒤로가기) -->
        <button
          class="title-action-btn"
          type="button"
          @click="goBack"
          aria-label="뒤로가기"
        >
          <IonIcon :icon="icons.chevronBackOutline" class="action-icon" />
          <span class="action-text">뒤로가기</span>
        </button>

        <!-- 🔍 사용자 정보 테이블 (6_profile 네임스페이스 적용) -->
        <table class="info-table" aria-label="사용자 기본 정보">
          <colgroup>
            <col class="pf-col-th" />
            <col class="pf-col-td" />
          </colgroup>
          <tbody>
            <!-- 닉네임 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.personCircleOutline" class="row-icon" />
                <strong class="label">닉네임</strong>
              </td>
              <td class="pf-td readonly">{{ user.nickname || '-' }}</td>
            </tr>

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

            <!-- 성향 (※ 현재 API 연결 전이므로 닉네임 임시 표시였던 부분 보정) -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">성향</strong>
              </td>
              <td class="pf-td readonly">{{ user.preference || '-' }}</td>
            </tr>

            <!-- 결혼유무 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.ribbonOutline" class="row-icon" />
                <strong class="label">결혼유무</strong>
              </td>
              <td class="pf-td readonly">{{ user.maritalStatus || '-' }}</td>
            </tr>

            <!-- 최근 접속 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.timeOutline" class="row-icon" />
                <strong class="label">최근 접속</strong>
              </td>
              <td class="pf-td readonly">{{ formatDate(user.last_login) }}</td>
            </tr>

            <!-- 매칭율 (보냄/받음/매칭) -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.statsChartOutline" class="row-icon" />
                <strong class="label">매칭율</strong>
              </td>
              <td class="pf-td readonly">
                <div class="match-row" aria-label="매칭 통계">
                  <span class="badge">보냄 {{ user.sentRequestCountTotal ?? 0 }}</span>
                  <span class="badge">받음 {{ user.receivedRequestCountTotal ?? 0 }}</span>
                  <span class="badge badge-acc">매칭 {{ user.acceptedChatCountTotal ?? 0 }}</span>
                </div>
              </td>
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
                  자세히
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
          <ion-button
            v-if="!user.isFriend"
            class="btn-outline"
            @click="onOpenFriendRequest"
            :disabled="showRequestModal || user.isBlocked"
          >
            <IonIcon :icon="icons.personAddOutline" class="btn-icon" />
            친구 신청
          </ion-button>

          <ion-button
            v-else
            class="btn-warning"
            @click="removeFriend(user._id)"
          >
            <IonIcon :icon="icons.personRemoveOutline" class="btn-icon" />
            친구 삭제
          </ion-button>

          <ion-button
            v-if="!user.isBlocked"
            class="btn-muted"
            @click="blockUser(user._id)"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            차단하기
          </ion-button>

          <ion-button
            v-else
            class="btn-secondary"
            @click="unblockUser(user._id)"
          >
            <IonIcon :icon="icons.checkmarkCircleOutline" class="btn-icon" />
            차단 해제
          </ion-button>

          <ion-button class="btn-danger" @click="reportUser(user._id)">
            <IonIcon :icon="icons.alertCircleOutline" class="btn-icon" />
            신고하기
          </ion-button>
        </div>
      </div>

      <!-- 모달들 -->
      <ModalFriendRequest
        v-if="showRequestModal"
        :toUserId="user._id"
        :toNickname="user.nickname"
        @close="showRequestModal = false"
        @request-sent="handleRequestSent"
      />
      <ModalSelfIntro
        v-if="showIntroModal"
        :content="user.selfintro || '없음'"
        @close="showIntroModal = false"
      />
    </div>
  </div>
</template>

<script setup>
/* ===========================================================
   pageuserProfile.vue  (6_profile 스타일 적용 버전)
   - 레이아웃/간격/타이틀/버튼 스타일을 6_profile과 통일
   - 기능/로직은 기존 유지
   - 로그/주석 풍부하게
   =========================================================== */
import { ref, onMounted } from 'vue'
import { IonIcon } from '@ionic/vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

import ModalFriendRequest from '@/components/02010_minipage/Modal_FriendRequest.vue'
import ModalSelfIntro from '@/components/02010_minipage/Modal_SelfIntro.vue'

/* Ionicons */
import {
  personCircleOutline,
  maleFemaleOutline,
  calendarOutline,
  locationOutline,
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  chevronBackOutline,
  timeOutline,
  statsChartOutline,
  chatbubblesOutline,
  personAddOutline,
  personRemoveOutline,
  removeCircleOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  sparklesOutline,
  optionsOutline,
  ribbonOutline
} from 'ionicons/icons'

const icons = {
  personCircleOutline,
  maleFemaleOutline,
  calendarOutline,
  locationOutline,
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  chevronBackOutline,
  timeOutline,
  statsChartOutline,
  chatbubblesOutline,
  personAddOutline,
  personRemoveOutline,
  removeCircleOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  sparklesOutline,
  optionsOutline,
  ribbonOutline
}

const route = useRoute()
const router = useRouter()

/** 프로필 대상 사용자 상태 */
const user = ref({
  _id: '',
  username: '',
  nickname: '',
  gender: '',
  birthyear: '',
  region1: '',
  region2: '',
  preference: '',
  maritalStatus: '',
  selfintro: '',
  createdAt: '',
  last_login: '',
  isFriend: false,
  isBlocked: false,
  sentRequestCountTotal: 0,
  receivedRequestCountTotal: 0,
  acceptedChatCountTotal: 0
})

/** 모달 상태 */
const showRequestModal = ref(false)
const showIntroModal = ref(false)

/** 유틸: 날짜 포맷 */
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

/** 소개 모달 열기 */
function openIntroModal() {
  console.log('[UserProfile] 소개 모달 오픈')
  showIntroModal.value = true
}

/** 초기 로딩: 사용자 정보 */
onMounted(async () => {
  try {
    const targetId = route.params.id
    console.log('[UserProfile] load target:', targetId)
    const res = await axios.get(`/api/users/${targetId}`, { withCredentials: true })
    const data = res.data?.user ?? res.data ?? {}
    user.value = {
      ...user.value,
      ...data,
      sentRequestCountTotal: data.sentRequestCountTotal ?? 0,
      receivedRequestCountTotal: data.receivedRequestCountTotal ?? 0,
      acceptedChatCountTotal: data.acceptedChatCountTotal ?? 0
    }
    console.log('👤 사용자 정보 로드됨:', user.value)
  } catch (err) {
    console.error('❌ 사용자 정보 로딩 실패', err?.response?.data || err)
  }
})

/** 친구 신청 모달 오픈 */
function onOpenFriendRequest() {
  if (!user.value._id) {
    console.warn('[UserProfile] 대상 사용자 없음 → 모달 미오픈')
    return
  }
  console.log('[UserProfile] 친구 신청 모달 오픈')
  showRequestModal.value = true
}

/** 친구 신청 완료 후 처리 */
function handleRequestSent() {
  console.log('✅ 친구 신청 완료')
  showRequestModal.value = false
}

/** 대화 시작 */
async function startChat(userId) {
  try {
    const res = await axios.post('/api/chatrooms', { userId }, { withCredentials: true })
    const roomId = res.data?._id || res.data?.id
    if (roomId) {
      console.log('💬 채팅방 이동:', roomId)
      router.push(`/home/chat/${roomId}`)
    }
  } catch (err) {
    console.error('❌ 채팅방 생성 실패:', err?.response?.data || err)
  }
}

/** 친구 삭제 */
async function removeFriend(targetId) {
  try {
    await axios.delete(`/api/friend/${targetId}`, { withCredentials: true })
    user.value.isFriend = false
    console.log('🗑️ 친구 삭제됨:', targetId)
  } catch (err) {
    console.error('❌ 친구 삭제 실패:', err?.response?.data || err)
  }
}

/** 사용자 차단 */
async function blockUser(targetId) {
  try {
    await axios.put(`/api/block/${targetId}`, {}, { withCredentials: true })
    user.value.isBlocked = true
    console.log('🚫 차단됨:', targetId)
  } catch (err) {
    console.error('❌ 차단 실패:', err?.response?.data || err)
  }
}

/** 차단 해제 */
async function unblockUser(targetId) {
  try {
    await axios.delete(`/api/block/${targetId}`, { withCredentials: true })
    user.value.isBlocked = false
    console.log('🔓 차단 해제됨:', targetId)
  } catch (err) {
    console.error('❌ 차단 해제 실패:', err?.response?.data || err)
  }
}

/** 신고 (임시) */
function reportUser(id) {
  console.log('⚠️ 신고 요청:', id)
}

/** 뒤로가기 */
function goBack() {
  console.log('[UserProfile] 뒤로가기 클릭')
  router.back()
}
</script>

<style scoped>
/* ===========================================================
   6_profile 테마/토큰과 동일한 스케일을 적용
   - 가독성(글자색) 강제
   - pf-scope 네임스페이스로 충돌 최소화
   =========================================================== */
:root {
  --bg: #0b0b0e;
  --panel: #111215;
  --panel-2: #15161a;
  --gold: #d4af37;
  --gold-2: #b8901e;
  --text: #eaeaea;
  --text-dim: #bdbdbd;
  --divider: rgba(212, 175, 55, 0.18);
  --shadow: rgba(0, 0, 0, 0.35);
}

.page-wrapper {
  background:
    radial-gradient(1200px 800px at 20% -10%, rgba(212, 175, 55, 0.08), transparent 55%),
    radial-gradient(900px 700px at 110% -20%, rgba(184, 144, 30, 0.06), transparent 60%),
    var(--bg);
  color: var(--text);
  min-height: 100%;
}

.container { padding: 12px; }

/* ── 카드 기본 ─────────────────────────────────────────── */
.card {
  border: 1px solid var(--divider);
  border-radius: 12px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), var(--panel);
  color: var(--text);
  box-shadow: 0 8px 24px var(--shadow);
  position: relative; /* 우상단 버튼 절대배치 */
}

/* ── 타이틀 + 밑줄 ─────────────────────────────────────── */
.card-title {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 10px;
  font-size: clamp(15px, 4.2vw, 18px);
  font-weight: 800; color: var(--text);
  position: relative;
}
.card-title::after {
  content: ""; height: 2px; width: 44px;
  background: linear-gradient(90deg, var(--gold), transparent);
  position: absolute; left: 0; bottom: -6px;
}
.title-icon { font-size: 18px; color: var(--gold); }

/* ── 우상단 버튼 (뒤로가기) ─────────────────────────────── */
.title-action-btn {
  position: absolute; top: 10px; right: 10px;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 10px;
  border: 1px solid var(--divider);
  background: rgba(0,0,0,0.25);
  color: #fff; font-weight: 700; font-size: 13px;
  cursor: pointer;
  transition: transform .08s ease, background .2s ease, border-color .2s ease;
}
.title-action-btn:hover,
.title-action-btn:focus { background: rgba(212,175,55,0.12); border-color: var(--gold); }
.title-action-btn:active { transform: translateY(1px); }
.action-icon { font-size: 16px; color: var(--gold); }
.action-text { line-height: 1; }

/* ── 테이블 (6_profile 네임스페이스) ───────────────────── */
.info-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: clamp(12px, 3.6vw, 14px); }
.info-table tr { border-bottom: 1px dashed var(--divider); }
.info-table tr:last-child { border-bottom: 0; }

.pf-col-th { width: 42%; }
.pf-col-td { width: 58%; }

.pf-scope .pf-th {
  padding: 8px; vertical-align: middle;
  color: var(--text) !important; background: transparent !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: clamp(12.5px, 3.6vw, 14px) !important; line-height: 1.28;
}
.pf-scope .pf-td {
  padding: 8px; text-align: left; color: var(--text);
  background: transparent !important;
}

/* 아이콘/라벨 */
.pf-scope .row-icon { font-size: 14px !important; color: var(--gold) !important; margin-right: 6px; vertical-align: middle; }
.pf-scope .label { display: inline-block; max-width: calc(100% - 26px); color: var(--text) !important; font-weight: 700; }

/* 소개행: 클릭 가능 */
.editable-row { cursor: pointer; border-left: 2px solid transparent; }
.pf-scope .editable-row .pf-th, .pf-scope .editable-row .pf-td { color: #fff; font-weight: 600; }
.pf-scope .editable-row:hover .pf-td,
.pf-scope .editable-row:focus .pf-th,
.pf-scope .editable-row:focus .pf-td,
.pf-scope .editable-row:focus-within .pf-th,
.pf-scope .editable-row:focus-within .pf-td { background-color: var(--panel-2) !important; }
.pf-scope .editable-row:hover { border-left-color: var(--gold-2); }
.pf-scope .editable-row:focus,
.pf-scope .editable-row:focus-within { border-left-color: var(--gold); }

/* 소개 셀 내부 레이아웃 */
.intro-cell { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.intro-preview { flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.intro-more { display: inline-flex; align-items: center; color: var(--gold); font-weight: 700; }
.more-icon { font-size: 14px; margin-left: 2px; }

/* 매칭율 뱃지 */
.match-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 6px; border-radius: 999px;
  border: 1px solid var(--divider); background: rgba(255,255,255,0.02);
  font-weight: 700; white-space: nowrap;
  font-size : 10px;
}
.badge-acc { border-color: var(--gold); }

/* 액션 카드 내부 버튼 */
.chat-button {
  margin: 8px 0; /* 상하 간격 줄임 */
}

/* IonButton 공통 */
ion-button {
  --border-radius: 8px;   /* 둥근 정도 조금 축소 */
  font-weight: 600;       /* 두께 살짝 줄임 */
  font-size: 10px;        /* 글자 크기 축소 */
  height: 22px;           /* 버튼 높이 지정 */
  min-height: 32px;       /* 기본 min-height 덮어쓰기 */
  --padding-start: 10px;  /* 좌우 패딩 */
  --padding-end: 10px;
  --padding-top: 4px;     /* 상하 패딩 */
  --padding-bottom: 4px;
}

/* 프라이머리 버튼 */
.btn-primary {
  --background: var(--gold);
  --background-activated: var(--gold-2);
  --background-hover: var(--gold-2);
  --color: #1a1a1a;
}

/* 버튼 그룹 (행 정렬 + 간격) */
.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px; /* 버튼 사이 간격 줄임 */
}

/* 스타일별 버튼 */
.btn-outline {
  --background: transparent;
  --color: var(--gold);
  --border-color: var(--gold);
  --border-style: solid;
  --border-width: 1px;
}

.btn-warning {
  --background: #3a2a0a;
  --color: var(--gold);
}

.btn-muted {
  --background: transparent;
  --color: var(--text-dim);
  --border-color: var(--divider);
  --border-style: solid;
  --border-width: 1px;
}

.btn-secondary {
  --background: #232323;
  --color: var(--gold);
}

.btn-danger {
  --background: #b00020;
  --color: #fff;
}


/* 작은 화면 대응 */
@media (max-width: 360px) {
  .container { padding: 10px; }
  .card { padding: 10px; border-radius: 10px; }
  .info-table { font-size: 12px; }
  .pf-col-th { width: 46%; } .pf-col-td { width: 54%; }
  .pf-scope .pf-th, .pf-scope .pf-td { padding: 6px; }
}
</style>
