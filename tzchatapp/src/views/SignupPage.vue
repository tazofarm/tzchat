<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>회원가입</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" :scroll-y="false">
      <div class="container onepage">
        <form class="form compact" @submit.prevent="onSubmit" autocomplete="on" novalidate>
          <!-- 기본 정보 -->
          <div class="form-row">
            <label for="username">아이디</label>
            <input id="username" name="username" type="text" v-model.trim="form.username"
                   placeholder="아이디" autocomplete="username" required />
          </div>
          <div class="form-row">
            <label for="password">비밀번호</label>
            <input id="password" name="password" type="password" v-model="form.password"
                   placeholder="비밀번호" autocomplete="new-password" required />
          </div>
          <div class="form-row">
            <label for="password2">비밀번호 확인</label>
            <input id="password2" name="password2" type="password" v-model="form.password2"
                   placeholder="비밀번호 확인" autocomplete="new-password" required />
            <p v-if="passwordMismatch" class="hint error">⚠ 비밀번호가 일치하지 않습니다.</p>
          </div>
          <div class="form-row">
            <label for="nickname">닉네임</label>
            <input id="nickname" name="nickname" type="text" v-model.trim="form.nickname"
                   placeholder="닉네임" required />
          </div>
          <div class="form-row">
            <label for="birthyear">출생년도</label>
            <select id="birthyear" name="birthyear" v-model="form.birthyear" required>
              <option value="" disabled>출생년도를 선택하세요</option>
              <option v-for="y in birthyearOptions" :key="y" :value="y">{{ y }}년</option>
            </select>
          </div>
          <div class="form-row">
            <label>지역</label>
            <div class="region-row">
              <div class="col">
                <select id="region1" name="region1" v-model="form.region1" required>
                  <option value="" disabled>지역1을 선택하세요</option>
                  <option v-for="r1 in region1Options" :key="r1" :value="r1">{{ r1 }}</option>
                </select>
              </div>
              <div class="col">
                <select id="region2" name="region2" v-model="form.region2" :disabled="!form.region1" required>
                  <option value="" disabled>지역2를 선택하세요</option>
                  <option v-for="r2 in region2Options" :key="r2" :value="r2">{{ r2 }}</option>
                </select>
              </div>
            </div>
            <p v-if="!form.region1" class="hint">먼저 지역1을 선택하세요.</p>
          </div>
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

          <!-- 약관 동의 UI 제거 (로그인 후 별도 페이지에서 처리) -->

          <div class="button-col">
            <button type="submit" class="btn primary" :disabled="submitting || !isValid">
              {{ submitting ? '처리 중…' : '회원가입' }}
            </button>
            <router-link to="/login" class="btn ghost">로그인으로</router-link>
          </div>

          <p v-if="errorMsg" class="hint error">{{ errorMsg }}</p>
          <p v-if="successMsg" class="hint success">{{ successMsg }}</p>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { api, auth as AuthAPI } from '@/lib/api'
import { regions } from '@/data/regions'
import { connectSocket, reconnectSocket, getSocket } from '@/lib/socket'

const router = useRouter()
const route = useRoute()

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

// 출생년도
const adultYear = new Date().getFullYear() - 19
const birthyearOptions = Array.from({ length: adultYear - 1950 + 1 }, (_, i) => adultYear - i)

// 지역 옵션
const region1Options = computed<string[]>(() => { try { return Object.keys(regions || {}) } catch { return [] } })
const region2Options = computed<string[]>(() => {
  if (!form.value.region1) return []
  const raw = Array.isArray((regions as any)[form.value.region1]) ? (regions as any)[form.value.region1] : []
  return raw
})
watch(() => form.value.region1, () => { form.value.region2 = '' })

// 유효성
const passwordMismatch = computed(
  () => form.value.password !== '' && form.value.password2 !== '' && form.value.password !== form.value.password2
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
    !!form.value.region2
)

// 로그인 후 이동 목적지
function resolveReturn() {
  return (typeof route.query.redirect === 'string' && route.query.redirect) ? (route.query.redirect as string) : '/home/6page'
}
function redirectAfterLogin() {
  router.replace(resolveReturn())
}

