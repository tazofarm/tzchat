<!-- src/views/SignupPage.vue -->
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

          <!-- PASS 결과 배너 -->
          <div class="pass-banner" :class="passBannerClass">
            <div class="pass-row">
              <div class="dot" :class="passDotClass"></div>
              <div class="pass-text">
                <div class="pass-title">
                  {{ passStatusLabel }}
                </div>
                <div class="pass-brief" v-if="passBrief">
                  {{ passBrief }}
                </div>
                <div class="pass-brief error" v-else-if="passError">
                  {{ passError }}
                </div>
              </div>
            </div>
          </div>

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

          <!-- 출생년도/성별: PASS 결과로 자동 채움 (입력 UI 제거) -->
          <div class="form-row readonly-info" v-if="passSuccess">
            <label>출생년도 · 성별</label>
            <div class="ro-box">{{ readonlyBirthGender }}</div>
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
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { api, auth as AuthAPI } from '@/lib/api'
import { regions } from '@/data/regions'
import { connectSocket, reconnectSocket, getSocket } from '@/lib/socket'

const router = useRouter()
const route = useRoute()

// ✅ PASS 보조 유틸: 스토리지 키 정리
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

// ✅ PASS txId: 쿼리 'txId' 우선, 없으면 'passTxId', 없으면 세션스토리지 폴백
function readInitialTxId(): string {
  const q1 = typeof route.query.txId === 'string' ? route.query.txId : ''
  const q2 = typeof route.query.passTxId === 'string' ? route.query.passTxId : ''
  if (q1 || q2) return q1 || q2

  // 라우터가 쿼리를 잃어버린 경우를 대비해 실제 URL 파싱
  try {
    const sp = new URLSearchParams(window.location.search)
    const s1 = sp.get('txId') || ''
    const s2 = sp.get('passTxId') || ''
    if (s1 || s2) return s1 || s2
  } catch {}

  const s = sessionStorage.getItem('passTxId') || ''
  if (s) return s

  // 팝업 폴백
  const l = localStorage.getItem('PASS_RESULT_TX') || ''
  return l
}

const txId = ref(readInitialTxId())

const loadingPass = ref(false)
const passStatus = ref<'none'|'pending'|'success'|'fail'>(txId.value ? 'pending' : 'none')
const passError = ref('')
const passResult = ref<{ birthyear?: number; gender?: 'man'|'woman'|''; phone?: string; carrier?: string } | null>(null)

const passSuccess = computed(() => passStatus.value === 'success')
const passStatusLabel = computed(() => {
  if (!txId.value) return 'PASS 미사용'
  if (passStatus.value === 'pending') return 'PASS 인증 확인 중…'
  if (passStatus.value === 'success') return 'PASS 인증 완료'
  if (passStatus.value === 'fail') return 'PASS 인증 실패'
  return 'PASS 미사용'
})
const passBrief = computed(() => {
  if (!passSuccess.value || !passResult.value) return ''
  const y = passResult.value.birthyear ? `${passResult.value.birthyear}년생` : ''
  const g = passResult.value.gender === 'man' ? '남' : (passResult.value.gender === 'woman' ? '여' : '')
  const p = passResult.value.phone ? passResult.value.phone : ''
  return [y, g, p].filter(Boolean).join(' · ')
})
const passBannerClass = computed(() => ({
  ok: passSuccess.value,
  fail: passStatus.value === 'fail',
  pending: passStatus.value === 'pending'
}))
const passDotClass = computed(() => ({
  ok: passSuccess.value,
  fail: passStatus.value === 'fail',
  pending: passStatus.value === 'pending'
}))
const readonlyBirthGender = computed(() => {
  if (!passResult.value) return ''
  const y = passResult.value.birthyear ? `${passResult.value.birthyear}년생` : '출생년도 없음'
  const g = passResult.value.gender === 'man' ? '남' : (passResult.value.gender === 'woman' ? '여' : '성별 없음')
  return `${y} · ${g}`
})

