<template>
  <!-- ✅ 전역 theme-gold 적용 가정: 이 컴포넌트는 토큰만 사용 -->
  <div class="profile-page">
    <!-- 🔹 제목 + 뒤로가기 버튼 -->
    <div class="header-row">
      <h2>{{ user.nickname }}님의 프로필</h2>
      <ion-button size="small" @click="goBack">뒤로가기</ion-button>
    </div>

    <!-- 🔍 사용자 정보 테이블 -->
    <table class="info-table">
      <tbody>
        <tr>
          <td><strong>닉네임</strong></td>
          <td>{{ user.nickname || '-' }}</td>
        </tr>

        <tr>
          <td><strong>성별</strong></td>
          <td>{{ user.gender === 'man' ? '남자' : '여자' }}</td>
        </tr>

        <tr>
          <td><strong>출생년도</strong></td>
          <td>{{ user.birthyear || '-' }}</td>
        </tr>

        <tr>
          <td><strong>지역</strong></td>
          <td>{{ user.region1 || '' }} {{ user.region2 || '' }}</td>
        </tr>

        <!-- ✅ 소개: 셀 클릭 시 모달 오픈 -->
        <tr class="row-clickable" @click="openIntroModal">
          <td><strong>소개</strong></td>
          <td class="intro-cell">
            <span class="intro-preview">{{ (user.selfintro || '없음') }}</span>
            <span class="intro-more">자세히</span>
          </td>
        </tr>

        <tr>
          <td><strong>최근 접속</strong></td>
          <td>{{ formatDate(user.last_login) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- ✅ 친구/차단 여부 표시 -->
    <p class="state-line">
      친구 여부: {{ user.isFriend ? '✅ yes' : '❌ no' }} /
      차단 여부: {{ user.isBlocked ? '🚫 yes' : '❌ no' }}
    </p>

    <!-- 💬 대화하기 버튼 -->
    <div class="chat-button">
      <ion-button
        expand="block"
        :disabled="!user.isFriend"
        @click="startChat(user._id)"
      >
        대화하기
      </ion-button>
    </div>

    <!-- 🙋‍♂️ 액션 버튼 그룹 -->
    <div class="button-group">
      <ion-button
        v-if="!user.isFriend"
        class="btn-outline"
        @click="onOpenFriendRequest"
        :disabled="showRequestModal || user.isBlocked"
      >
        친구 신청
      </ion-button>
      <ion-button
        v-else
        class="btn-warning"
        @click="removeFriend(user._id)"
      >
        친구 삭제
      </ion-button>

      <ion-button
        v-if="!user.isBlocked"
        class="btn-muted"
        @click="blockUser(user._id)"
      >
        차단하기
      </ion-button>
      <ion-button
        v-else
        class="btn-secondary"
        @click="unblockUser(user._id)"
      >
        차단 해제
      </ion-button>

      <ion-button class="btn-danger" @click="reportUser(user._id)">
        신고하기
      </ion-button>
    </div>

    <!-- ✅ 모달들 (원본 유지) -->
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
</template>

<script setup>
/* ===========================================================
   PageuserProfile.vue
   - 친구신청 모달 연동 (확실히 보이도록 z-index + v-if)
   - 모바일 한 줄 말줄임
   - 로그/주석 최대화
   - ⚠️ 색상은 전역 theme-gold 토큰을 사용 (이 파일 내 팔레트 정의 없음)
   =========================================================== */
import { ref, onMounted } from 'vue'
import { IonButton } from '@ionic/vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

import ModalFriendRequest from '@/components/03060_minipage/Modal_FriendRequest.vue'
import ModalSelfIntro from '@/components/03060_minipage/Modal_SelfIntro.vue'

const route = useRoute()
const router = useRouter()

const user = ref({
  _id: '',
  username: '',
  nickname: '',
  gender: '',
  birthyear: '',
  region1: '',
  region2: '',
  selfintro: '',
  createdAt: '',
  last_login: '',
  isFriend: false,
  isBlocked: false
})
const showRequestModal = ref(false)
const showIntroModal = ref(false)

// ✅ 날짜 형식 포맷 함수
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// ✅ 소개 모달 열기
function openIntroModal() {
  console.log('[UserProfile] 소개 모달 오픈')
  showIntroModal.value = true
}

// ✅ 사용자 정보 로딩
onMounted(async () => {
  try {
    const targetId = route.params.id
    console.log('[UserProfile] load target:', targetId)
    const res = await axios.get(`/api/users/${targetId}`, { withCredentials: true })
    // 백엔드가 { user: {...} } 또는 {...} 형태일 수 있어 안전 처리
    user.value = res.data?.user ?? res.data ?? {}
    console.log('👤 사용자 정보 로드됨:', user.value)
  } catch (err) {
    console.error('❌ 사용자 정보 로딩 실패', err?.response?.data || err)
  }
})

// ✅ 친구 신청 버튼 → 모달 오픈
function onOpenFriendRequest() {
  if (!user.value._id) {
    console.warn('[UserProfile] 대상 사용자 없음 → 모달 미오픈')
    return
  }
  console.log('[UserProfile] 친구 신청 모달 오픈')
  showRequestModal.value = true
}

// ✅ 친구 신청 완료 후 처리
function handleRequestSent() {
  console.log('✅ 친구 신청 완료')
  showRequestModal.value = false
}

// ✅ 대화 시작 (채팅방 생성 및 이동)
async function startChat(userId) {
  try {
    const res = await axios.post('/api/chatrooms', { userId }, { withCredentials: true })
    if (res.data && (res.data._id || res.data.id)) {
      const roomId = res.data._id || res.data.id
      router.push(`/home/chat/${roomId}`)
    }
  } catch (err) {
    console.error('❌ 채팅방 생성 실패:', err?.response?.data || err)
  }
}

// ✅ 친구 삭제 요청
async function removeFriend(targetId) {
  try {
    await axios.delete(`/api/friends/${targetId}`, { withCredentials: true })
    user.value.isFriend = false
    console.log('🗑️ 친구 삭제됨:', targetId)
  } catch (err) {
    console.error('❌ 친구 삭제 실패:', err?.response?.data || err)
  }
}

// ✅ 사용자 차단
async function blockUser(targetId) {
  try {
    await axios.put(`/api/block/${targetId}`, {}, { withCredentials: true })
    user.value.isBlocked = true
    console.log('🚫 차단됨:', targetId)
  } catch (err) {
    console.error('❌ 차단 실패:', err?.response?.data || err)
  }
}

// ✅ 차단 해제
async function unblockUser(targetId) {
  try {
    await axios.put(`/api/unblock/${targetId}`, {}, { withCredentials: true })
    user.value.isBlocked = false
    console.log('🔓 차단 해제됨:', targetId)
  } catch (err) {
    console.error('❌ 차단 해제 실패:', err?.response?.data || err)
  }
}

// ✅ 신고하기 (임시 로그)
function reportUser(id) {
  console.log('⚠️ 신고 요청:', id)
}

// 🔙 뒤로가기
function goBack() {
  router.back()
}
</script>

<style scoped>
/* ===========================================================
   GOLD THEME (전역 토큰 사용)
   - 블랙 기반 + 골드 포인트
   - 이 파일에서는 팔레트 값을 선언하지 않음(전역 theme-gold에 위임)
   =========================================================== */
.profile-page {
  background: var(--bg);
  color: var(--text);
  padding: 12px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  max-width: 520px;
  margin: 0 auto;
  box-sizing: border-box;
}

/* 상단: 제목 + 뒤로가기 */
.header-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 0 8px;
  margin-bottom: 10px;
  background: linear-gradient(180deg, #161616, #121212);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  backdrop-filter: blur(6px);
}
.header-row h2 {
  margin: 0;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-row ion-button {
  /* 골드 라인 버튼 */
  --background: transparent;
  --color: var(--gold);
  --border-color: var(--gold);
  --border-style: solid;
  --border-width: 1px;
  --border-radius: 10px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 36px;
}

/* 정보 테이블 */
.info-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: clamp(14px, 2.6vw, 15px);
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
}
.info-table td {
  padding: 12px 10px;
  border-bottom: 1px solid var(--panel-border);
  vertical-align: top;
  color: var(--text);
  word-break: break-word;
}

/* 소개 행에서만 좌측(라벨)을 가운데 정렬 */
.info-table tr.row-clickable td:first-child {
  vertical-align: middle;
}

.info-table tr:last-child td { border-bottom: 0; }
.info-table td:first-child {
  width: 34%;
  max-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-dim);
}
.info-table td:first-child strong { color: var(--text); }

.row-clickable { cursor: pointer; transition: background-color .15s; }
.row-clickable:hover { background: #202020; }
.intro-cell { display:flex; align-items:center; gap:8px; min-height:80px; }
.intro-preview { flex:1 1 auto; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.intro-more { color: var(--gold); font-weight: 700; }

/* 상태 라인 */
.state-line { font-weight:700; color: var(--text-dim); }

/* 버튼 공통(대화하기/액션) */
.chat-button { margin: 12px 0; }
ion-button {
  --border-radius: 12px;
  font-weight: 700;
}

/* 프라이머리(대화하기) = 풀골드 */
.chat-button ion-button {
  --background: var(--gold);
  --background-activated: var(--gold-deep);
  --background-hover: var(--gold-deep);
  --color: #1a1a1a;
}

/* 기타 액션 버튼들 */
.button-group { display:flex; flex-wrap:wrap; gap:8px; }
.btn-outline {
  --background: transparent; --color: var(--gold);
  --border-color: var(--gold); --border-style: solid; --border-width: 1px;
}
.btn-warning {
  --background: #3a2a0a; --color: var(--gold);
  --background-hover: #4a3510;
}
.btn-muted {
  --background: transparent; --color: var(--muted);
  --border-color: var(--panel-border); --border-style: solid; --border-width: 1px;
}
.btn-secondary {
  --background: #232323; --color: var(--gold);
}
.btn-danger {
  --background: var(--danger); --color: #fff;
}

/* 포커스 접근성 */
:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(255,213,79,.25); border-radius:10px; }

/* 초소형 화면 */
@media (max-width: 360px) {
  .profile-page { padding: 10px; }
  .header-row { padding: 0 6px; gap: 8px; }
  .info-table td { padding: 10px 8px; }
}
</style>
