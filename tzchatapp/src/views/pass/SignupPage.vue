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

          <!-- ✅ PASS 읽기전용 표시: 가입 화면에서 “PASS로 받은 정보”를 무조건 보여주기 -->
          <div class="form-row readonly-info" v-if="txId && (passStatus !== 'none')">
            <label>PASS 인증 정보</label>
            <div class="ro-box">
              <div class="ro-line">
                <span class="k">txId</span>
                <span class="v mono">{{ txId }}</span>
              </div>

              <div class="ro-line" v-if="passSuccess">
                <span class="k">이름</span>
                <span class="v">{{ passResult?.name || '—' }}</span>
              </div>

              <div class="ro-line" v-if="passSuccess">
                <span class="k">출생년도 · 성별</span>
                <span class="v">{{ readonlyBirthGender || '—' }}</span>
              </div>

              <div class="ro-line" v-if="passSuccess">
                <span class="k">휴대폰</span>
                <span class="v">{{ passResult?.phone || '—' }}</span>
              </div>

              <div class="ro-line" v-if="passSuccess">
                <span class="k">통신사</span>
                <span class="v">{{ passResult?.carrier || '—' }}</span>
              </div>

              <div class="ro-line" v-if="passStatus === 'pending'">
                <span class="k">상태</span>
                <span class="v">인증 확인 중…</span>
              </div>

              <div class="ro-line" v-if="passStatus === 'fail'">
                <span class="k">상태</span>
                <span class="v" style="color:#c0392b;">실패</span>
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

          <!-- 미성년자 안내 -->
          <div class="form-row" v-if="showMinorNotice">
            <p class="hint error">미성년자는 회원가입이 불가합니다.</p>
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
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { api, auth as AuthAPI } from '@/lib/api'
import { regions } from '@/data/regions'
import { connectSocket, reconnectSocket, getSocket } from '@/lib/socket'

const router = useRouter()
const route = useRoute()

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

function pretty(obj: any) {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}
function preview(hash?: string | null) {
  if (!hash) return ''
  const s = String(hash)
  return s.length > 8 ? (s.slice(0, 8) + '…') : s
}

// ✅ gender/birthyear 정규화(PortOne/기존 PASS 혼재 대비)
type GenderNorm = 'man' | 'woman' | ''
function normalizeGender(v: any): GenderNorm {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return ''
  // 흔한 패턴들 흡수
  if (s === 'm' || s === 'male' || s === 'man' || s === '남' || s === '남자') return 'man'
  if (s === 'f' || s === 'female' || s === 'woman' || s === '여' || s === '여자') return 'woman'
  // 공급사/라이브러리에서 올 수 있는 값들 방어
  if (s.includes('male')) return 'man'
  if (s.includes('female')) return 'woman'
  return ''
}
function normalizeBirthyear(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v) && v > 1900) return v
  const s = String(v).trim()
  if (!s) return null
  // "1999-01-01" 같은 경우도 대비 → 앞 4자리만
  const y = Number(s.slice(0, 4))
  return Number.isFinite(y) && y > 1900 ? y : null
}

// ✅ PASS txId: 쿼리 'txId' 우선, 없으면 'passTxId', 없으면 세션스토리지 폴백
function readInitialTxId(): string {
  const q1 = typeof route.query.txId === 'string' ? route.query.txId : ''
  const q2 = typeof route.query.passTxId === 'string' ? route.query.passTxId : ''
  if (q1 || q2) return q1 || q2

  try {
    const sp = new URLSearchParams(window.location.search)
    const s1 = sp.get('txId') || ''
    const s2 = sp.get('passTxId') || ''
    if (s1 || s2) return s1 || s2
  } catch {}

  const s = sessionStorage.getItem('passTxId') || ''
  if (s) return s

  const l = localStorage.getItem('PASS_RESULT_TX') || ''
  return l
}

const txId = ref(readInitialTxId())

const loadingPass = ref(false)
const passStatus = ref<'none'|'pending'|'success'|'fail'>(txId.value ? 'pending' : 'none')
const passError = ref('')

type PassResultT = {
  birthyear?: number|null
  gender?: GenderNorm
  phone?: string
  carrier?: string
  name?: string
  ciHash?: string
  diHash?: string
  ciHashPreview?: string
  diHashPreview?: string
} | null

const passResult = ref<PassResultT>(null)

// 🔁 PASS 상태 폴링 (보정)
const poller = ref<ReturnType<typeof setInterval> | null>(null)
function startPolling() {
  stopPolling()
  poller.value = setInterval(() => {
    if (passStatus.value === 'pending' && txId.value) {
      fetchPassStatus()
    } else {
      stopPolling()
    }
  }, 1200)
}
function stopPolling() {
  if (poller.value) {
    clearInterval(poller.value)
    poller.value = null
  }
}

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
  const c = passResult.value.carrier ? passResult.value.carrier : ''
  const n = passResult.value.name ? passResult.value.name : ''
  // 이름은 너무 길면 앞만
  const nameShort = n ? (n.length > 10 ? n.slice(0, 10) + '…' : n) : ''
  return [nameShort, y, g, p, c].filter(Boolean).join(' · ')
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

