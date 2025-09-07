<template>
  <div class="login-container">
    <div class="login-box">
      <br /><br />
      <h1>Yes? Yes!</h1>
      <h2>네네챗</h2>
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

      <!-- 회원가입 링크 -->
      <div class="link-container">
        <p>계정이 없으신가요? <router-link to="/signup">회원가입</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * LoginPage.vue
 * ------------------------------------------------------
 * - 공통 API 인스턴스만 사용(api / AuthAPI) + 경로만 전달('/login', '/me')
 * - JWT 병행: 로그인 후 쿠키/토큰 기반으로 /me 재검증
 * - 소켓 인증 갱신(refreshSocketAuth) 시도
 * - 가드의 redirect 파라미터(예: /login?redirect=/home/2page) 반영
 */
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, AuthAPI } from '@/lib/api'
import { refreshSocketAuth } from '@/lib/socket'

const router = useRouter()
const route = useRoute()

// 사용자 입력값
const username = ref<string>('')
const password = ref<string>('')
const message = ref<string>('')
const submitting = ref<boolean>(false)

// ===== 진단: 실제 baseURL 로그 =====
function debugBaseURL() {
  try {
    const base = api?.defaults?.baseURL || '(unknown)'
    const mode = (import.meta as any)?.env?.MODE || '(unknown)'
    const viteMode = (import.meta as any)?.env?.VITE_MODE || '(unknown)'
    const apiEnv = (import.meta as any)?.env?.VITE_API_BASE_URL
    const wsEnv  = (import.meta as any)?.env?.VITE_WS_BASE

    console.log('[HTTP][CFG][FINAL]', {
      mode, viteMode,
      baseURL_from_instance: base,
      VITE_API_BASE_URL: apiEnv,
      VITE_WS_BASE: wsEnv
    })
  } catch (e: any) {
    console.log('[HTTP][CFG][ERR] debugBaseURL', { message: e?.message })
  }
}

// 진입 시 세션/JWT 확인(401이면 정상 흐름)
onMounted(async () => {
  debugBaseURL()
  console.log('[UI][REQ] LoginPage mounted: /me precheck')
  try {
    const me = await api.get('/me') // 경로만 전달
    console.log('[UI][RES] already signed-in', { user: (me?.data as any)?.user?.username })
    // 이미 로그인 상태면 redirect 파라미터 우선 이동
    const redirectTo = typeof route.query.redirect === 'string' && route.query.redirect
      ? route.query.redirect
      : '/home/2page'
    router.push(redirectTo)
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 401) {
      console.log('[UI][INFO] not signed-in (401) → login allowed')
    } else {
      console.log('[UI][ERR] /me precheck error', {
        code: e?.code,
        status,
        msg: e?.message
      })
    }
  }
})

// 로그인 함수
const login = async () => {
  if (submitting.value) return
  submitting.value = true
  message.value = ''

  try {
    const id = (username.value || '').trim()
    const pw = password.value

    console.log('[UI][REQ] login submit', {
      username: id,
      pw: pw ? '(hidden)' : '(empty)'
    })

    if (!id || !pw) {
      message.value = '아이디와 비밀번호를 입력하세요.'
      return
    }

    // 로그인 요청 (서버: httpOnly 쿠키 설정 / 응답: token 포함 시 저장)
    const res = await AuthAPI.login({ username: id, password: pw })

    console.log('[HTTP][RES] /login', {
      status: res?.status,
      hasToken: !!((res?.data as any)?.token ?? (res?.data as any)?.data?.token),
      nickname: (res?.data as any)?.nickname
    })

    // 민감정보 정리
    password.value = ''

    // 소켓 인증 갱신 (JWT 병행 중이면 즉시 반영)
    try {
      refreshSocketAuth()
    } catch (sockErr: any) {
      console.log('[SOCKET][ERR] refreshSocketAuth', { message: sockErr?.message })
    }

    // 로그인 직후 /me 재검증
    try {
      const me = await api.get('/me') // 경로만 전달
      console.log('[UI][RES] /me after login', { user: (me?.data as any)?.user?.username })

      // UI 안내
      message.value = ((res?.data as any)?.message || (res?.data as any)?.msg) || '로그인 되었습니다.'

      // 가드가 넘겨준 redirect 목적지로 이동(없으면 기본)
      const redirectTo = typeof route.query.redirect === 'string' && route.query.redirect
        ? route.query.redirect
        : '/home/2page'
      router.push(redirectTo)
      return
    } catch (meErr: any) {
      console.log('[UI][ERR] /me after login failed', {
        status: meErr?.response?.status,
        data: meErr?.response?.data,
        msg: meErr?.message,
      })
      message.value = '로그인 후 세션 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'
      return
    }
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
