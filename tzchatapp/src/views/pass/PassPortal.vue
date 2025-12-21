<!-- src/views/pass/PassPortal.vue -->
<template>
  <ion-page class="pass-portal">
    <ion-header>
      <ion-toolbar>
        <ion-title>본인인증</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="onBack">뒤로가기</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="container">
        <div class="card">
          <h2>본인인증</h2>
          <p class="desc">
            인증은 외부 브라우저(앱)에서 진행됩니다. 완료되면 자동으로 결과를 처리합니다.
          </p>

          <ion-button
            expand="block"
            :disabled="busy"
            @click="onClickPass"
            :color="buttonColor"
          >
            <ion-spinner v-if="busy" name="dots" class="mr-2" />
            <span>{{ buttonText }}</span>
          </ion-button>

          <ion-button
            v-if="mode === 'running'"
            expand="block"
            fill="outline"
            class="mt-2"
            @click="forceReset"
          >
            인증 초기화(강제)
          </ion-button>

          <div v-if="lastFailCode" class="fail-code">
            코드: <code>{{ lastFailCode }}</code>
          </div>

          <div v-if="hasDetail" class="fail-detail">
            <h3>실패/상태 상세</h3>
            <ul class="kv">
              <li v-if="detail.stage"><span class="k">stage</span><span class="v">{{ detail.stage }}</span></li>
              <li v-if="detail.code"><span class="k">code</span><span class="v">{{ detail.code }}</span></li>
              <li v-if="detail.message"><span class="k">message</span><span class="v">{{ detail.message }}</span></li>
              <li v-if="detail.ivStatus"><span class="k">ivStatus</span><span class="v">{{ detail.ivStatus }}</span></li>
              <li v-if="detail.httpStatus"><span class="k">httpStatus</span><span class="v">{{ detail.httpStatus }}</span></li>
              <li v-if="detail.stackTop"><span class="k">stackTop</span><span class="v">{{ detail.stackTop }}</span></li>
              <li v-if="detail.tryCount"><span class="k">tryCount</span><span class="v">{{ detail.tryCount }}</span></li>
            </ul>

            <details v-if="detail.raw">
              <summary>원시 응답 보기</summary>
              <pre class="raw">{{ pretty(detail.raw) }}</pre>
            </details>
          </div>

          <div class="tips">
            <p>인증이 완료되면 자동으로 분기됩니다:</p>
            <ul>
              <li>동일 CI가 없으면 → 회원가입</li>
              <li>동일 CI가 있으면 → 임시로그인</li>
            </ul>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonSpinner, IonButtons
} from '@ionic/vue'
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

const route = useRoute()
const router = useRouter()

/** ✅ 백엔드 절대 URL (.env.*)
 *  dev:  VITE_API_BASE_URL=http://localhost:2000
 *  prod: VITE_API_BASE_URL=https://tzchat.tazocode.com
 */
const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const api = (path) => `${API}${path.startsWith('/') ? path : `/${path}`}`

// 서비스 오리진(웹에서 redirectUrl 구성용)
const SERVICE_ORIGIN = (import.meta.env.VITE_APP_WEB_ORIGIN || 'https://tzchat.tazocode.com').replace(/\/+$/, '')

const STORE_ID = (import.meta.env.VITE_PORTONE_STORE_ID || '').trim()
const CHANNEL_KEY = (import.meta.env.VITE_PORTONE_CHANNEL_KEY || '').trim()

const busy = ref(false)
const lastFailCode = ref('')
const lastFailDetail = ref(null)
const txIdRef = ref('')

let pollingAbort = false
let pollingPromise = null
let pollingResolve = null
let pollingReject = null

const POLL_INTERVAL_MS = 900
const POLL_TIMEOUT_MS = 90_000

const RUN_STORE_KEY = 'PASS_PORTAL_RUNNING' // JSON: { startedAt, identityVerificationId }
const mode = ref('idle') // idle | running | fail