const form = ref({
  username: '',
  password: '',
  password2: '',
  nickname: '',
  region1: '' as string,
  region2: '' as string,
})

const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

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
    !!txId.value &&
    passSuccess.value &&
    !!form.value.username &&
    !!form.value.password &&
    !!form.value.password2 &&
    !passwordMismatch.value &&
    !!form.value.nickname &&
    !!form.value.region1 &&
    !!form.value.region2
)

// 로그인 후 이동 목적지
function resolveReturn() {
  return (typeof route.query.redirect === 'string' && route.query.redirect) ? (route.query.redirect as string) : '/home/6page'
}
function redirectAfterLogin() {
  clearPassKeys()
  router.replace(resolveReturn())
}

// PASS 상태 조회
async function fetchPassStatus() {
  if (!txId.value) {
    passStatus.value = 'none'
    passResult.value = null
    return
  }
  loadingPass.value = true
  passError.value = ''
  passStatus.value = 'pending'
  try {
    const res = await api.get(`/api/auth/pass/status`, {
      params: { txId: txId.value },
      withCredentials: true, // ✅ 쿠키(세션/보안쿠키) 동반
    })

    const j = res.data
    if (!j?.ok) throw new Error('PASS 상태 조회 실패')

    if (j.status === 'success') {
      passStatus.value = 'success'
      passResult.value = {
        birthyear: j?.result?.birthyear ?? null,
        gender: j?.result?.gender ?? '',
        phone: j?.result?.phone ?? '',
        carrier: j?.result?.carrier ?? ''
      }
      // 필요 시 txId 보존
      try { sessionStorage.setItem('passTxId', txId.value) } catch {}
    } else if (j.status === 'fail') {
      passStatus.value = 'fail'
      passResult.value = null
      passError.value = (j?.result && j.result.failCode) ? `실패코드: ${j.result.failCode}` : '인증 실패'
    } else if (j.status === 'consumed') {
      // ⬅️ 서버가 이미 소모된 PASS 토큰으로 응답
      passStatus.value = 'fail'
      passResult.value = null
      passError.value = '이미 사용된 PASS 토큰입니다. 다시 인증해 주세요.'
      clearPassKeys()
    } else {
      passStatus.value = 'pending'
      passResult.value = null
    }
  } catch (e: any) {
    passStatus.value = 'fail'
    passResult.value = null
    passError.value = e?.message || 'PASS 상태 조회 에러'
  } finally {
    loadingPass.value = false
  }
}
async function refetchPass() {
  await fetchPassStatus()
}

// 자동: 페이지 로드시 PASS 결과 확인
onMounted(async () => {
  // URL → 세션스토리지 → 로컬스토리지 순으로 재확인
  if (!txId.value) {
    try {
      const sp = new URLSearchParams(window.location.search)
      const u1 = sp.get('txId') || sp.get('passTxId') || ''
      if (u1) txId.value = u1
    } catch {}
  }
  if (!txId.value) {
    const s = sessionStorage.getItem('passTxId') || ''
    if (s) txId.value = s
  }
  if (!txId.value) {
    const l = localStorage.getItem('PASS_RESULT_TX') || ''
    if (l) txId.value = l
  }
  if (txId.value) {
    try { sessionStorage.setItem('passTxId', txId.value) } catch {}
  }
  await fetchPassStatus()
})

// 라우터가 나중에 쿼리를 채워주는 상황 대응
watch(() => route.query, () => {
  const next = readInitialTxId()
  if (next && next !== txId.value) {
    txId.value = next
    fetchPassStatus()
  }
}, { deep: true })

