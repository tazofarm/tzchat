<template>
  <div class="login-container">
    <div class="login-box">
      <!-- 뒤로가기 버튼 -->
      <IonButtons>
        <IonButton class="back-btn" @click="goBack">← 뒤로가기</IonButton>
      </IonButtons>

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
 * - 인터셉터 영향(자동 리다이렉트 등) 없이 /api/me를 '프로브'로 검증
 * - 로그인 응답에서 JWT 토큰 키를 광범위하게 탐색하여 저장(쿠키에 의존X)
 * - 성공/실패를 명확히 메시지로 안내
 */
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api, { auth as AuthAPI, getAgreementStatus, setAuthToken } from '@/lib/api'
import { connectSocket, reconnectSocket, getSocket } from '@/lib/socket'
import { IonButtons, IonButton } from '@ionic/vue'

const router = useRouter()
const route = useRoute()

// 사용자 입력값
const username = ref<string>('') 
const password = ref<string>('') 
const message = ref<string>('') 
const submitting = ref<boolean>(false) 

function redirectTarget() {
  return (typeof route.query.redirect === 'string' && route.query.redirect)
    ? String(route.query.redirect)
    : '/home/6page'
}
function redirectAfterLogin() {
  router.push(redirectTarget())
}

/** 뒤로가기 동작 */
const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/home/6page') // 히스토리 없을 때 폴백
}

// ===== 진단: 실제 baseURL 로그 =====
function debugBaseURL() {
  try {
    const base = api?.defaults?.baseURL || '(unknown)'
    const mode = (import.meta as any)?.env?.MODE || '(unknown)'
    const viteMode = (import.meta as any)?.env?.VITE_MODE || '(unknown)'
    const apiEnv = (import.meta as any)?.env?.VITE_API_BASE_URL
    const wsEnv  = (import.meta as any)?.env?.VITE_WS_BASE
    console.log('[HTTP][CFG][FINAL]', { mode, viteMode, baseURL_from_instance: base, VITE_API_BASE_URL: apiEnv, VITE_WS_BASE: wsEnv })
  } catch (e: any) {
    console.log('[HTTP][CFG][ERR] debugBaseURL', { message: e?.message })
  }
}

/** axios 인터셉터 영향을 피해서 /api/me 상태를 확인하는 프로브 */
async function meProbe(): Promise<{ ok: boolean; data?: any; status: number; reason?: string }> {
  const base = (api?.defaults?.baseURL || '').replace(/\/+$/, '')
  const url = `${base}/api/me`
  try {
    // 토큰이 있으면 Authorization 추가, 없으면 쿠키만으로 시도
    const token = (() => {
      try { return localStorage.getItem('TZCHAT_AUTH_TOKEN') } catch { return null }
    })()
    const headers: Record<string, string> = { 'Accept': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
    })
    const status = res.status
    let data: any = null
    try { data = await res.json() } catch { /* ignore */ }

    if (status >= 200 && status < 300) {
      return { ok: true, data, status }
    }
    return { ok: false, data, status, reason: data?.message || data?.error || `HTTP ${status}` }
  } catch (e: any) {
    return { ok: false, status: 0, reason: e?.message || 'network error' }
  }
}

// 진입 시 세션/JWT 확인(401이면 정상 흐름) — 인터셉터 미사용 프로브
onMounted(async () => {
  debugBaseURL()
  const probe = await meProbe()
  if (probe.ok) {
    console.log('[UI][RES] already signed-in', { user: probe.data?.user?.username })
    await checkPendingAgreementsOrRedirect()
  } else {
    console.log('[UI][INFO] not signed-in (probe)', probe)
  }
})

/** 로그인 함수 */
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
    // ▲ 주의: 일부 서버는 쿠키만 내려주고 토큰을 바디에 안 줄 수 있음
    // 토큰을 다양한 키에서 최대한 찾아서 저장 (쿠키 의존 최소화)
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

    // 소켓 인증 반영(실패해도 로그인 흐름은 계속)
    try {
      const s = getSocket()
      if (s && s.connected) reconnectSocket()
      else connectSocket()
    } catch (sockErr: any) {
      console.log('[SOCKET][ERR] connect/reconnect', { message: sockErr?.message })
    }

    // 로그인 직후 /api/me 재검증 — 인터셉터 미사용 프로브
    const probe = await meProbe()
    if (!probe.ok) {
      // 여기서 막히면, 쿠키 미전송/토큰 미발급/탈퇴차단 가능성 중 하나
      message.value =
        probe.status === 401
          ? '로그인 정보 확인 실패(401). 개발환경에서는 쿠키/토큰 정책 영향일 수 있어요. 다시 시도해주세요.'
          : `로그인 확인 실패: ${probe.reason || probe.status}`
      return
    }
    console.log('[UI][RES] /me after login', { user: probe.data?.user?.username })
    message.value = (res?.data as any)?.message || (res?.data as any)?.msg || '로그인 되었습니다.'

    // ✅ 재동의 필요 여부 확인 → 전용 동의 페이지 or 목적지
    await checkPendingAgreementsOrRedirect()
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

/** 활성 필수 동의(pending) 있으면 전용 페이지로 라우팅, 없으면 목적지로 이동 */
async function checkPendingAgreementsOrRedirect() {
  try {
    const resp: any = await getAgreementStatus()
    const pending: any[] =
      resp?.data?.pending ??
      resp?.pending ??
      resp?.data?.data?.pending ?? // 혹시 모를 케이스 대비
      []

    if (Array.isArray(pending) && pending.length > 0) {
      // router/index.ts 기준: AgreementPagePublic
      router.push({ name: 'AgreementPagePublic', query: { return: redirectTarget() } })
    } else {
      redirectAfterLogin()
    }
  } catch (e: any) {
    console.log('[UI][ERR] getAgreementStatus', { msg: e?.message, data: e?.response?.data })
    // 문제가 있어도 사용자 흐름 막지 않도록 목적지로 이동
    redirectAfterLogin()
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
