<template>
  <div class="login-container">
    <div class="login-box">
      <br /><br />
      <h1>Yes? Yes!</h1>
      <h2>네네챗</h2>
      <br /><br />

      <!-- 로그인 폼 -->
      <form @submit.prevent="login" class="login-form" autocomplete="on">

        <button
          type="button"
          :disabled="submitting"
          @click="goLoginauto"
        >
          {{ submitting ? '로그인 중...' : 'Tester 자동로그인' }}
        </button>
<br><br>

        <button
          type="button"
          :disabled="submitting"
          @click="goLoginmain"
        >
          {{ submitting ? '로그인 중...' : '로그인' }}
        </button>




        <br><br>

        <button
          type="button"
          :disabled="submitting"
          @click="goLoginTester"
        >
          {{ submitting ? '로그인 중...' : 'Tester 전용로그인' }}

        </button>




        
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * LoginPage.vue
 * - 이미 로그인인 경우에도 약관 동의 상태를 확인하여 /consents로 라우팅
 * - 로그인 직후에도 동일 로직 재사용
 */
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api, { auth as AuthAPI } from '@/lib/api'
import { connectSocket, reconnectSocket, getSocket } from '@/lib/socket'

const router = useRouter()
const route = useRoute()
const submitting = ref(false)

// ✅ 공통: 동의 상태 확인 후 목적지 결정
async function redirectConsideringConsent(defaultRedirect = '/home/6page') {
  try {
    const { data } = await api.get('/api/terms/agreements/status') // { ok, data: { pending, items } }
    const pending = data?.data?.pending || []
    const pendingRequired = pending.filter((p: any) => p?.isRequired)

    if (pendingRequired.length > 0) {
      // 필수 동의가 남아있으면 /consents로 이동
      const redirectTo =
        (typeof route.query.redirect === 'string' && route.query.redirect) || defaultRedirect
      router.replace({ path: '/consents', query: { redirect: redirectTo } })
    } else {
      // 없으면 원래 목적지로
      const redirectTo =
        (typeof route.query.redirect === 'string' && route.query.redirect) || defaultRedirect
      router.replace(redirectTo)
    }
  } catch (e: any) {
    // 상태 조회 실패 시에는 기존 플로우로 진행
    const redirectTo =
      (typeof route.query.redirect === 'string' && route.query.redirect) || defaultRedirect
    router.replace(redirectTo)
  }
}
function goLoginauto() {
  if (submitting.value) return
  router.push('/loginauto')
}
function goLoginmain() {
  if (submitting.value) return
  router.push('/loginmain')
}
function goLoginTester() {
  if (submitting.value) return
  router.push('/logintester')
}

// 진입 시 세션/JWT 확인 → 이미 로그인 상태라면 동의 상태 체크 뒤 라우팅
onMounted(async () => {
  try {
    await api.get('/api/me')
    // ✅ 이미 로그인 → 동의 상태 확인 후 라우팅
    await redirectConsideringConsent('/home/6page')
  } catch (e: any) {
    if (e?.response?.status === 401) {
      // 미로그인 → 로그인 진행 가능
      // (화면 유지만, 추가 동작 없음)
    } else {
      console.log('[UI][ERR] /me precheck error', {
        code: e?.code,
        status: e?.response?.status,
        msg: e?.message
      })
    }
  }
})

// (선택) 사용자/비밀번호 입력 방식 로그인 지원 시 사용할 수 있는 함수
const username = ref<string>('')  // 현재 화면에는 입력 UI 없음
const password = ref<string>('')  // 현재 화면에는 입력 UI 없음
const message  = ref<string>('')