// 제출
async function onSubmit() {
  if (!isValid.value) return
  submitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const payload: any = {
    username: form.value.username,
    password: form.value.password,
    nickname: form.value.nickname,
    region1: form.value.region1,
    region2: form.value.region2,
    // 서버는 passTxId로 최종 검증/반영
    passTxId: txId.value,
    // 참고용 프리필(서버에서는 passTxId 기준으로만 확정 저장 권장)
    birthyear: passResult.value?.birthyear ?? null,
    gender: passResult.value?.gender ?? '',
    phone: passResult.value?.phone ?? '',
    carrier: passResult.value?.carrier ?? '',
  }

  try {
    // 1) 회원가입
    const res = await api.post('/api/signup', payload)
    successMsg.value = '회원가입이 완료되었습니다.'

    // ✅ 회원가입 성공 직후, PASS 관련 스토리지 즉시 정리
    clearPassKeys()

    // 2) 자동 로그인
    try {
      await AuthAPI.login({
        username: form.value.username,
        password: form.value.password,
      })

      // 3) 소켓 인증 반영
      try {
        const s = getSocket()
        if (s && s.connected) reconnectSocket()
        else connectSocket()
      } catch (sockErr: any) {
        console.log('[SOCKET][ERR] connect/reconnect', { message: sockErr?.message })
      }

      // 4) 세션/JWT 확인(선택)
      try { await api.get('/api/me') } catch {}

      // 5) 약관 미동의 분기
      try {
        const status = await api.get('/api/terms/agreements/status')
        const pending = status?.data?.data?.pending || []
        if (Array.isArray(pending) && pending.length > 0) {
          // 이동 전에도 한 번 더 정리(안전)
          clearPassKeys()
          router.replace({ name: 'AgreementPagePublic', query: { return: resolveReturn() } })
        } else {
          redirectAfterLogin()
        }
      } catch {
        redirectAfterLogin()
      }
    } catch (loginErr: any) {
      console.error('❌ [Auto-Login] failed:', loginErr?.response || loginErr)
      clearPassKeys()
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
ion-toolbar { --min-height: 44px; --padding-top: 0px; --padding-bottom: 0px; }
ion-title { font-size: 16px; font-weight: 600; color: #fcfafa; }
.container.onepage { width: min(640px, 92vw); margin: 4px auto 0; padding: 16px 4px 0; color: #111; max-height: calc(100vh - 56px - 8px); display: flex; align-items: flex-start; }
:host { display: block; }
.form.compact { display: grid; grid-auto-rows: min-content; row-gap: 18px; width: 100%; }
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
.btn.ghost.sm { height: 32px; font-size: 11px; padding: 0 10px; }

.hint { margin: 2px 2px 0; font-size: 10px; line-height: 1.4; }
.hint.error { color: #c0392b; }
.hint.success { color: #2d7a33; }
.onepage .form { max-height: calc(100vh - 56px - 8px); overflow: hidden; }
@media (max-height: 640px) { .onepage { transform: scale(0.98); transform-origin: top center; } }
@media (max-width: 320px) { .container { padding-left: 2px; padding-right: 2px; } .form.compact { row-gap: 6px; } .form-row { row-gap: 5px; } }

/* PASS 배너 */
.pass-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid #dcdcdc;
  background: #fff;
}
.pass-banner.pending { border-color: #ffd26a; }
.pass-banner.ok { border-color: #4caf50; }
.pass-banner.fail { border-color: #e74c3c; }
.pass-row { display: flex; align-items: center; gap: 10px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #999; }
.dot.ok { background: #4caf50; }
.dot.fail { background: #e74c3c; }
.dot.pending { background: #ffd26a; }
.pass-title { font-weight: 700; font-size: 12px; color: #111; }
.pass-brief { font-size: 10px; color: #555; margin-top: 2px; }
.pass-brief.error { color: #c0392b; }
.pass-actions { display: flex; gap: 6px; }

/* 읽기전용 표시 박스 */
.readonly-info .ro-box {
  font-size: 12px;
  background: #f8f8f8;
  border: 1px solid #e6e6e6;
  color: #333;
  padding: 6px 10px;
  border-radius: 8px;
}
</style>
