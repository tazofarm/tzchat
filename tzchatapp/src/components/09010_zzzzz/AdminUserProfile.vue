<template>
  <div class="profile-page">
    <!-- 🔹 제목 + 뒤로가기 버튼 -->
    <div class="header-row">
      <h2>{{ user.nickname }}님의 프로필</h2>
      <ion-button size="small" color="medium" @click="goBack">뒤로가기</ion-button>
    </div>

    <!-- 🔍 사용자 정보 테이블 (tbody로 수정됨) -->
    <table class="info-table">
      <tbody>
        <tr><td><strong>아이디</strong></td><td>{{ user.username || '-' }}</td></tr>
        <tr><td><strong>성별</strong></td><td>{{ user.gender === 'man' ? '남자' : '여자' }}</td></tr>
        <tr><td><strong>출생년도</strong></td><td>{{ user.birthyear || '-' }}</td></tr>
        <tr><td><strong>지역</strong></td><td>{{ user.region1 || '' }} {{ user.region2 || '' }}</td></tr>
        <tr><td><strong>특징</strong></td><td>{{ user.preference || '없음' }}</td></tr>
        <tr><td><strong>소개</strong></td><td>{{ user.selfintro || '없음' }}</td></tr>
        <tr><td><strong>가입일</strong></td><td>{{ formatDate(user.createdAt) }}</td></tr>
        <tr><td><strong>최근 접속</strong></td><td>{{ formatDate(user.last_login) }}</td></tr>
      </tbody>
    </table>

    <!-- ✅ 친구 여부 확인 -->
    <p style="font-weight: bold; color: black">
      친구 여부: {{ user.isFriend ? '✅ yes' : '❌ no' }} /
      차단 여부: {{ user.isBlocked ? '🚫 yes' : '⭕ no' }}
    </p>

    <!-- 💬 대화하기 버튼 -->
    <div class="chat-button">
      <ion-button
        color="success"
        expand="block"
        :disabled="!user.isFriend"
        @click="startChat(user._id)"
      >
        대화하기
      </ion-button>
    </div>

    <!-- 🙋‍♂️ 액션 버튼 그룹 -->
    <div class="button-group">
      <!-- 친구 신청 or 삭제 -->
      <ion-button
        v-if="!user.isFriend"
        color="primary"
        @click="showRequestModal = true"
        :disabled="showRequestModal || user.isBlocked"
      >
        친구 신청
      </ion-button>
      <ion-button
        v-else
        color="warning"
        @click="removeFriend(user._id)"
      >
        친구 삭제
      </ion-button>

      <!-- 차단 or 차단 해제 -->
      <ion-button
        v-if="!user.isBlocked"
        color="medium"
        @click="blockUser(user._id)"
      >
        차단하기
      </ion-button>
      <ion-button
        v-else
        color="tertiary"
        @click="unblockUser(user._id)"
      >
        차단 해제
      </ion-button>

      <ion-button color="danger" @click="reportUser(user._id)">
        신고하기
      </ion-button>
    </div>

    <!-- ✅ 친구 신청 모달 -->
    <FriendRequestModal
      v-if="showRequestModal"
      :toUserId="user._id"
      :toNickname="user.nickname"
      @close="showRequestModal = false"
      @request-sent="handleRequestSent"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { IonButton } from '@ionic/vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import FriendRequestModal from '@/components/02010_minipage/mini_profile/Modal_FriendRequest.vue'

const route = useRoute()
const router = useRouter()

const user = ref({})
const showRequestModal = ref(false)

// ✅ 날짜 형식 포맷 함수
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// ✅ 사용자 정보 로딩
onMounted(async () => {
  try {
    const res = await axios.get(`/api/users/${route.params.id}`)
    user.value = res.data
    console.log('👤 사용자 정보 로드됨:', user.value)
  } catch (err) {
    console.error('❌ 사용자 정보 로딩 실패', err)
  }
})

// ✅ 친구 신청 완료 후 처리
function handleRequestSent() {
  console.log('✅ 친구 신청 완료')
  showRequestModal.value = false
}

