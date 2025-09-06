<template>
  <!-- 🔹 최상단 인사 + 로그아웃 -->
  <div class="top-bar">
    <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
    <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
  </div>

  <!-- 🔹 회원 목록 제목 -->
  <div class="ion-padding ion-text-center">
    <h2 class="black-text">회원 목록</h2>
  </div>

  <!-- 🔹 사용자 리스트 -->
  <ion-list v-if="users.length">
    <ion-item v-for="user in users" :key="user._id" @click="goToUserProfile(user._id)">
      <ion-label class="black-text">
        <h3>{{ user.username }} ({{ user.nickname }})</h3>
        <p>
          출생년도: {{ user.birthyear }} /
          성별: {{ user.gender === 'man' ? '남자' : '여자' }} /
          지역: {{ user.region1 }} / {{ user.region2 }}
        </p>
        <p>성향: {{ user.preference }}</p>
      </ion-label>
    </ion-item>
  </ion-list>

  <!-- 🔸 사용자 없음 / 로딩 중 -->
  <ion-text color="medium" v-else>
    <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
  </ion-text>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/api'

import {
  IonPage, IonContent,
  IonList, IonItem, IonLabel,
  IonText, IonButton
} from '@ionic/vue'

const router = useRouter()

// 🔸 상태 정의
const users = ref([])              // 전체 사용자 목록
const nickname = ref('')           // 내 닉네임

// 🔹 유저 목록 + 내 정보 불러오기
onMounted(async () => {
  try {
    const res = await axios.get('/api/users')
    users.value = res.data.users || []
  } catch (error) {
    console.error('❌ 유저 목록 불러오기 실패:', error)
  }

  try {
    const res = await axios.get('/api/me', { withCredentials: true })
    nickname.value = res.data.user?.nickname || ''
  } catch (error) {
    console.error('❌ 닉네임 불러오기 실패:', error)
  }
})

// 🔹 로그아웃
const logout = async () => {
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    router.push('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
  }
}

// ✅ 유저 클릭 시 페이지로 이동
const goToUserProfile = (userId) => {
  if (!userId) return
  console.log('➡️ 사용자 프로필 페이지로 이동:', userId)
  router.push(`/home/user/${userId}`)
}
</script>

<style scoped>
/* ── 회원 목록 페이지: CSS 보정 ──
   - 상단바 높이/간격 통일
   - 목록 가독성 강화
   - 공통 톤(검정 텍스트)
*/

/* 상단바 */
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto; /* 왼쪽 인사말 | 오른쪽 버튼 */
  align-items: center;
  gap: 10px;

  height: 50px;                     /* 고정 높이 */
  padding: 0 12px;
  background-color: #f1f1f1;
  border-bottom: 1px solid #ccc;
  font-size: 0.95rem;
  color: #000;
}
.welcome-text {
  font-weight: 700;
  color: #000;
  font-size: clamp(15px, 2.6vw, 16px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top-bar ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;
}

/* 페이지 제목 */
h2 {
  margin: 14px 0;
  font-size: clamp(18px, 3vw, 20px);
  font-weight: 700;
  color: #000;
}

/* 리스트 아이템 */
ion-item {
  --min-height: 60px;
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --background: #fff;
  border-bottom: 1px solid #eee;
}
ion-item:hover {
  background: #fafafa;
}
.black-text h3 {
  margin: 0 0 4px;
  font-size: clamp(15px, 2.8vw, 16px);
  font-weight: 700;
  color: #000;
}
.black-text p {
  margin: 2px 0;
  font-size: clamp(13px, 2.5vw, 14px);
  color: #333;
}

/* 로딩 텍스트 */
.ion-text-center {
  font-size: clamp(14px, 2.5vw, 15px);
  color: #666;
  margin-top: 20px;
}

</style>