const buttonText = computed(() =>
  mode.value === 'running' ? '인증 중…'
    : mode.value === 'fail' ? '인증 실패 · 재시도'
      : 'PASS 인증하기'
)
const buttonColor = computed(() => (mode.value === 'fail' ? 'danger' : 'primary'))

const detail = computed(() => lastFailDetail.value || {})
const hasDetail = computed(() => !!lastFailDetail.value)

const isNative = Capacitor.isNativePlatform()

/** ✅ 공용 스토리지 키(회원가입/임시로그인/전화변경 화면과 호환) */
const STORE_KEYS = {
  // 신규(권장)
  PASS_TX: 'PASS_RESULT_TX',     // localStorage: txId
  PASS_FAIL: 'PASS_FAIL',
  PASS_FAIL_DETAIL: 'PASS_FAIL_DETAIL',

  // 구버전 호환
  PASS_TX_OLD: 'passTxId',       // session/localStorage
  PASS_TX_SESSION: 'passTxId',   // SignupPage.vue 가 읽는 키
  PASS_TX_ALT: 'pass.txId',      // TempLogin.vue 가 읽는 키
  PASS_INTENT: 'pass.intent',
  PASS_ROUTE: 'pass.route',
}

function isPortOneTxId(id = '') {
  return /^app_iv_/i.test(String(id || ''))
}

function getPortOne() { return window?.PortOne }

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}

function stopPolling() {
  pollingAbort = true
  pollingPromise = null
  pollingResolve = null
  pollingReject = null
}

async function closeExternal() {
  stopPolling()
  if (isNative) {
    try { await Browser.close() } catch {}
  }
}

function clearRunningStore() {
  try { sessionStorage.removeItem(RUN_STORE_KEY) } catch {}
}

function saveRunningStore(identityVerificationId) {
  try {
    sessionStorage.setItem(RUN_STORE_KEY, JSON.stringify({
      startedAt: Date.now(),
      identityVerificationId,
    }))
  } catch {}
}

function readRunningStore() {
  try {
    const raw = sessionStorage.getItem(RUN_STORE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (!j?.identityVerificationId) return null
    return j
  } catch {
    return null
  }
}

/** ✅ PASS 관련 로컬 저장소를 “성공 txId” 기준으로 세팅 */
function storePassSuccessTx(txId) {
  const id = String(txId || '')
  if (!id) return
  try { localStorage.setItem(STORE_KEYS.PASS_TX, id) } catch {}
  try { sessionStorage.setItem(STORE_KEYS.PASS_TX_SESSION, id) } catch {}
  try { localStorage.setItem(STORE_KEYS.PASS_TX_OLD, id) } catch {}
  try { sessionStorage.setItem(STORE_KEYS.PASS_TX_ALT, id) } catch {}
  // intent는 있으면 유지(없으면 건드리지 않음)
}

/** ✅ 실패 정보 저장(디버그용/후속 화면 표시용) */
function storePassFail(code, detailObj) {
  try { localStorage.setItem(STORE_KEYS.PASS_FAIL, String(code || 'FAIL')) } catch {}
  try { localStorage.setItem(STORE_KEYS.PASS_FAIL_DETAIL, JSON.stringify(detailObj || {})) } catch {}
}

/** ✅ PASS 스토리지 전체 정리 */
function clearPassAllStorage() {
  try {
    localStorage.removeItem(STORE_KEYS.PASS_TX)
    localStorage.removeItem(STORE_KEYS.PASS_FAIL)
    localStorage.removeItem(STORE_KEYS.PASS_FAIL_DETAIL)
    localStorage.removeItem(STORE_KEYS.PASS_TX_OLD)
    localStorage.removeItem(STORE_KEYS.PASS_TX_ALT)
    localStorage.removeItem(STORE_KEYS.PASS_INTENT)
    localStorage.removeItem(STORE_KEYS.PASS_ROUTE)
  } catch {}
  try {
    sessionStorage.removeItem(STORE_KEYS.PASS_TX_SESSION)
    sessionStorage.removeItem(STORE_KEYS.PASS_TX_OLD)
    sessionStorage.removeItem(STORE_KEYS.PASS_TX_ALT)
    sessionStorage.removeItem(STORE_KEYS.PASS_INTENT)
    sessionStorage.removeItem(STORE_KEYS.PASS_ROUTE)
  } catch {}
}

async function forceReset() {
  lastFailCode.value = ''
  lastFailDetail.value = null
  mode.value = 'idle'
  busy.value = false
  txIdRef.value = ''
  clearRunningStore()
  clearPassAllStorage()
  await closeExternal()
}

function makeIdentityVerificationId() {
  const ts = Date.now()
  const rnd = Math.random().toString(16).slice(2)
  return `app_iv_${ts}_${rnd}`
}

/* ---------------- fetch with timeout ---------------- */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    return res
  } finally {
    clearTimeout(t)
  }
}

