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

            <!-- 성향 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">성향</strong>
              </td>
              <td class="pf-td readonly">{{ user.preference || '-' }}</td>
            </tr>

            <!-- 매칭 통계 -->
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
          <!-- 친구 신청 -->
          <ion-button
            v-if="!user.isFriend"
            class="btn-outline"
            @click="onOpenFriendRequest"
            :disabled="showRequestModal || user.isBlocked"
          >
            <IonIcon :icon="icons.personAddOutline" class="btn-icon" />
            친구 신청
          </ion-button>

          <!-- 친구 삭제 -->
          <ion-button
            v-else
            class="btn-danger"
            @click="removeFriend(user._id)"
          >
            <IonIcon :icon="icons.personRemoveOutline" class="btn-icon" />
            친구 삭제
          </ion-button>

          <!-- 차단 / 차단 해제 -->
          <ion-button
            v-if="!user.isBlocked"
            class="btn-warning"
            @click="blockUser(user._id)"
          >
            <IonIcon :icon="icons.removeCircleOutline" class="btn-icon" />
            차단하기
          </ion-button>
          <ion-button
            v-else
            class="btn-muted"
            @click="unblockUser(user._id)"
          >
            <IonIcon :icon="icons.checkmarkCircleOutline" class="btn-icon" />
            차단 해제
          </ion-button>

          <!-- 신고 -->
          <ion-button
            class="btn-secondary"
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
/* -----------------------------------------------------------
 * PageuserProfile.vue (TS 안전한 오류 처리)
 * - axios 에러 안전 처리: isAxiosError / extractError
 * - 공통 axios 인스턴스 사용(쿠키/기본설정 유지)
 * - 주석/로그 최대
 * ----------------------------------------------------------- */
import {
  IonButton,
  IonIcon
} from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'          // ✅ 공통 인스턴스
import { isAxiosError } from 'axios'             // ✅ 유틸은 axios 본체에서 임포트

// 아이콘
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

// 상태
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

const showIntroModal = ref(false)
const showRequestModal = ref(false)
const requestMessage = ref('')
const isSubmitting = ref(false)

