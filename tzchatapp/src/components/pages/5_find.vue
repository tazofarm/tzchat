<template>
  <div class="page-wrapper">
    <!-- 🔹 최상단 인사 + 로그아웃 -->
    <div class="top-bar">
      <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
      <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
    </div>

    <!-- 🔹 사용자 정보 카드 -->
    <div class="container">
      <div v-if="user" class="card">
        <!-- ✅ 제목은 테이블 바깥에 위치 -->
        <h3 class="section-title">검색설정</h3>

        <table class="info-table">
          <tbody>
            <tr>
              <td><strong>검색나이</strong></td>
              <td>{{ user.search_birthyear1 }} ~ {{ user.search_birthyear2 }}</td>
            </tr>
            <tr>
              <td><strong>검색지역</strong></td>
              <td>{{ user.search_region1 }} {{ user.search_region2 }}</td>
            </tr>
            <tr>
              <td><strong>검색특징</strong></td>
              <td>{{ user.search_preference }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const nickname = ref('')
const user = ref(null)

// 사용자 정보 로딩
onMounted(async () => {
  try {
    const resUser = await axios.get('/api/me', { withCredentials: true })
    nickname.value = resUser.data.user?.nickname || ''
    user.value = resUser.data.user
  } catch (err) {
    console.error('유저 정보 로딩 실패:', err)
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
  color: #000;
}

.container {
  width: 100%;
  height: 100%;
  max-width: 100%;
  padding: 1rem;
  box-sizing: border-box;
  margin: 0 auto;
}

.card {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 1rem;
  background-color: #fff;
  color: #222;
}

.section-title {
  font-size: 1rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: #000;
}

.info-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.info-table td {
  padding: 0.5rem;
  border-bottom: 1px solid #ddd;
}

.info-table td:first-child {
  font-weight: bold;
  width: 30%;
  color: #333;
}

.info-table td:last-child {
  text-align: left;
}

.loading-text {
  color: #999;
  text-align: center;
}
</style>
