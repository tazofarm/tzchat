<template>
  <!-- ⚠️ Ionic 레이아웃 일치성: IonPage/IonContent 래퍼 필수 -->
  <ion-page>
    <ion-content>

      <!-- 🔹 최상단 인사 + 로그아웃 -->
      <div class="top-bar">
        <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
        <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
      </div>

      <!-- 🔹 회원 목록 제목 -->
      <div class="ion-padding ion-text-center">
        <h2 class="black-text">회원 목록</h2>
      </div>

      <!-- ✅ 로딩 상태 -->
      <ion-text v-if="loading" color="medium">
        <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
      </ion-text>

      <!-- ✅ 에러 상태 -->
      <ion-text v-else-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- 🔹 사용자 리스트 -->
      <ion-list v-else-if="users.length">
        <!-- IonItem을 버튼으로: dev/prod 터치/포커스 일치 -->
        <ion-item
          v-for="user in users"
          :key="user._id"
          :button="true"
          :detail="true"
          @click="goToUserProfile(user._id)"
        >
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

      <!-- 🔸 빈 목록 -->
      <ion-text v-else color="medium">
        <p class="ion-text-center">표시할 사용자가 없습니다.</p>
      </ion-text>

    </ion-content>
  </ion-page>
</template>

<script setup>
// ⚠️ 가독성 + 유지보수: 주석 및 로그 최대화
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'

// Ionic 컴포넌트 (import만 하고 안 쓰면 트리쉐이킹/타입 경고 가능)
import {
  IonPage, IonContent,
  IonList, IonItem, IonLabel,
  IonText, IonButton
} from '@ionic/vue'

const router = useRouter()

// 🔸 상태 정의
const users = ref([])               // 전체 사용자 목록
const nickname = ref('')            // 내 닉네임
const loading = ref(true)           // 로딩 플래그(로딩/빈 상태 구분)
const errorMessage = ref('')        // 사용자 메시지용 에러

// 🔧 공통 디버그: 빌드 환경/엔드포인트 확인 (dev/prod 동일화 점검)
console.log('[BUILD INFO]', {
  MODE: import.meta.env.MODE,
  BASE: import.meta.env.BASE_URL,
  API: import.meta.env.VITE_API_URL
})

// 🔹 유저 목록 + 내 정보 불러오기
onMounted(async () => {
  console.time('[LOAD] /api/users')
  console.time('[LOAD] /api/me')

  try {
    // ⚠️ 세션/쿠키 필요 API는 withCredentials 통일 → dev/prod 차이 제거
    const resUsers = await axios.get('/api/users', { withCredentials: true })
    users.value = Array.isArray(resUsers.data?.users) ? resUsers.data.users : []
    console.log('✅ /api/users OK, count:', users.value.length)
  } catch (error) {
    console.error('❌ 유저 목록 불러오기 실패:', error)
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  } finally {
    console.timeEnd('[LOAD] /api/users')
  }

  try {
    const resMe = await axios.get('/api/me', { withCredentials: true })
    nickname.value = resMe.data?.user?.nickname || ''
    console.log('✅ /api/me OK, nickname:', nickname.value)
  } catch (error) {
    console.error('❌ 닉네임 불러오기 실패:', error)
    // 닉네임 실패는 치명적이지 않으므로 메시지는 생략하고 로그만 남김
  } finally {
    console.timeEnd('[LOAD] /api/me')
    loading.value = false
  }
})

// 🔹 로그아웃
const logout = async () => {
  console.log('➡️ 로그아웃 시도')
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    console.log('✅ 로그아웃 성공 → /login 이동')
    router.replace('/login') // replace로 히스토리 정리
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
    errorMessage.value = '로그아웃에 실패했습니다.'
  }
}

// ✅ 유저 클릭 시 페이지로 이동
const goToUserProfile = (userId) => {
  if (!userId) {
    console.warn('⚠️ 유효하지 않은 userId:', userId)
    return
  }
  console.log('➡️ 사용자 프로필 페이지로 이동:', userId)
  router.push(`/home/user/${userId}`)
}
</script>

<style scoped>
/* 요청사항: 기본 글자색은 검정(가독성) - dev/prod 동일하게 보이도록 명시 */
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