/** ✅ 공통: 에러 추출/로그 유틸 (TS 안전) */
function extractError(e: unknown) {
  if (isAxiosError(e)) {
    return e.response?.data ?? e.message;
  }
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** 소개 모달 핸들러 */
function openIntroModal() {
  console.log('[UserProfile] 소개 모달 오픈')
  showIntroModal.value = true
}
function closeIntroModal() {
  console.log('[UserProfile] 소개 모달 닫기')
  showIntroModal.value = false
}

/** 초기 로딩: 사용자 정보 */
onMounted(async () => {
  try {
    const targetId = route.params.id
    console.log('[UserProfile] load target:', targetId)
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
    console.log('👤 사용자 정보 로드됨:', user.value)
  } catch (e) {
    const msg = extractError(e)
    console.error('❌ 사용자 정보 로딩 실패:', msg)
  }
})

/** 친구 신청 모달 오픈 */
function onOpenFriendRequest() {
  if (!user.value._id) {
    console.warn('⚠️ 대상 ID가 없습니다.')
    return
  }
  if (user.value.isBlocked) {
    console.warn('⚠️ 차단된 대상에게는 신청 불가')
    return
  }
  requestMessage.value = ''
  showRequestModal.value = true
  console.log('[UserProfile] 친구 신청 모달 오픈')
}
function onCloseFriendRequest() {
  showRequestModal.value = false
  console.log('[UserProfile] 친구 신청 모달 닫기')
}

/** 친구 신청 보내기 */
async function sendFriendRequest() {
  if (!user.value._id) return
  try {
    isSubmitting.value = true
    const payload = { to: user.value._id, message: requestMessage.value }
    console.log('📨 친구 신청 요청:', payload)
    const res = await axios.post('/api/friend-request', payload, { withCredentials: true })
    console.log('✅ 친구 신청 성공:', res.data)
    showRequestModal.value = false
  } catch (e) {
    const msg = extractError(e)
    console.error('❌ 친구 신청 실패:', msg)
  } finally {
    isSubmitting.value = false
  }
}

/** 대화 시작 */
function startChat(targetId: string) {
  console.log('💬 대화 시작 (추가 라우팅 필요 시 구현):', targetId)
  // router.push(...) 등으로 연결
}

/** 친구 삭제 */
async function removeFriend(targetId: string) {
  try {
    await axios.delete(`/api/friend/${targetId}`, { withCredentials: true })
    user.value.isFriend = false
    console.log('🗑️ 친구 삭제됨:', targetId)
  } catch (e) {
    const msg = extractError(e)
    console.error('❌ 친구 삭제 실패:', msg)
  }
}

/** 사용자 차단 */
async function blockUser(targetId: string) {
  try {
    const res = await axios.put(`/api/block/${targetId}`, {}, { withCredentials: true })
    user.value.isBlocked = true
    console.log('🚫 차단됨:', { targetId, status: res.status, data: res.data })

    // 차단 후 이동(있으면)
    const DEST_PATHS = ['/home/3page', '/blocks']
    for (const p of DEST_PATHS) {
      try {
        await router.push(p)
        console.log('[UserProfile] 차단 리스트로 이동:', p)
        return
      } catch {}
    }
    console.warn('⚠️ 차단 리스트 라우트가 없어 현재 페이지 유지됨.')
  } catch (e) {
    const msg = extractError(e)
    console.error('❌ 차단 실패:', msg)
  }
}

/** 차단 해제 */
async function unblockUser(targetId: string) {
  try {
    await axios.delete(`/api/block/${targetId}`, { withCredentials: true })
    user.value.isBlocked = false
    console.log('🔓 차단 해제됨:', targetId)
  } catch (e) {
    const msg = extractError(e)
    console.error('❌ 차단 해제 실패:', msg)
  }
}

/** 신고 (임시) */
function reportUser(id: string) {
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
.card-title { display:flex; align-items:center; gap:8px; margin:0 0 12px; color: var(--text-strong); font-weight: 800; }
.title-icon  { font-size: 20px !important; color: var(--gold) !important; }

/* 우상단 버튼 */
.title-action-btn {
  position: absolute; top: 10px; right: 12px;
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; color: var(--gold); border: 1px solid var(--gold);
  border-radius: 10px; padding: 6px 10px; cursor: pointer;
}
.title-action-btn .action-icon { font-size: 16px !important; color: var(--gold) !important; }
.title-action-btn .action-text { color: var(--gold); font-weight: 700; }

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

/* 매칭 통계 배지 */
.match-row { display: flex; gap: 6px; flex-wrap: wrap; }
.badge { background: #222; color: #e6e6e6; border: 1px solid #333; padding: 4px 8px; border-radius: 999px; font-weight: 700; }
.badge-acc { background: #1f1a10; color: var(--gold); border-color: #3a2a0a; }

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
ion-button { --border-radius: 12px; font-weight: 800; }
.btn-icon { margin-right: 6px; }

/* 주요 버튼 색 */
.btn-primary {
  --background: var(--gold);
  --background-activated: var(--gold-2);
  --background-hover: var(--gold-2);
  --color: #1a1a1a;
}

/* 버튼 그룹 */
.button-group { display: flex; flex-wrap: wrap; gap: 6px; }

/* 스타일별 버튼 */
.btn-outline { --background: transparent; --color: var(--gold); --border-color: var(--gold); --border-style: solid; --border-width: 1px; }
.btn-warning { --background: #3a2a0a; --color: var(--gold); }
.btn-muted   { --background: transparent; --color: var(--text-dim); --border-color: var(--divider); --border-style: solid; --border-width: 1px; }
.btn-secondary { --background: #232323; --color: var(--gold); }
.btn-danger  { --background: #b00020; --color: #fff; }

/* 작은 화면 대응 */
@media (max-width: 360px) {
  .container { padding: 10px; }
  .card { padding: 10px; border-radius: 10px; }
  .info-table { font-size: 12px; }
  .pf-col-th { width: 46%; } .pf-col-td { width: 54%; }
  .pf-scope .pf-th, .pf-scope .pf-td { padding: 6px; }
}
</style>
