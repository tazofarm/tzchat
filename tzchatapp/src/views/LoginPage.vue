<template>
  <div class="login-container">
    <div class="login-box">
      <br /><br />
      <h1>Between</h1>
      <br /><br />

      <h2>로그인</h2>
      <br />

      <!-- 로그인 폼 -->
      <form @submit.prevent="login" class="login-form" autocomplete="on">
        <!-- 아이디 입력 -->
        <div class="form-group">
          <label for="login-username">아이디</label>
          <input
            id="login-username"
            name="username"
            type="text"
            placeholder="아이디"
            v-model="username"
            autocomplete="username"
            required
          />
        </div>

        <!-- 비밀번호 입력 -->
        <div class="form-group">
          <label for="login-password">비밀번호</label>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="비밀번호"
            v-model="password"
            autocomplete="current-password"
            required
          />
        </div>

        <!-- 로그인 버튼 -->
        <button type="submit" :disabled="submitting">
          {{ submitting ? '로그인 중...' : '로그인' }}
        </button>
      </form>

      <!-- 에러/안내 메시지 -->
      <p class="error" v-if="message">{{ message }}</p>

      <!-- 회원가입 링크 
      <div class="link-container">
        <p>계정이 없으신가요? <router-link to="/pass">회원가입</router-link></p>
      </div>

      비밀번호 모를때, Pass 로그인
      <div class="link-container">
        <p>비밀번호를 잊으셨나요 ? <router-link to="/pass">임시로그인</router-link></p>
      </div>
-->

    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * LoginPage.vue
 * ✅ 자동 로그인(토큰 기반 즉시 진입/백그라운드 검증)은 router 가드에서만 처리
 * - LoginPage에서는 중복 /api/me 호출을 하지 않음 (체감 지연/깜빡임 제거)
 * - 토큰이 있으면 "즉시" 목적지로 이동만 시킴 (검증/동의/탈퇴는 가드가 처리)
 */
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth as AuthAPI, setAuthToken } from '@/lib/api'
import { connectSocket, reconnectSocket, getSocket } from '@/lib/socket'

const router = useRouter()
const route = useRoute()

// 사용자 입력값
const username = ref<string>('')
const password = ref<string>('')
const message = ref<string>('')
const submitting = ref<boolean>(false)

// ✅ PASS 보조 유틸: 스토리지 키 정리(남은 txId로 잘못 분기되는 현상 예방)
function clearPassKeys() {
  try {
    sessionStorage.removeItem('passTxId')
    sessionStorage.removeItem('pass.intent')
  } catch {}
  try {
    localStorage.removeItem('PASS_RESULT_TX')
    localStorage.removeItem('PASS_FAIL')
    localStorage.removeItem('PASS_FAIL_DETAIL')
  } catch {}
}

function redirectTarget() {
  return (typeof route.query.redirect === 'string' && route.query.redirect)
    ? String(route.query.redirect)
    : '/home/6page'
}

onMounted(() => {
  clearPassKeys()

  // ✅ 토큰이 있으면 로그인 화면에서 멈추지 말고 즉시 이동
  //    (실제 유효성 검증/동의/탈퇴 체크는 router 가드가 백그라운드로 처리)
  let token: string | null = null
  try { token = localStorage.getItem('TZCHAT_AUTH_TOKEN') } catch { token = null }

  if (token && token.trim()) {
    try { setAuthToken(token.trim()) } catch {}
    router.replace(redirectTarget())
  }
})

/** 로그인 함수 */
const login = async () => {
  if (submitting.value) return
  submitting.value = true
  message.value = ''

  clearPassKeys()

  try {
    const id = (username.value || '').trim()
    const pw = password.value
    if (!id || !pw) {
      message.value = '아이디와 비밀번호를 입력하세요.'
      return
    }

    const res = await AuthAPI.login({ username: id, password: pw })

    // 일부 서버는 token 키가 다를 수 있으니 후보 처리
    const body: any = res?.data ?? {}
    const tokenCandidates = [
      body?.token,
      body?.data?.token,
      body?.accessToken,
      body?.jwt,
      body?.data?.accessToken,
    ].filter(Boolean)

    if (tokenCandidates.length > 0) {
      try { setAuthToken(String(tokenCandidates[0])) } catch {}
    }

    password.value = ''

    // ✅ 성공 즉시 이동 (가드가 필요한 체크는 알아서 처리)
    router.replace(redirectTarget())

    // ✅ 소켓은 UX를 막지 않게 "백그라운드"로 시도
    setTimeout(() => {
      try {
        const s = getSocket()
        if (s && s.connected) reconnectSocket()
        else connectSocket()
      } catch (sockErr: any) {
        console.log('[SOCKET][ERR] connect/reconnect', { message: sockErr?.message })
      }
    }, 0)
  } catch (err: any) {
    console.error('[HTTP][ERR] /login', {
      status: err?.response?.status,
      data: err?.response?.data,
      msg: err?.message,
    })
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
