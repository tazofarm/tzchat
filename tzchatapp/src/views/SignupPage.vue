<template>
  <!-- 로그인 페이지와 동일한 레이아웃 골격: ion-page/ion-header/ion-content 유지 -->
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>회원가입</ion-title>
      </ion-toolbar>
    </ion-header>

    <!-- 한 페이지(뷰포트) 내에 들어오도록 scrollY 비활성 + 내부 레이아웃 컴팩트 -->
    <ion-content :fullscreen="true" :scroll-y="false">
      <div class="container onepage">
        <form class="form compact" @submit.prevent="onSubmit" autocomplete="on" novalidate>
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

          <!-- 지역 (가로 배치) -->
          <div class="form-row">
            <label>지역</label>
            <div class="region-row">
              <!-- 지역1 -->
              <div class="col">
                <select id="region1" name="region1" v-model="form.region1" required>
                  <option value="" disabled>지역1을 선택하세요</option>
                  <option v-for="r1 in region1Options" :key="r1" :value="r1">{{ r1 }}</option>
                </select>
              </div>
              <!-- 지역2 -->
              <div class="col">
                <select
                  id="region2"
                  name="region2"
                  v-model="form.region2"
                  :disabled="!form.region1"
                  required
                >
                  <option value="" disabled>지역2를 선택하세요</option>
                  <!-- ✅ 회원가입(로그인 전): '전체'를 넣지 않음 -->
                  <option v-for="r2 in region2Options" :key="r2" :value="r2">{{ r2 }}</option>
                </select>
              </div>
            </div>
            <p v-if="!form.region1" class="hint">먼저 지역1을 선택하세요.</p>
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
 * SignupPage - 일반 폼 구조 (컴팩트 1페이지 레이아웃 적용)
 * - 지역2에 '전체' 옵션 제거 (회원가입에서는 정확한 지점 선택)
 * - 로그/에러로그 충분히 출력
 * -----------------------------------------------------*/
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, http, API_PREFIX } from '@/lib/api' // 공용 래퍼 사용
import { regions } from '@/data/regions'          // named export

const router = useRouter()

// 폼 상태
const form = ref({
  username: '',
  password: '',
  password2: '',
  nickname: '',
  birthyear: '' as number | '',
  gender: '' as 'man' | 'woman' | '',
  region1: '' as string,
  region2: '' as string,
})

const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// 출생년도: 1950 ~ (현재년도-19) 역순
const adultYear = new Date().getFullYear() - 19
const birthyearOptions = Array.from({ length: adultYear - 1950 + 1 }, (_, i) => adultYear - i)

// 지역 옵션
const region1Options = computed<string[]>(() => {
  try {
    const keys = Object.keys(regions || {})
    console.log('🗺️ [Signup] region1Options:', keys)
    return keys
  } catch (e) {
    console.error('❌ [Signup] region1Options error:', e)
    return []
  }
})

const region2Options = computed<string[]>(() => {
  if (!form.value.region1) return []
  const raw = Array.isArray((regions as any)[form.value.region1]) ? (regions as any)[form.value.region1] : []
  // ✅ 회원가입에서는 '전체'를 삽입하지 않는다
  console.log('🗺️ [Signup] region2Options for', form.value.region1, ':', raw)
  return raw
})

// 지역1 변경 시 지역2 리셋
watch(
  () => form.value.region1,
  (newVal) => {
    console.log('🔁 [Signup] region1 changed:', newVal, '→ reset region2')
    form.value.region2 = ''
  },
)

// 유효성
const passwordMismatch = computed(
  () =>
    form.value.password !== '' &&
    form.value.password2 !== '' &&
    form.value.password !== form.value.password2,
)

const isValid = computed(
  () =>
    !!form.value.username &&
    !!form.value.password &&
    !!form.value.password2 &&
    !passwordMismatch.value &&
    !!form.value.nickname &&
    !!form.value.birthyear &&
    !!form.value.gender &&
    !!form.value.region1 &&
    !!form.value.region2,
)