// 미성년자 판정
const CURRENT_YEAR = new Date().getFullYear()
const ADULT_AGE = 19
const isMinor = computed<boolean|null>(() => {
  const y = passResult.value?.birthyear
  if (!y || typeof y !== 'number') return null
  const age = CURRENT_YEAR - y
  return age < ADULT_AGE
})
const showMinorNotice = computed(() => isMinor.value === true)

// 유효성
const passwordMismatch = computed(
  () => form.value.password !== '' && form.value.password2 !== '' && form.value.password !== form.value.password2
)
const isValid = computed(
  () =>
    !!txId.value &&
    passSuccess.value &&
    isMinor.value !== true &&
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
  return (typeof route.query.redirect === 'string' && route.query.redirect)
    ? (route.query.redirect as string)
    : '/home/6page'
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
    stopPolling()
    return
  }

  loadingPass.value = true
  passError.value = ''

  try {
    const res = await api.get(`/api/auth/pass/status`, {
      params: { txId: txId.value },
      withCredentials: true,
    })

    const j = res.data
    if (!j?.ok) throw new Error('PASS 상태 조회 실패')

    if (j.status === 'success') {
      passStatus.value = 'success'

      // ✅ 어떤 공급사든 화면에 안정적으로 표시되도록 정규화
      const by = normalizeBirthyear(j?.result?.birthyear ?? null)
      const gd = normalizeGender(j?.result?.gender ?? '')

      passResult.value = {
        birthyear: by,
        gender: gd,
        phone: String(j?.result?.phone ?? ''),
        carrier: String(j?.result?.carrier ?? ''),
        name: String(j?.result?.name ?? ''),
        ciHash: j?.result?.ciHash ?? undefined,
        diHash: j?.result?.diHash ?? undefined,
        ciHashPreview: j?.result?.ciHashPreview ?? undefined,
        diHashPreview: j?.result?.diHashPreview ?? undefined,
      }

      // ✅ 닉네임이 비어있으면 PASS 이름으로 1회 자동 채우기(원치 않으면 삭제 가능)
      if (!form.value.nickname && passResult.value?.name) {
        form.value.nickname = passResult.value.name
      }

      try { sessionStorage.setItem('passTxId', txId.value) } catch {}
      stopPolling()
      return
    }

    if (j.status === 'fail') {
      passStatus.value = 'fail'
      passResult.value = null
      passError.value = (j?.result && j.result.failCode) ? `실패코드: ${j.result.failCode}` : '인증 실패'
      stopPolling()
      return
    }

    if (j.status === 'consumed') {
      passStatus.value = 'fail'
      passResult.value = null
      passError.value = '이미 사용된 PASS 토큰입니다. 다시 인증해 주세요.'
      clearPassKeys()
      stopPolling()
      return
    }

    // pending
    passStatus.value = 'pending'
    passResult.value = null
  } catch (e: any) {
    passStatus.value = 'fail'
    passResult.value = null
    passError.value = e?.message || 'PASS 상태 조회 에러'
    stopPolling()
  } finally {
    loadingPass.value = false
  }
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

  passStatus.value = txId.value ? 'pending' : 'none'
  await fetchPassStatus()
  if (passStatus.value === 'pending' && txId.value) startPolling()
})

// 라우터가 나중에 쿼리를 채워주는 상황 대응
watch(() => route.query, () => {
  const next = readInitialTxId()
  if (next && next !== txId.value) {
    txId.value = next
    passStatus.value = 'pending'
    fetchPassStatus().then(() => {
      if (passStatus.value === 'pending') startPolling()
    })
  }
}, { deep: true })

onBeforeUnmount(() => {
  stopPolling()
})

// 제출
async function onSubmit() {
  if (!isValid.value) {
    if (isMinor.value === true) {
      errorMsg.value = '미성년자는 회원가입이 불가합니다.'
    }
    return
  }

  submitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const payload: any = {
    username: form.value.username,
    password: form.value.password,
    nickname: form.value.nickname,
    region1: form.value.region1,
    region2: form.value.region2,

    // ✅ 서버는 passTxId로 최종 검증/반영
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

    // ✅ 회원가입 성공 직후, PASS 관련 스토리지 정리
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
        const pending = status?.data?.pending || status?.data?.data?.pending || []
        if (Array.isArray(pending) && pending.length > 0) {
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

/* ✅ 읽기전용 표시 박스 */
.readonly-info .ro-box {
  font-size: 12px;
  background: #f8f8f8;
  border: 1px solid #e6e6e6;
  color: #333;
  padding: 8px 10px;
  border-radius: 8px;
  display: grid;
  row-gap: 6px;
}
.ro-line{
  display:flex;
  gap:10px;
  align-items:baseline;
}
.ro-line .k{
  width: 92px;
  opacity:.75;
  font-weight:700;
  font-size:11px;
}
.ro-line .v{
  flex:1;
  font-size:11px;
  word-break:break-all;
}
.ro-line .mono{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
