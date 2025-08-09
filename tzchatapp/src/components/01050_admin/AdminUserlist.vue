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
import axios from '@/lib/axiosInstance'

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
h2 {
  text-align: center;
  margin: 1rem 0;
  color: black;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0rem;
  background-color: #f1f1f1;
  font-size: 0.95rem;
  border-bottom: 1px solid #ccc;
}

.welcome-text {
  font-weight: bold;
  color: black;
}

.black-text {
  color: black;
}
</style>