const login = async () => {
  if (submitting.value) return
  submitting.value = true
  message.value = ''

  try {
    const id = (username.value || '').trim()
    const pw = password.value
    if (!id || !pw) {
      message.value = '아이디와 비밀번호를 입력하세요.'
      return
    }

    // 로그인 요청
    const res = await AuthAPI.login({ username: id, password: pw })
    password.value = ''

    // 소켓 인증 반영
    try {
      const s = getSocket()
      if (s && s.connected) reconnectSocket()
      else connectSocket()
    } catch {}

    // /me 재검증
    await api.get('/api/me')

    // ✅ 로그인 직후에도 동의 상태 확인 → 라우팅
    await redirectConsideringConsent('/home/6page')
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 401) {
      message.value = err.response?.data?.message || '아이디/비밀번호를 확인해주세요.'
    } else if (status === 400) {
      message.value = err.response?.data?.message || '요청 형식이 올바르지 않습니다.'
    } else if (status === 429) {
      message.value = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
    } else {
      message.value = '로그인 실패: 네트워크/서버 오류'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* (기존 스타일 유지) */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100dvh;
  padding: clamp(12px, 3vw, 20px);
  padding-top: calc(env(safe-area-inset-top, 0px) + clamp(12px, 3vw, 20px));
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(12px, 3vw, 20px));
  padding-left: calc(env(safe-area-inset-left, 0px) + clamp(12px, 3vw, 20px));
  padding-right: calc(env(safe-area-inset-right, 0px) + clamp(12px, 3vw, 20px));
  background: #f4f6f9;
  color: #111;
  overscroll-behavior: contain;
}
.login-box {
  width: min(100%, 420px);
  background: #141414;
  color: #fff;
  padding: clamp(16px, 4.5vw, 28px);
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  text-align: center;
}
.login-box h2 {
  margin: 0 0 clamp(8px, 2vw, 12px) 0;
  font-size: clamp(18px, 4.5vw, 24px);
  line-height: 1.25;
  color: #ffffff;
}
.login-box h2:last-of-type { margin-bottom: clamp(14px, 3vw, 18px); }
.login-form { display: flex; flex-direction: column; gap: clamp(12px, 3vw, 16px); }
.form-group { display: flex; flex-direction: column; align-items: stretch; }
.login-box label {
  margin-bottom: 8px;
  font-size: clamp(16px, 2.8vw, 17px);
  font-weight: 600;
  letter-spacing: 0.1px;
  color: #ffffff;
}
.login-box input {
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #cfcfcf;
  font-size: 16px;
  background: #ffffff;
  color: #111;
  outline: none;
  transition: box-shadow .15s, border-color .15s;
  accent-color: #3498db;
}
.login-box input::placeholder { color: #8d8d8d; }
.login-box input:-webkit-autofill,
.login-box input:-webkit-autofill:hover,
.login-box input:-webkit-autofill:focus {
  -webkit-text-fill-color: #111;
  transition: background-color 5000s;
  box-shadow: 0 0 0px 1000px #fff inset;
}
.login-box input:focus-visible {
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52,152,219,0.25);
  border-radius: 12px;
}
.login-box button {
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  background: #3498db;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s, transform .08s ease-out, opacity .2s;
  will-change: transform;
}
.login-box button:hover { background: #2980b9; }
.login-box button:active { transform: translateY(1px); }
.login-box button:disabled { opacity: 0.6; cursor: not-allowed; }
.error {
  color: #ff5252;
  margin-top: 10px;
  font-size: clamp(15px, 2.6vw, 16px);
  line-height: 1.45;
  word-break: break-word;
}
.link-container {
  margin-top: clamp(16px, 3.5vw, 22px);
  font-size: clamp(15px, 2.6vw, 16px);
  line-height: 1.45;
  color: #ffffff;
  word-break: break-word;
}
.link-container a { color: #7dc3ff; text-decoration: none; }
.link-container a:hover { text-decoration: underline; }
.link-container a:focus-visible {
  outline: 2px solid rgba(125,195,255,0.7);
  outline-offset: 2px;
  border-radius: 6px;
}
* { scrollbar-width: thin; scrollbar-color: #bbb transparent; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }
@media (max-width: 320px) {
  .login-container { padding: 8px; }
  .login-box { padding: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
</style>
