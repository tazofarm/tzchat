<template>
  <!-- 로그인 페이지와 동일한 레이아웃 골격: ion-page/ion-header/ion-content는 유지하되,
       내부 입력 UI는 "일반 HTML 폼"으로 구성 -->
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>회원가입</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="container">
        <!-- 디버그용 빌드/환경 로그 -->
        <div class="env-log" aria-hidden="true">
          <div>Axios Base URL: {{ axiosBaseUrl }}</div>
          <div>Environment: {{ envLabel }}</div>
        </div>

        <form class="form" @submit.prevent="onSubmit" autocomplete="on" novalidate>
          <!-- 아이디 -->
          <div class="form-row">
            <label for="username">아이디</label>
            <input
              id="username"
              name="username"
              type="text"
              v-model.trim="form.username"
              placeholder="아이디"
              autocomplete="username"
              required
            />
          </div>

          <!-- 비밀번호 -->
          <div class="form-row">
            <label for="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              v-model="form.password"
              placeholder="비밀번호"
              autocomplete="new-password"
              required
            />
          </div>

          <!-- 비밀번호 확인 -->
          <div class="form-row">
            <label for="password2">비밀번호 확인</label>
            <input
              id="password2"
              name="password2"
              type="password"
              v-model="form.password2"
              placeholder="비밀번호 확인"
              autocomplete="new-password"
              required
            />
            <p v-if="passwordMismatch" class="hint error">⚠ 비밀번호가 일치하지 않습니다.</p>
          </div>

          <!-- 닉네임 -->
          <div class="form-row">
            <label for="nickname">닉네임</label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              v-model.trim="form.nickname"
              placeholder="닉네임"
              required
            />
          </div>

          <!-- 출생년도 -->
          <div class="form-row">
            <label for="birthyear">출생년도</label>
            <select id="birthyear" name="birthyear" v-model="form.birthyear" required>
              <option value="" disabled>출생년도를 선택하세요</option>
              <option v-for="y in birthyearOptions" :key="y" :value="y">{{ y }}년</option>
            </select>
          </div>

          <!-- 성별 -->
          <div class="form-row">
            <span class="label-inline">성별</span>
            <div class="radio-group">
              <label class="radio">
                <input type="radio" name="gender" value="man" v-model="form.gender" />
                <span>남자</span>
              </label>
              <label class="radio">
                <input type="radio" name="gender" value="woman" v-model="form.gender" />
                <span>여자</span>
              </label>
            </div>
          </div>

          <!-- 버튼 -->
          <div class="button-col">
            <button type="submit" class="btn primary" :disabled="submitting || !isValid">
              {{ submitting ? '처리 중…' : '회원가입' }}
            </button>
            <router-link to="/login" class="btn ghost">로그인으로</router-link>
          </div>

          <!-- 메시지 영역 -->
          <p v-if="errorMsg" class="hint error">{{ errorMsg }}</p>
          <p v-if="successMsg" class="hint success">{{ successMsg }}</p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/* -------------------------------------------------------
 * SignupPage - 로그인 페이지와 동일하게 "일반 폼" 구조
 * - 기존 API 경로/로직 최대 유지
 * - 콘솔 로그/에러 로그 최대
 * - 가독성 위해 텍스트 컬러는 CSS에서 기본 검정(#111)
 * -----------------------------------------------------*/
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'

// 라우터
const router = useRouter()

// 폼 상태
const form = ref({
  username: '',
  password: '',
  password2: '',
  nickname: '',
  birthyear: '' as number | '' ,
  gender: '' as 'man' | 'woman' | ''
})

// 제출 상태
const submitting = ref(false)

// 출생년도: 1950 ~ (현재년도-19) 역순
const adultYear = new Date().getFullYear() - 19
const birthyearOptions = Array.from({ length: adultYear - 1950 + 1 }, (_, i) => adultYear - i)

// 유효성
const passwordMismatch = computed(() =>
  form.value.password !== '' &&
  form.value.password2 !== '' &&
  form.value.password !== form.value.password2
)

const isValid = computed(() =>
  !!form.value.username &&
  !!form.value.password &&
  !!form.value.password2 &&
  !passwordMismatch.value &&
  !!form.value.nickname &&
  !!form.value.birthyear &&
  !!form.value.gender
)

// 환경/베이스 URL을 화면에도 표시(진단용)
const axiosBaseUrl = (axios.defaults.baseURL || '(none)')
const envLabel = import.meta.env.PROD ? 'PROD' : 'DEV'

onMounted(() => {
  console.log('🧩 [Signup] Mounted. Env:', envLabel, 'BaseURL:', axiosBaseUrl)
  console.log('🧩 [Signup] Initial state:', JSON.parse(JSON.stringify(form.value)))
})

// 제출
async function onSubmit() {
  if (!isValid.value) {
    console.warn('⛔ [Signup] Invalid form:', JSON.parse(JSON.stringify(form.value)))
    return
  }
  submitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const payload = {
    username: form.value.username,
    password: form.value.password, // 서버에서 해시
    nickname: form.value.nickname,
    gender: form.value.gender,
    birthyear: form.value.birthyear
  }

  console.log('📝 [Signup] Submit payload:', { ...payload, password: '(hidden)' })

  try {
    const res = await axios.post('/api/signup', payload, { withCredentials: true })
    console.log('✅ [Signup] API OK:', res.status, res.data)
    successMsg.value = '회원가입이 완료되었습니다.'
    // 로그인 페이지로 이동 (기존 흐름 유지)
    router.push('/login')
  } catch (err: any) {
    console.error('❌ [Signup] API Error:', err?.response || err)
    errorMsg.value = err?.response?.data?.message || '회원가입 실패'
  } finally {
    submitting.value = false
  }
}

// 메시지
const errorMsg = ref('')
const successMsg = ref('')

</script>

<style scoped>
/* -------------------------------------------------------
 * 기본 글자색/배경: 검정/흰색 (가독성 보장)
 * 로그인과 동일한 심플 레이아웃
 * -----------------------------------------------------*/
:host, * {
  color: #111111;
  box-sizing: border-box;
}

.container {
  width: min(640px, 92vw);
  margin: 16px auto 64px;
  padding: 8px 4px 16px;
}

.env-log {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 8px;
  line-height: 1.2;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row label,
.label-inline {
  font-weight: 600;
  font-size: 14px;
}

.form-row input[type="text"],
.form-row input[type="password"],
.form-row select {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  outline: none;
  background: #fff;
  color: #111;
}

.form-row input::placeholder {
  color: #999;
}

.radio-group {
  display: flex;
  gap: 24px;
  align-items: center;
  padding-top: 6px;
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.button-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.btn {
  height: 44px;
  border-radius: 10px;
  text-align: center;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn.primary {
  background: #3b82f6;
  color: #fff;
  border: 1px solid #2e6bd1;
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.ghost {
  background: #fff;
  color: #111;
  border: 1px solid #dcdcdc;
}

.hint {
  margin: 2px 2px 0;
  font-size: 13px;
}

.hint.error {
  color: #c0392b;
}

.hint.success {
  color: #2d7a33;
}
</style>