// (옵션) 환경/베이스 URL 표시
const axiosBaseUrl = api.defaults.baseURL || '(none)'
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
    birthyear: form.value.birthyear,
    region1: form.value.region1,
    region2: form.value.region2,
  }

  console.log('📝 [Signup] Submit payload:', { ...payload, password: '(hidden)' })

  try {
    // 경로/프리픽스 통일: `${API_PREFIX}/signup` → http 래퍼가 '/api' 중복 제거
    const res = await http.post(`${API_PREFIX}/signup`, payload)
    console.log('✅ [Signup] API OK:', res.status, res.data)
    successMsg.value = '회원가입이 완료되었습니다.'
    router.push('/login')
  } catch (err: any) {
    console.error('❌ [Signup] API Error:', err?.response || err)
    errorMsg.value = err?.response?.data?.message || '회원가입 실패'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* ✅ 기본 가독성 유지 + 컴팩트 레이아웃 */

/* 툴바(헤더) 높이 */
ion-toolbar {
  --min-height: 44px;
  --padding-top: 0px;
  --padding-bottom: 0px;
}

/* 타이틀 글씨 크기 */
ion-title {
  font-size: 16px;
  font-weight: 600;
  color: #fcfafa;
}

/* 컨테이너가 헤더를 제외한 뷰포트 높이를 꽉 채우도록 제한 */
.container.onepage {
  width: min(640px, 92vw);
  margin: 4px auto 0;
  padding: 6px 4px 0;
  color: #111;
  max-height: calc(100vh - 56px);
  display: flex;
  align-items: flex-start;
}

:host {
  display: block;
}

/* 폼 레이아웃 컴팩트 */
.form.compact {
  display: grid;
  grid-auto-rows: min-content;
  row-gap: 8px;
  width: 100%;
}

/* 개별 행 간 간격 축소 */
.form-row {
  display: grid;
  row-gap: 4px;
}

/* 라벨/인라인 라벨 */
.form-row label,
.label-inline {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.1px;
  color: #fcfafa;
}

/* 입력류 */
.form-row input[type='text'],
.form-row input[type='password'],
.form-row select {
  width: 100%;
  height: 20px;
  padding: 0 12px;
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  outline: none;
  background: #fff;
  color: #111;
  font-size: 10px;
  transition: box-shadow 0.15s, border-color 0.15s;
  -webkit-appearance: none;
}
.form-row input::placeholder {
  color: #999;
}

/* 포커스 가시성 */
.form-row input:focus-visible,
.form-row select:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.22);
  border-radius: 10px;
}

/* 오토필 가독성 */
.form-row input:-webkit-autofill,
.form-row input:-webkit-autofill:hover,
.form-row input:-webkit-autofill:focus {
  -webkit-text-fill-color: #111;
  transition: background-color 5000s;
  box-shadow: 0 0 0px 1000px #fff inset;
}

/* 라디오 그룹 */
.radio-group {
  display: flex;
  gap: 14px;
  align-items: center;
  padding-top: 2px;
  flex-wrap: wrap;
}
.radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.radio input[type='radio'] {
  width: 18px;
  height: 14px;
  accent-color: #3b82f6;
}
.radio span {
  font-size: 14px;
  line-height: 1.25;
  color: #fcfafa;
}

/* 지역 인라인 레이아웃 */
.region-row {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: end;
  margin-top: 2px;
}
.region-row .col {
  flex: 1 1 0;
  min-width: 0;
}

/* 버튼 열 */
.button-col {
  display: grid;
  row-gap: 4px;
  margin-top: 0px;
}

/* 버튼 */
.btn {
  height: 44px;
  border-radius: 10px;
  text-align: center;
  font-weight: 700;
  font-size: 12px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dcdcdc;
  background: #fff;
  color: #111;
  transition: background 0.2s, transform 0.08s ease-out, opacity 0.2s;
  will-change: transform;
}
.btn:active {
  transform: translateY(1px);
}

/* 주버튼 */
.btn.primary {
  background: #3b82f6;
  color: #fff;
  border-color: #2e6bd1;
}
.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 고스트 버튼 */
.btn.ghost {
  background: #fff;
  color: #111;
  border-color: #dcdcdc;
}

/* 힌트/메시지 */
.hint {
  margin: 2px 2px 0;
  font-size: 10px;
  line-height: 1.4;
}
.hint.error {
  color: #c0392b;
}
.hint.success {
  color: #2d7a33;
}

/* 폼 전체를 뷰포트에 맞춰 수직 압축 */
.onepage .form {
  max-height: calc(100vh - 56px - 8px);
  overflow: hidden;
}

/* 초소형 높이 대응 */
@media (max-height: 640px) {
  .onepage {
    transform: scale(0.98);
    transform-origin: top center;
  }
}

/* 초소형 너비 대응 */
@media (max-width: 320px) {
  .container {
    padding-left: 2px;
    padding-right: 2px;
  }
  .form.compact {
    row-gap: 6px;
  }
  .form-row {
    row-gap: 5px;
  }
}
</style>
