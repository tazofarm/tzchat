<!-- src/02010_minipage/auth/LoginMainPage.vue -->
<template>
  <div class="login-wrap">
    <h1 class="title">테스터를 위한 로그인 페이지입니다.</h1>
    <h2 class="subtitle">클릭하면 자동으로 로그인 됩니다.</h2>

    <!-- 아이디/비밀번호 입력창 제거 → 버튼만 노출 -->
    <button
      class="btn tester"
      type="button"
      :disabled="submitting"
      @click="handleTesterLogin"
      aria-label="테스터 자동 로그인"
    >
      {{ submitting ? '로그인 중...' : 'tester 자동 로그인' }}
    </button>

    <!-- 옵션 · 자동실행 해제 -->
    <div class="auto-tip" v-if="autoTesterEnabled">
      다음 방문 시 자동 실행됩니다.
      <button type="button" class="link" @click="disableAutoTester">해제</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/lib/api' // ✅ 공용 axios 인스턴스 사용 (baseURL/CORS 설정 필수)

type LoginResp = {
  ok: boolean
  token?: string
  message?: string
  nickname?: string
  username?: string
}

const router = useRouter()
const submitting = ref(false)

const AUTO_KEY = 'tzchat:autoTester'
const autoTesterEnabled = ref<boolean>(false)

onMounted(async () => {
  // 이전에 자동실행을 켰다면 페이지 진입 시 자동 로그인
  autoTesterEnabled.value = localStorage.getItem(AUTO_KEY) === '1'
  if (autoTesterEnabled.value) {
    await handleTesterLogin()
  }
})

/**
 * 🔐 실제 로그인 호출
 * - 백엔드 요구 필드명: username / password
 * - 쿠키(SameSite=None; Secure)는 HTTPS에서만 실효 → 토큰 헤더도 병행 세팅
 */
async function performRealLogin(username: string, password: string) {
  api.defaults.withCredentials = true

  const { data } = await api.post<LoginResp>(
    '/api/login',
    { username, password },
    { withCredentials: true }
  )

  if (!data?.ok) {
    throw new Error(data?.message || '로그인 실패')
  }

  // ✅ 헤더 토큰 방식 병행(쿠키가 막히는 환경 대비)
  if (data.token) {
    localStorage.setItem('tzchat.jwt', data.token)
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
  }

  return data
}

/** ▶ tester 자동 로그인 (크레덴셜 노출 없이 내부 처리) */
async function handleTesterLogin() {
  if (submitting.value) return
  submitting.value = true
  try {
    // 자동실행 플래그 저장
    localStorage.setItem(AUTO_KEY, '1')
    autoTesterEnabled.value = true

    await performRealLogin('tttt', 'tttt')

    // 성공 후 홈으로 이동 (필요 시 라우트명/경로 변경)
    try {
      await router.push({ name: 'Home' })
    } catch {
      await router.push('/')
    }
  } catch (err: any) {
    console.error(err)
    alert(err?.message || '로그인에 실패했습니다.')
  } finally {
    submitting.value = false
  }
}

function disableAutoTester() {
  localStorage.removeItem(AUTO_KEY)
  autoTesterEnabled.value = false
}
</script>

<style scoped>
.login-wrap {
  max-width: 420px;
  margin: 64px auto;
  padding: 24px;
  border-radius: 16px;
  background: var(--bg, #111);
  color: var(--fg, #eee);
  box-shadow: 0 6px 24px rgba(0,0,0,0.2);
  text-align: center;
}
.title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
}
.subtitle {
  margin: 0 0 20px;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.85;
}
.btn {
  height: 48px;
  min-width: 220px;
  padding: 0 16px;
  border: 0;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn.tester {
  background: #2d2d2d;
  color: #fff;
}
.auto-tip {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.85;
}
.link {
  margin-left: 8px;
  font-size: 12px;
  text-decoration: underline;
  background: transparent;
  color: inherit;
  border: 0;
  cursor: pointer;
}
</style>
