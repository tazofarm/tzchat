<!--  -->

<template>
  <!-- ⚠️ Ionic 레이아웃 일치성: IonPage/IonContent 래퍼 필수 -->
  <ion-page>
    <!-- ✅ 상단 헤더 (뒤로가기 버튼 포함) -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            ← 뒤로가기
          </ion-button>
        </ion-buttons>
        <ion-title>회원 목록</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- 🔹 회원 목록 제목 (헤더 타이틀 외 보조) -->
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
import axios from '@/lib/api'

// Ionic 컴포넌트
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle,
  IonList, IonItem, IonLabel, IonText
} from '@ionic/vue'

const router = useRouter()

// 🔸 상태 정의
const users = ref([])               // 전체 사용자 목록
const nickname = ref('')            // 내 닉네임
const loading = ref(true)           // 로딩 플래그
const errorMessage = ref('')        // 사용자 메시지용 에러

// 🔹 유저 목록 + 내 정보 불러오기
onMounted(async () => {
  console.time('[LOAD] /api/users')
  console.time('[LOAD] /api/me')

  try {
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
  } finally {
    console.timeEnd('[LOAD] /api/me')
    loading.value = false
  }
})

// ✅ 뒤로가기
function goBack() {
  console.log('⬅️ 뒤로가기 클릭')
  router.back()
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
ion-content {
  --background: #ffffff;
  color: #000000;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: contain;
}

h2.black-text {
  color: #000;
  font-size: clamp(18px, 4.5vw, 22px);
  font-weight: 700;
  margin: 10px 0 6px;
  line-height: 1.25;
}

ion-list {
  background: #fff;
  margin: 8px 8px 14px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #eee;
}

ion-item {
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: #eee;
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 56px;
  color: #000;
}
ion-item:last-of-type {
  --inner-border-width: 0;
}
ion-item ion-label.black-text h3 {
  color: #000;
  font-size: clamp(15px, 2.6vw, 16px);
  font-weight: 700;
  margin: 0 0 4px;
  line-height: 1.3;
}
ion-item ion-label.black-text p {
  color: #333;
  font-size: clamp(14px, 2.4vw, 15px);
  margin: 0;
  line-height: 1.35;
}

ion-text p.ion-text-center {
  margin: 12px 0;
  font-size: clamp(15px, 2.6vw, 16px);
  color: #555;
}

:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
  border-radius: 8px;
}
</style>