/* ---------------- polling: complete ---------------- */
function shouldKeepPolling(respJson) {
  const code = String(respJson?.code || '')
  const ivStatus = String(respJson?.ivStatus || respJson?.status || '')
  const httpStatus = Number(respJson?.httpStatus || 0)

  if (code === 'PORTONE_API_ERROR') {
    if (httpStatus === 404 || httpStatus === 429 || (httpStatus >= 500 && httpStatus <= 599) || httpStatus === 0) return true
    return false
  }

  if (code === 'NOT_VERIFIED') {
    if (/pending|processing|requested|ready|started|init/i.test(ivStatus)) return true
    return false
  }

  return false
}

function startPollingComplete(identityVerificationId) {
  if (pollingPromise) return pollingPromise

  pollingAbort = false
  pollingPromise = new Promise((resolve, reject) => {
    pollingResolve = resolve
    pollingReject = reject
  })

  const startedAt = Date.now()

  const loop = async () => {
    if (pollingAbort) return

    const elapsed = Date.now() - startedAt
    if (elapsed > POLL_TIMEOUT_MS) {
      stopPolling()
      pollingReject?.(new Error('COMPLETE_TIMEOUT'))
      return
    }

    try {
      const res = await fetchWithTimeout(
        api(`/api/auth/pass/portone/complete?identityVerificationId=${encodeURIComponent(identityVerificationId)}`),
        { credentials: 'include' },
        15000
      )

      const txt = await res.text()
      let j
      try { j = JSON.parse(txt) } catch { j = { ok: false, code: 'COMPLETE_NON_JSON', raw: txt } }

      lastFailDetail.value = {
        stage: 'complete',
        code: j?.code || null,
        ivStatus: j?.ivStatus || j?.status || null,
        httpStatus: res.status,
        message: j?.message || null,
        raw: j,
      }

      if (res.ok && j?.ok) {
        stopPolling()
        pollingResolve?.(j)
        return
      }

      if (shouldKeepPolling(j)) {
        setTimeout(loop, POLL_INTERVAL_MS)
        return
      }

      stopPolling()
      pollingReject?.(Object.assign(new Error(j?.code || 'COMPLETE_ERROR'), { payload: j, httpStatus: res.status }))
    } catch (e) {
      // 네트워크/타임아웃 등은 계속 재시도
      setTimeout(loop, POLL_INTERVAL_MS)
    }
  }

  void loop()
  return pollingPromise
}

/* ---------------- route stage (강화: 재시도/안전폴백) ---------------- */
function isRetryableRoutePayload(j, httpStatus) {
  const code = String(j?.code || '')
  // 백엔드가 ok:false 로 내려주는 대기류
  if (code === 'PASS_NOT_SUCCESS') return true
  if (code === 'PASS_TX_NOT_FOUND') return true
  // 응답이 이상하거나 서버 오류
  if (httpStatus === 0) return true
  if (httpStatus === 404) return true
  if (httpStatus === 429) return true
  if (httpStatus >= 500 && httpStatus <= 599) return true
  return false
}

