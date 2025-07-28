<!-- src/components/pages/LoginSuccessPage.vue -->
<template>
  <div class="success-page">
    <h2>{{ nickname }}님 반갑습니다.</h2>
    <p>로그인이 완료되었습니다.</p>

    <ion-button @click="goHome" expand="block" class="ion-margin-top">
      홈으로 이동
    </ion-button>
    <ion-button @click="logout" expand="block" color="danger" class="ion-margin-top">
      로그아웃
    </ion-button>
  </div>
</template>

<script setup>
import { IonButton } from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const nickname = ref('')

// 홈으로 이동
const goHome = () => {
  router.push('/home')
}

// 로그아웃
const logout = async () => {
  try {
    const res = await axios.post('http://localhost:2000/api/logout', {}, { withCredentials: true })
    console.log('로그아웃 응답:', res.data)
    router.push('/login')
  } catch (error) {
    console.error('로그아웃 실패:', error)
  }
}

// ✅ 사용자 닉네임 불러오기
onMounted(async () => {
  try {
    const res = await axios.get('http://localhost:2000/api/me', { withCredentials: true }) // 경로 수정됨
    console.log('세션 사용자 정보:', res.data)
    nickname.value = res.data.user?.nickname || ''
  } catch (error) {
    console.error('세션 사용자 정보 불러오기 실패:', error)
    router.push('/login')
  }
})
</script>

<style scoped>
.success-page {
  text-align: center;
  padding: 2rem;
}
</style>