// ✅ 대화 시작 (채팅방 생성 및 이동)
async function startChat(userId) {
  try {
    const res = await axios.post('/api/chatrooms', { userId })
    if (res.data && res.data._id) {
      router.push(`/home/chat/${res.data._id}`)
    }
  } catch (err) {
    console.error('❌ 채팅방 생성 실패:', err)
  }
}

// ✅ 친구 삭제 요청
async function removeFriend(targetId) {
  try {
    await axios.delete(`/api/friends/${targetId}`)
    user.value.isFriend = false
    console.log('🗑️ 친구 삭제됨:', targetId)
  } catch (err) {
    console.error('❌ 친구 삭제 실패:', err)
  }
}

// ✅ 사용자 차단
async function blockUser(targetId) {
  try {
    await axios.put(`/api/block/${targetId}`)
    user.value.isBlocked = true
    console.log('🚫 차단됨:', targetId)
  } catch (err) {
    console.error('❌ 차단 실패:', err)
  }
}

// ✅ 차단 해제
async function unblockUser(targetId) {
  try {
    await axios.put(`/api/unblock/${targetId}`)
    user.value.isBlocked = false
    console.log('🔓 차단 해제됨:', targetId)
  } catch (err) {
    console.error('❌ 차단 해제 실패:', err)
  }
}

// ✅ 신고하기 (임시 로그만 출력)
function reportUser(id) {
  console.log('⚠️ 신고 요청:', id)
}

// 🔙 뒤로가기
function goBack() {
  router.back()
}
</script>

<style scoped>
/* ── adminMainpage.vue: CSS 보정만 적용 ──
   - 가독성: 기본 글씨 검정 유지
   - 모바일 터치 타깃(≥48px) / 버튼 일관 규격
   - safe-area / 작은 화면 대응
   - 포커스 접근성(:focus-visible) 강화
*/

/* 컨테이너 */
.admin-mainpage {
  color: #000;                         /* 기본 텍스트 톤 고정 */
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  max-width: 800px;                    /* 데스크톱에서 너무 넓지 않게 */
  margin: 0 auto;                      /* 중앙 정렬 */
  box-sizing: border-box;
}

/* 제목/설명 */
.title {
  margin: 4px 0 8px;
  font-size: clamp(18px, 3.6vw, 20px);
  font-weight: 700;
  color: #000;
  line-height: 1.25;
}
.desc {
  margin: 0 0 16px;
  font-size: clamp(14px, 2.8vw, 15px);
  color: #222;
  opacity: 0.9;
  line-height: 1.4;
}

/* 메뉴 리스트 */
.menu-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 버튼: 터치 타깃/가독성/일관성 */
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  width: 100%;
  min-height: 48px;                    /* 터치 타깃 */
  padding: 12px 14px;

  font-size: clamp(15px, 3vw, 16px);
  font-weight: 600;
  line-height: 1.2;

  border: 1px solid #333;
  border-radius: 12px;

  background: #fff;
  color: #000;
  text-align: left;                    /* 번호+텍스트 왼쪽 정렬 */
  cursor: pointer;

  transition: background .15s, transform .06s ease-out, box-shadow .15s;
  -webkit-tap-highlight-color: rgba(0,0,0,0.05);
}
.menu-btn:hover { background: #f0f0f0; }
.menu-btn:active { transform: translateY(1px); }
.menu-btn:disabled { opacity: .6; cursor: not-allowed; }

/* 포커스 접근성 */
.menu-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
}

/* 디버그 박스 */
.debug-box {
  margin-top: 18px;
  padding: 10px 12px;
  border: 1px dashed #aaa;
  border-radius: 10px;
  font-size: clamp(13px, 2.6vw, 14px);
  color: #000;
  background: #fafafa;
  line-height: 1.35;
}

/* 초소형 화면(≤360px) 보정 */
@media (max-width: 360px) {
  .admin-mainpage { padding: 14px 14px; }
  .menu-btn { padding: 12px; }
}

</style>