// 제출
async function onSubmit() {
  if (!isValid.value) return
  submitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const payload = {
    username: form.value.username,
    password: form.value.password,
    nickname: form.value.nickname,
    gender: form.value.gender,
    birthyear: form.value.birthyear,
    region1: form.value.region1,
    region2: form.value.region2,
    // ⚠️ consents 제거: 로그인 후 별도 동의 플로우에서 진행
  }

  try {
    // 1) 회원가입
    const res = await api.post('/api/signup', payload)
    console.log('✅ [Signup] OK:', res.status)
    successMsg.value = '회원가입이 완료되었습니다.'

    // 2) 자동 로그인
    try {
      const loginRes = await AuthAPI.login({
        username: form.value.username,
        password: form.value.password,
      })
      console.log('✅ [Signup→Login] OK', loginRes?.status)

      // 3) 소켓 인증 반영
      try {
        const s = getSocket()
        if (s && s.connected) reconnectSocket()
        else connectSocket()
      } catch (sockErr: any) {
        console.log('[SOCKET][ERR] connect/reconnect', { message: sockErr?.message })
      }

      // 4) 서버 세션/JWT 확인(선택)
      try { await api.get('/api/me') } catch {}

      // 5) ✅ 동의 상태 확인 후 라우팅
      try {
        const status = await api.get('/api/terms/agreements/status') // { ok, data: { pending, items } }
        const pending = status?.data?.data?.pending || []
        if (Array.isArray(pending) && pending.length > 0) {
          // 약관 미동의 → AgreementPage로
          router.replace({ path: '/agreement', query: { return: resolveReturn() } })
        } else {
          // 모두 동의 또는 동의 필요 없음 → 원래 목적지
          redirectAfterLogin()
        }
      } catch {
        // 상태 조회 실패 시 기본 목적지로
        redirectAfterLogin()
      }
    } catch (loginErr: any) {
      console.error('❌ [Auto-Login] failed:', loginErr?.response || loginErr)
      router.push('/login')
    }
  } catch (err: any) {
    console.error('❌ [Signup] API Error:', err?.response || err)
    errorMsg.value = err?.response?.data?.message || '회원가입 실패'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* 기존 스타일 유지 */
ion-toolbar { --min-height: 44px; --padding-top: 0px; --padding-bottom: 0px; }
ion-title { font-size: 16px; font-weight: 600; color: #fcfafa; }
.container.onepage { width: min(640px, 92vw); margin: 4px auto 0; padding: 6px 4px 0; color: #111; max-height: calc(100vh - 56px - 8px); display: flex; align-items: flex-start; }
:host { display: block; }
.form.compact { display: grid; grid-auto-rows: min-content; row-gap: 8px; width: 100%; }
.form-row { display: grid; row-gap: 4px; }
.form-row label, .label-inline { font-weight: 600; font-size: 12px; letter-spacing: 0.1px; color: #fcfafa; }
.form-row input[type='text'], .form-row input[type='password'], .form-row select { width: 100%; height: 20px; padding: 0 12px; border: 1px solid #d9d9d9; border-radius: 10px; outline: none; background: #fff; color: #111; font-size: 10px; transition: box-shadow .15s, border-color .15s; -webkit-appearance: none; }
.form-row input::placeholder { color: #999; }
.form-row input:focus-visible, .form-row select:focus-visible { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.22); border-radius: 10px; }
.form-row input:-webkit-autofill, .form-row input:-webkit-autofill:hover, .form-row input:-webkit-autofill:focus { -webkit-text-fill-color: #111; transition: background-color 5000s; box-shadow: 0 0 0 1000px #fff inset; }
.radio-group { display: flex; gap: 14px; align-items: center; padding-top: 2px; flex-wrap: wrap; }
.radio { display: inline-flex; align-items: center; gap: 6px; }
.radio input[type='radio'] { width: 18px; height: 14px; accent-color: #3b82f6; }
.radio span { font-size: 14px; line-height: 1.25; color: #fcfafa; }
.region-row { display: flex; gap: 8px; flex-wrap: nowrap; align-items: end; margin-top: 2px; }
.region-row .col { flex: 1 1 0; min-width: 0; }
.button-col { display: grid; row-gap: 4px; margin-top: 0px; }
.btn { height: 44px; border-radius: 10px; text-align: center; font-weight: 700; font-size: 12px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #dcdcdc; background: #fff; color: #111; transition: background .2s, transform .08s, opacity .2s; will-change: transform; }
.btn:active { transform: translateY(1px); }
.btn.primary { background: #3b82f6; color: #fff; border-color: #2e6bd1; }
.btn.primary:disabled { opacity: .6; cursor: not-allowed; }
.btn.ghost { background: #fff; color: #111; border-color: #dcdcdc; }
.hint { margin: 2px 2px 0; font-size: 10px; line-height: 1.4; }
.hint.error { color: #c0392b; }
.hint.success { color: #2d7a33; }
.onepage .form { max-height: calc(100vh - 56px - 8px); overflow: hidden; }
@media (max-height: 640px) { .onepage { transform: scale(0.98); transform-origin: top center; } }
@media (max-width: 320px) { .container { padding-left: 2px; padding-right: 2px; } .form.compact { row-gap: 6px; } .form-row { row-gap: 5px; } }
</style>