async function proceedRouteByTx(txId) {
  const id = String(txId || '')
  if (!id) {
    lastFailCode.value = 'NO_TXID'
    mode.value = 'fail'
    busy.value = false
    return
  }

  // ✅ route 호출 전, 상태 표시를 확실히 남김
  lastFailDetail.value = {
    stage: 'route:request',
    message: 'route 분기 조회 중…',
    raw: { txId: id }
  }

  const maxTry = 8
  const delayMs = 450

  for (let i = 1; i <= maxTry; i++) {
    try {
      const res = await fetchWithTimeout(
        api(`/api/auth/pass/route?txId=${encodeURIComponent(id)}`),
        { credentials: 'include' },
        15000
      )
      const txt = await res.text()
      let j
      try { j = JSON.parse(txt) } catch { j = { ok: false, code: 'ROUTE_NON_JSON', rawText: txt } }

      lastFailDetail.value = {
        stage: 'route:response',
        tryCount: i,
        httpStatus: res.status,
        code: j?.code || null,
        message: j?.message || null,
        raw: j,
      }

      // ✅ 성공 케이스
      if (res.ok && j?.ok !== false) {
        const nextRoute = j?.route || j?.next
        if (!nextRoute) {
          lastFailCode.value = 'ROUTE_MISSING'
          mode.value = 'fail'
          break
        }

        // (선택) route 결과 저장
        try { sessionStorage.setItem(STORE_KEYS.PASS_ROUTE, String(nextRoute)) } catch {}

        if (nextRoute === 'signup') {
          // ✅ 회원가입 화면이 txId를 안정적으로 읽게끔 저장소도 같이 세팅
          storePassSuccessTx(id)
          try { await router.replace({ name: 'Signup', query: { passTxId: id } }) }
          catch { await router.replace({ path: `/signup?passTxId=${encodeURIComponent(id)}` }) }
          return
        }

        if (nextRoute === 'templogin') {
          storePassSuccessTx(id)
          try { await router.replace({ name: 'TempLogin', query: { txId: id } }) }
          catch { await router.replace({ path: `/templogin?txId=${encodeURIComponent(id)}` }) }
          return
        }

        lastFailCode.value = 'ROUTE_UNKNOWN'
        mode.value = 'fail'
        break
      }

      // ✅ 실패인데 “재시도 가치”가 있는 케이스면 잠깐 기다렸다가 재호출
      if (isRetryableRoutePayload(j, res.status)) {
        if (i < maxTry) {
          await new Promise(r => setTimeout(r, delayMs))
          continue
        }
      }

      // ✅ 최종 실패 처리
      lastFailCode.value = j?.code || 'ROUTE_ERROR'
      storePassFail(lastFailCode.value, { stage: 'route', httpStatus: res.status, raw: j })
      mode.value = 'fail'
      break
    } catch (e) {
      // timeout/network
      lastFailDetail.value = {
        stage: 'route:exception',
        tryCount: i,
        message: String(e?.message || e),
        stackTop: String(e?.stack || '').split('\n')[0],
        raw: { txId: id }
      }
      if (i < maxTry) {
        await new Promise(r => setTimeout(r, delayMs))
        continue
      }
      lastFailCode.value = e?.name === 'AbortError' ? 'ROUTE_TIMEOUT' : (e?.message || 'ROUTE_FETCH_ERROR')
      storePassFail(lastFailCode.value, lastFailDetail.value)
      mode.value = 'fail'
      break
    }
  }

  // ✅ 어떤 경우든 busy를 영구로 두지 않음
  busy.value = false
  if (mode.value === 'running') mode.value = 'idle'
  await closeExternal()
  clearRunningStore()
}

