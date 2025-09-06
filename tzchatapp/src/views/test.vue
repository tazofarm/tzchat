<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>회원가입</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="signup">

        <!-- 아이디 -->
        <ion-item>
          <ion-label position="floating">아이디</ion-label>
          <ion-input v-model="username" autocomplete="username" required />
        </ion-item>

        <!-- 비밀번호 -->
        <ion-item>
          <ion-label position="floating">비밀번호</ion-label>
          <ion-input type="password" v-model="password" autocomplete="new-password" required />
        </ion-item>

        <!-- 비밀번호 확인 -->
        <ion-item>
          <ion-label position="floating">비밀번호 확인</ion-label>
          <ion-input type="password" v-model="confirmPassword" required />
        </ion-item>
        <ion-text color="danger" v-if="passwordMismatch">
          <p class="ion-padding-start">비밀번호가 일치하지 않습니다.</p>
        </ion-text>

        <!-- 닉네임 -->
        <ion-item>
          <ion-label position="floating">닉네임</ion-label>
          <ion-input v-model="nickname" required />
        </ion-item>

        <!-- 성별 -->
        <ion-item lines="none">
          <ion-label>성별</ion-label>
        </ion-item>
        <ion-item lines="none" class="gender-radio-group">
          <ion-radio-group v-model="gender">
            <ion-item lines="none">
              <ion-label>남자</ion-label>
              <ion-radio slot="start" value="남자" />
            </ion-item>
            <ion-item lines="none">
              <ion-label>여자</ion-label>
              <ion-radio slot="start" value="여자" />
            </ion-item>
          </ion-radio-group>
        </ion-item>

        <!-- 회원가입 버튼 -->
        <div class="ion-margin-top">
          <ion-button expand="block" type="submit" :disabled="passwordMismatch">회원가입</ion-button>
        </div>

        <!-- 에러 메시지 -->
        <ion-text color="danger" v-if="errorMsg">
          <p class="ion-text-center">{{ errorMsg }}</p>
        </ion-text>

        <!-- 성공 메시지 -->
        <ion-text color="success" v-if="successMsg">
          <p class="ion-text-center">{{ successMsg }}</p>
        </ion-text>

        <!-- 로그인으로 이동 -->
        <div class="ion-text-center ion-margin-top">
          <ion-button fill="clear" size="small" @click="router.push('/login')">로그인으로</ion-button>
        </div>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/api'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonRadioGroup, IonRadio,
  IonButton, IonText
} from '@ionic/vue'

const router = useRouter()

// 입력값
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('')
const gender = ref('남자')

// 메시지
const errorMsg = ref('')
const successMsg = ref('')

// 비밀번호 일치 여부
const passwordMismatch = computed(() => {
  return confirmPassword.value !== '' && password.value !== confirmPassword.value
})

async function signup() {
  errorMsg.value = ''
  successMsg.value = ''

  if (passwordMismatch.value) {
    errorMsg.value = '비밀번호가 일치하지 않습니다.'
    return
  }

  try {
    const res = await axios.post('/api/signup', {
      username: username.value,
      password: password.value,
      nickname: nickname.value,
      gender: gender.value
    }, { withCredentials: true })

    if (res.status === 201) {
      successMsg.value = '회원가입 성공! 로그인 해주세요.'
      setTimeout(() => router.push('/login'), 1200)
    } else {
      errorMsg.value = res.data.message || '회원가입 실패'
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.message || '서버 오류'
  }
}
</script>

<style scoped>
.gender-radio-group {
  display: flex;
  justify-content: space-around;
  padding: 0 8px;
}
</style>
