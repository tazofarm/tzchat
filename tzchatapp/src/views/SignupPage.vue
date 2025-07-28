<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>회원가입</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="signup" class="signup-form">

        <!-- 아이디 -->
        <ion-item>
          <ion-label position="stacked">아이디</ion-label>
          <ion-input v-model="username" autocomplete="username" required />
        </ion-item>

        <!-- 비밀번호 -->
        <ion-item>
          <ion-label position="stacked">비밀번호</ion-label>
          <ion-input type="password" v-model="password" autocomplete="new-password" required />
        </ion-item>

        <!-- 비밀번호 확인 -->
        <ion-item>
          <ion-label position="stacked">비밀번호 확인</ion-label>
          <ion-input type="password" v-model="confirmPassword" required />
        </ion-item>
        <ion-text color="danger" v-if="passwordMismatch">
          <p class="ion-padding-start ion-text-left">⚠ 비밀번호가 일치하지 않습니다.</p>
        </ion-text>

        <!-- 닉네임 -->
        <ion-item>
          <ion-label position="stacked">닉네임</ion-label>
          <ion-input v-model="nickname" required />
        </ion-item>

        <!-- 출생년도 -->
        <ion-item>
          <ion-label>출생년도</ion-label>
          <ion-select v-model="birthyear" placeholder="출생년도를 선택하세요">
            <ion-select-option v-for="year in years" :key="year" :value="year">{{ year }}</ion-select-option>
          </ion-select>
        </ion-item>

        <!-- 성별 -->
        <ion-item lines="none">
          <ion-label>성별</ion-label>
        </ion-item>
        <ion-radio-group v-model="gender">
          <div class="gender-options">
            <label class="gender-option">
              <ion-radio value="man" slot="start" />
              <span>남자</span>
            </label>
            <label class="gender-option">
              <ion-radio value="woman" slot="start" />
              <span>여자</span>
            </label>
          </div>
        </ion-radio-group>

        <!-- 회원가입 버튼 -->
        <ion-button expand="block" type="submit" :disabled="passwordMismatch" class="ion-margin-top">
          회원가입
        </ion-button>

        <!-- 에러 메시지 -->
        <ion-text color="danger" v-if="errorMsg">
          <p class="ion-text-center ion-padding-top">{{ errorMsg }}</p>
        </ion-text>

        <!-- 성공 메시지 -->
        <ion-text color="success" v-if="successMsg">
          <p class="ion-text-center ion-padding-top">{{ successMsg }}</p>
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
import axios from '@/lib/axiosInstance'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonRadio, IonRadioGroup,
  IonButton, IonText, IonSelect, IonSelectOption
} from '@ionic/vue'

const router = useRouter()

// 입력값
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('')
const gender = ref('')
const birthyear = ref(null)

// 출생년도 리스트 (1950 ~ 2020)
const years = Array.from({ length: 2020 - 1950 + 1 }, (_, i) => 2020 - i)

// 메시지
const errorMsg = ref('')
const successMsg = ref('')

// 비밀번호 일치 여부
const passwordMismatch = computed(() => {
  return confirmPassword.value !== '' && password.value !== confirmPassword.value
})

// 필수값 유효성 검사
const isFormValid = () => {
  return (
    username.value &&
    password.value &&
    confirmPassword.value &&
    nickname.value &&
    birthyear.value &&
    gender.value
  )
}

async function signup() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!isFormValid()) {
    errorMsg.value = '모든 항목을 작성해 주세요.'
    return
  }

  if (passwordMismatch.value) {
    errorMsg.value = '비밀번호가 일치하지 않습니다.'
    return
  }

  try {
    const res = await axios.post('/api/signup', {
      username: username.value,
      password: password.value,
      nickname: nickname.value,
      gender: gender.value,
      birthyear: birthyear.value
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
.signup-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gender-options {
  display: flex;
  justify-content: space-around;
  padding: 0.5rem 0;
  gap: 1rem;
}

.gender-option {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}

p {
  margin: 0;
  font-size: 0.95rem;
}
</style>