/* ---------------- finalize ---------------- */
async function finalizeByIdentityVerificationId(identityVerificationId) {
  try {
    const j = await startPollingComplete(identityVerificationId)

    // complete ok 라면 여기로 옴
    const txId = j?.txId || identityVerificationId
    txIdRef.value = txId

    // ✅ complete 성공을 화면에 남기고
    lastFailDetail.value = {
      stage: 'complete:ok',
      ivStatus: j?.ivStatus || null,
      httpStatus: 200,
      raw: j
    }

    // ✅ “결과 txId”를 공용 스토리지에 기록 (Signup/TempLogin이 읽을 수 있게)
    storePassSuccessTx(txId)

    // ✅ 분기
    await proceedRouteByTx(txId)
  } catch (e) {
    const payload = e?.payload || null
    lastFailCode.value = payload?.code || e?.message || 'COMPLETE_ERROR'
    lastFailDetail.value = payload || {
      stage: 'complete:exception',
      message: e?.message || '',
      stackTop: String(e?.stack || '').split('\n')[0]
    }
    storePassFail(lastFailCode.value, lastFailDetail.value)
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
    clearRunningStore()
  }
}

/* ---------------- start button ---------------- */
async function onClickPass() {
  lastFailCode.value = ''
  lastFailDetail.value = null
  stopPolling()
  if (busy.value) return

  // ✅ 기존 실패/상태는 시작 시 정리
  try {
    localStorage.removeItem(STORE_KEYS.PASS_FAIL)
    localStorage.removeItem(STORE_KEYS.PASS_FAIL_DETAIL)
  } catch {}

  if (!STORE_ID || !CHANNEL_KEY) {
    lastFailCode.value = 'ENV_MISSING'
    lastFailDetail.value = { stage: 'start', message: 'VITE_PORTONE_STORE_ID 또는 VITE_PORTONE_CHANNEL_KEY 가 비어있습니다.' }
    mode.value = 'fail'
    busy.value = false
    return
  }

  const PortOne = getPortOne()
  if (!PortOne?.requestIdentityVerification) {
    lastFailCode.value = 'SDK_NOT_LOADED'
    lastFailDetail.value = { stage: 'start', message: 'PortOne 브라우저 SDK가 로드되지 않았습니다. index.html에 CDN script가 있는지 확인하세요.' }
    mode.value = 'fail'
    busy.value = false
    return
  }

  busy.value = true
  mode.value = 'running'

  try {
    const identityVerificationId = makeIdentityVerificationId()
    txIdRef.value = identityVerificationId
    saveRunningStore(identityVerificationId)

    // ✅ redirectUrl을 relay로 통일
    const redirectUrl =
      `${SERVICE_ORIGIN}/api/auth/pass/relay?identityVerificationId=${encodeURIComponent(identityVerificationId)}`

    // ✅ 폴링 시작(동시 진행)
    void finalizeByIdentityVerificationId(identityVerificationId)

    const resp = await PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY,
      identityVerificationId,
      redirectUrl,
    })

    // PortOne SDK가 즉시 에러를 주는 경우
    if (resp?.code) {
      stopPolling()
      lastFailCode.value = resp.code || 'PORTONE_FAIL'
      lastFailDetail.value = { stage: 'start:resp', raw: resp }
      storePassFail(lastFailCode.value, lastFailDetail.value)
      mode.value = 'fail'
      busy.value = false
      await closeExternal()
      clearRunningStore()
      return
    }
  } catch (e) {
    stopPolling()
    lastFailCode.value = e?.message || 'PORTONE_START_ERROR'
    lastFailDetail.value = { stage: 'start:exception', message: String(e?.message || e) }
    storePassFail(lastFailCode.value, lastFailDetail.value)
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
    clearRunningStore()
  }
}

/* ---------------- lifecycle ---------------- */
let appUrlOpenSub = null
let browserFinishedSub = null

function handleWindowMessage(ev) {
  try {
    const data = ev?.data || {}
    if (!data || typeof data !== 'object') return
    if (data.type !== 'PASS_RESULT') return

    const ivId = data.identityVerificationId ? String(data.identityVerificationId) : ''
    const txId = data.txId ? String(data.txId) : ''

    if (ivId) {
      txIdRef.value = ivId
      mode.value = 'running'
      busy.value = true
      saveRunningStore(ivId)
      void finalizeByIdentityVerificationId(ivId)
      return
    }
    if (txId) {
      txIdRef.value = txId
      mode.value = 'running'
      busy.value = true
      void proceedRouteByTx(txId)
      return
    }
  } catch {}
}

