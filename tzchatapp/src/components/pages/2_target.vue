<template>
  <!-- 🔹 최상단 인사 + 로그아웃 -->
  <div class="top-bar">
    <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
    <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
  </div>

  <div class="container">


  </div>
 
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonPage, IonContent, IonList, IonItem, IonLabel, IonText, IonButton } from '@ionic/vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const users = ref([])
const nickname = ref('')

// 유저 목록 불러오기
onMounted(async () => {
  try {
    const res = await axios.get('/api/users')
    users.value = res.data.users || []
  } catch (error) {
    console.error('유저 목록 불러오기 실패:', error)
  }

  try {
    const res = await axios.get('/api/me', { withCredentials: true })
    nickname.value = res.data.user?.nickname || ''
  } catch (error) {
    console.error('닉네임 불러오기 실패:', error)
  }
})

// 로그아웃
const logout = async () => {
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    router.push('/login')
  } catch (err) {
    console.error('로그아웃 실패:', err)
  }
}
</script>

<style scoped>
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
}

.black-text {
  color: black;
}

.welcome-text {
  font-weight: bold;
  color: #000; /* ✅ 글씨를 검은색으로 지정 */
}

.container {
  max-width: 600px;
  margin: 0 auto;
}
</style>