async function handleAppUrlOpen(data) {
  try {
    const rawUrl = String(data?.url || '')
    const url = new URL(rawUrl)

    const ivId = url.searchParams.get('identityVerificationId') || ''
    if (ivId) {
      txIdRef.value = ivId
      await closeExternal()
      await finalizeByIdentityVerificationId(ivId)
      return
    }

    const txId = url.searchParams.get('txId') || ''
    if (txId) {
      txIdRef.value = txId
      await closeExternal()
      await proceedRouteByTx(txId)
      return
    }

    lastFailCode.value = 'NO_ID'
    storePassFail(lastFailCode.value, { stage: 'deeplink', message: 'identityVerificationId/txId 없음', raw: { rawUrl } })
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
  } catch {}
}

onMounted(async () => {
  // intent 전달(선택): ?intent=signup / phone_update 등
  try {
    const intent = typeof route.query.intent === 'string' ? route.query.intent : ''
    if (intent) {
      sessionStorage.setItem(STORE_KEYS.PASS_INTENT, intent)
      localStorage.setItem(STORE_KEYS.PASS_INTENT, intent)
    }
  } catch {}

  if (isNative) {
    appUrlOpenSub = App.addListener('appUrlOpen', handleAppUrlOpen)
    browserFinishedSub = Browser.addListener('browserFinished', () => {
      busy.value = false
      if (mode.value === 'running') mode.value = 'idle'
    })
  } else {
    window.addEventListener('message', handleWindowMessage)
  }

  // 쿼리로 바로 들어온 경우
  const ivId = route.query.identityVerificationId ? String(route.query.identityVerificationId) : ''
  if (ivId) {
    txIdRef.value = ivId
    mode.value = 'running'
    busy.value = true
    saveRunningStore(ivId)
    await finalizeByIdentityVerificationId(ivId)
    return
  }

  // 진행중 상태 복원
  const run = readRunningStore()
  if (run?.identityVerificationId) {
    const elapsed = Date.now() - Number(run.startedAt || 0)
    if (elapsed > POLL_TIMEOUT_MS + 3000) {
      await forceReset()
      return
    }
    txIdRef.value = String(run.identityVerificationId)
    mode.value = 'running'
    busy.value = true
    await finalizeByIdentityVerificationId(String(run.identityVerificationId))
    return
  }

  mode.value = 'idle'
  busy.value = false
})

onBeforeUnmount(() => {
  void closeExternal()
  clearRunningStore()
  if (appUrlOpenSub) appUrlOpenSub.remove?.()
  if (browserFinishedSub) browserFinishedSub.remove?.()
  window.removeEventListener('message', handleWindowMessage)
})

function onBack() {
  void forceReset()
  router.replace('/login')
}
</script>

<style scoped>
.container { max-width: 720px; margin: 0 auto; padding: 16px; }
.card {
  background: var(--ion-card-background, #1e1e1e);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}
h2 { margin: 0 0 8px; }
.desc { opacity: 0.85; margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }
.mt-2 { margin-top: 8px; }
.fail-code { margin-top: 12px; color: var(--ion-color-danger); }

.fail-detail {
  margin-top: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 0, 0, 0.06);
  border: 1px solid rgba(255, 0, 0, 0.2);
}
.fail-detail h3 { margin: 0 0 8px; font-size: 1rem; }
.kv { list-style: none; padding: 0; margin: 0 0 8px; }
.kv li { display: grid; grid-template-columns: 112px 1fr; gap: 8px; padding: 4px 0; }
.kv .k { opacity: 0.7; }
.kv .v { word-break: break-all; }
.raw {
  margin: 8px 0 0;
  max-height: 260px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.06);
  padding: 8px;
  border-radius: 8px;
}
.tips { margin-top: 16px; font-size: 0.95rem; opacity: 0.9; }
.tips ul { margin: 6px 0 0 18px; }
</style>
