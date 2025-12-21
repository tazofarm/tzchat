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
            실패 코드: <code>{{ lastFailCode }}</code>
          </div>

          <div v-if="hasDetail" class="fail-detail">
            <h3>실패/상태 상세</h3>
            <ul class="kv">
              <li v-if="detail.code"><span class="k">code</span><span class="v">{{ detail.code }}</span></li>
              <li v-if="detail.stage"><span class="k">stage</span><span class="v">{{ detail.stage }}</span></li>
              <li v-if="detail.message"><span class="k">message</span><span class="v">{{ detail.message }}</span></li>
              <li v-if="detail.ivStatus"><span class="k">ivStatus</span><span class="v">{{ detail.ivStatus }}</span></li>
              <li v-if="detail.httpStatus"><span class="k">httpStatus</span><span class="v">{{ detail.httpStatus }}</span></li>
              <li v-if="detail.stackTop"><span class="k">stackTop</span><span class="v">{{ detail.stackTop }}</span></li>
            </ul>
            <details v-if="detail.raw">
              <summary>원시 응답 보기</summary>
              <pre class="raw">{{ pretty(detail.raw) }}</pre>
            </details>
          </div>

          <div v-if="hasPassResult" class="result-panel">
            <div class="panel-head">
              <h3>PASS 결과 (PassResult)</h3>
              <small class="muted">txId: {{ passTxShort }}</small>
            </div>

            <ul class="kv">
              <li><span class="k">status</span><span class="v">{{ pr.status }}</span></li>
              <li v-if="pr.failCode"><span class="k">failCode</span><span class="v">{{ pr.failCode }}</span></li>
              <li v-if="pr.provider"><span class="k">provider</span><span class="v">{{ pr.provider }}</span></li>
              <li v-if="pr.name"><span class="k">name</span><span class="v">{{ pr.name }}</span></li>
              <li v-if="pr.birthyear"><span class="k">birthyear</span><span class="v">{{ pr.birthyear }}</span></li>
              <li v-if="pr.gender !== undefined"><span class="k">gender</span><span class="v">{{ pr.gender }}</span></li>
              <li v-if="pr.phone"><span class="k">phone</span><span class="v">{{ pr.phone }}</span></li>
              <li v-if="pr.ciHash"><span class="k">ciHash</span><span class="v mono">{{ pr.ciHash }}</span></li>
              <li v-if="pr.diHash"><span class="k">diHash</span><span class="v mono">{{ pr.diHash }}</span></li>
              <li><span class="k">consumed</span><span class="v">{{ String(pr.consumed || false) }}</span></li>
              <li v-if="pr.usedAt"><span class="k">usedAt</span><span class="v">{{ fmt(pr.usedAt) }}</span></li>
              <li v-if="pr.createdAt"><span class="k">createdAt</span><span class="v">{{ fmt(pr.createdAt) }}</span></li>
              <li v-if="pr.updatedAt"><span class="k">updatedAt</span><span class="v">{{ fmt(pr.updatedAt) }}</span></li>
            </ul>

            <details v-if="passResultRaw">
              <summary>전체 JSON 보기</summary>
              <pre class="raw">{{ pretty(passResultRaw) }}</pre>
            </details>

            <div class="result-actions">
              <ion-button size="small" @click="goSignup" :disabled="busy">회원가입으로 이동</ion-button>
              <ion-button size="small" @click="goHome" :disabled="busy">홈으로 이동</ion-button>
            </div>
            <p class="hint">
              * 이 패널은 개발용입니다. 운영 시 제거/주석 처리하세요.
            </p>
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

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const api = (path) => `${API}${path.startsWith('/') ? path : `/${path}`}`

// ✅ 서비스 오리진(외부 브라우저가 접근 가능한 웹 주소)
// - 가능하면 .env에 VITE_APP_WEB_ORIGIN=https://tzchat.tazocode.com 추가 권장
const SERVICE_ORIGIN = (import.meta.env.VITE_APP_WEB_ORIGIN || 'https://tzchat.tazocode.com').replace(/\/+$/, '')

const STORE_ID = (import.meta.env.VITE_PORTONE_STORE_ID || '').trim()
const CHANNEL_KEY = (import.meta.env.VITE_PORTONE_CHANNEL_KEY || '').trim()

const busy = ref(false)
const lastFailCode = ref('')
const lastFailDetail = ref(null)

const txIdRef = ref('')

// polling control
let pollingAbort = false
let pollingPromise = null
let pollingResolve = null
let pollingReject = null

const POLL_INTERVAL_MS = 900
const POLL_TIMEOUT_MS = 90_000

const RUN_STORE_KEY = 'PASS_PORTAL_RUNNING' // JSON: { startedAt, identityVerificationId }

// PassResult debug
const passResult = ref(null)
const passResultRaw = ref(null)
const hasPassResult = computed(() => !!passResult.value)
const pr = computed(() => (passResult.value?.result || passResult.value || {}))
const passTxShort = computed(
  () => (pr.value?.txId || txIdRef.value || '').slice(0, 18) + (txIdRef.value ? '…' : '')
)

// UI state
const mode = ref('idle') // idle | running | fail
const buttonText = computed(() =>
  mode.value === 'running'
    ? '인증 중…'
    : mode.value === 'fail'
      ? '인증 실패 · 재시도'
      : 'PASS 인증하기'
)
const buttonColor = computed(() => (mode.value === 'fail' ? 'danger' : 'primary'))

const detail = computed(() => lastFailDetail.value || {})
const hasDetail = computed(() => !!lastFailDetail.value)

const pretty = (obj) => {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}
const fmt = (d) => {
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return String(d)
    const z = (n) => String(n).padStart(2, '0')
    return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(dt.getDate())} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`
  } catch { return String(d) }
}

const isNative = Capacitor.isNativePlatform()

function getPortOne() {
  return window?.PortOne
}

function makeIdentityVerificationId() {
  const ts = Date.now()
  const rnd = Math.random().toString(16).slice(2)
  return `app_iv_${ts}_${rnd}`
}

/* ──────────────── clean/reset ──────────────── */
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

async function forceReset() {
  lastFailCode.value = ''
  lastFailDetail.value = null
  mode.value = 'idle'
  busy.value = false
  txIdRef.value = ''
  passResult.value = null
  passResultRaw.value = null
  clearRunningStore()
  await closeExternal()
}

/* ──────────────── native deep link ──────────────── */
let appUrlOpenSub = null
let browserFinishedSub = null

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
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
  } catch {}
}

/* ──────────────── web postMessage (relay) ──────────────── */
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

/* ──────────────── polling: complete ──────────────── */
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
      const res = await fetch(
        api(`/api/auth/pass/portone/complete?identityVerificationId=${encodeURIComponent(identityVerificationId)}`),
        { credentials: 'include' }
      )
      const txt = await res.text()
      let j
      try { j = JSON.parse(txt) } catch { j = { ok: false, code: 'COMPLETE_NON_JSON', raw: txt } }

      // ✅ 상태 추적(사용자 화면에서 확인 가능)
      lastFailDetail.value = {
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
      // 네트워크 일시 오류 → 계속
      setTimeout(loop, POLL_INTERVAL_MS)
    }
  }

  void loop()
  return pollingPromise
}

async function finalizeByIdentityVerificationId(identityVerificationId) {
  try {
    const j = await startPollingComplete(identityVerificationId)
    const txId = j?.txId || identityVerificationId
    txIdRef.value = txId
    clearRunningStore()
    await proceedRouteByTx(txId)
  } catch (e) {
    clearRunningStore()
    const payload = e?.payload || null
    lastFailCode.value = payload?.code || e?.message || 'COMPLETE_ERROR'
    lastFailDetail.value = payload || { message: e?.message || '', httpStatus: e?.httpStatus || null, stackTop: String(e?.stack || '').split('\n')[0] }
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
  }
}

/* ──────────────── server result/route ──────────────── */
async function loadPassResult(txId) {
  if (!txId) return
  try {
    const res = await fetch(api(`/api/auth/pass/result/${encodeURIComponent(txId)}`), { credentials: 'include' })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { json = { ok: false, raw: text } }
    passResultRaw.value = json
    passResult.value = json
    try { localStorage.setItem('PASS_LAST_RESULT', JSON.stringify(json)) } catch {}
  } catch (e) {
    passResult.value = { ok: false, error: String(e) }
    passResultRaw.value = { ok: false, error: String(e) }
  }
}

async function proceedRouteByTx(txId) {
  try {
    await loadPassResult(txId)

    const res = await fetch(api(`/api/auth/pass/route?txId=${encodeURIComponent(txId)}`), { credentials: 'include' })
    const txt = await res.text()
    let j = null
    try { j = JSON.parse(txt) } catch {
      lastFailCode.value = 'ROUTE_NON_JSON'
      lastFailDetail.value = { raw: txt }
      mode.value = 'fail'
      busy.value = false
      await closeExternal()
      return
    }

    if (!res.ok || j?.ok === false) {
      lastFailCode.value = j?.code || 'ROUTE_ERROR'
      lastFailDetail.value = j
      mode.value = 'fail'
      busy.value = false
      await closeExternal()
      return
    }

    const nextRoute = j?.route || j?.next
    if (!nextRoute) {
      lastFailCode.value = 'ROUTE_MISSING'
      lastFailDetail.value = j
      mode.value = 'fail'
      busy.value = false
      await closeExternal()
      return
    }

    try {
      sessionStorage.setItem('passTxId', txId)
      localStorage.setItem('PASS_RESULT_TX', txId)
    } catch {}

    // ✅ 성공/분기 직전 UI 정리 확정
    busy.value = false
    mode.value = 'idle'

    if (nextRoute === 'signup') {
      try { await router.replace({ name: 'Signup', query: { passTxId: txId } }) }
      catch { await router.replace({ path: `/signup?passTxId=${encodeURIComponent(txId)}` }) }
      await closeExternal()
      return
    }

    if (nextRoute === 'templogin') {
      try { await router.replace({ name: 'TempLogin', query: { txId } }) }
      catch { await router.replace({ path: `/templogin?txId=${encodeURIComponent(txId)}` }) }
      await closeExternal()
      return
    }

    lastFailCode.value = 'ROUTE_UNKNOWN'
    lastFailDetail.value = j
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
  } catch (e) {
    lastFailCode.value = e?.message || 'ROUTE_ERROR'
    lastFailDetail.value = { message: e?.message || '', stackTop: String(e?.stack || '').split('\n')[0] }
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
  }
}

/* ──────────────── start button (PortOne) ──────────────── */
async function onClickPass() {
  lastFailCode.value = ''
  lastFailDetail.value = null
  stopPolling()
  if (busy.value) return

  if (!STORE_ID || !CHANNEL_KEY) {
    lastFailCode.value = 'ENV_MISSING'
    lastFailDetail.value = { message: 'VITE_PORTONE_STORE_ID 또는 VITE_PORTONE_CHANNEL_KEY 가 비어있습니다.' }
    mode.value = 'fail'
    busy.value = false
    return
  }

  const PortOne = getPortOne()
  if (!PortOne?.requestIdentityVerification) {
    lastFailCode.value = 'SDK_NOT_LOADED'
    lastFailDetail.value = { message: 'PortOne 브라우저 SDK가 로드되지 않았습니다. index.html에 CDN script가 있는지 확인하세요.' }
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

    // ✅ 중요: redirectUrl을 backend relay로 통일
    // - relay가 postMessage / 딥링크 / /pass 복귀를 다 처리함
    const redirectUrl =
      `${SERVICE_ORIGIN}/api/auth/pass/relay?identityVerificationId=${encodeURIComponent(identityVerificationId)}`

    // ✅ complete 폴링은 “항상” 돌려서 확정
    void finalizeByIdentityVerificationId(identityVerificationId)

    const resp = await PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY,
      identityVerificationId,
      redirectUrl,
    })

    if (resp?.code) {
      stopPolling()
      clearRunningStore()
      lastFailCode.value = resp.code || 'PORTONE_FAIL'
      lastFailDetail.value = resp
      mode.value = 'fail'
      busy.value = false
      await closeExternal()
      return
    }
  } catch (e) {
    stopPolling()
    clearRunningStore()
    lastFailCode.value = e?.message || 'PORTONE_START_ERROR'
    lastFailDetail.value = { message: String(e?.message || e) }
    mode.value = 'fail'
    busy.value = false
    await closeExternal()
  }
}

/* ──────────────── lifecycle ──────────────── */
let visHandler = null
let focusHandler = null
let pageShowHandler = null

function installWebStuckGuard() {
  if (isNative) return

  window.addEventListener('message', handleWindowMessage)

  const maybeRecoverOrReset = async () => {
    const run = readRunningStore()
    if (!run) return
    const elapsed = Date.now() - Number(run.startedAt || 0)

    if (elapsed < 3000) return
    if (elapsed > POLL_TIMEOUT_MS + 3000) {
      await forceReset()
      return
    }

    // ✅ 재진입 시 폴링 재개
    if (run.identityVerificationId && mode.value !== 'running') {
      txIdRef.value = String(run.identityVerificationId)
      mode.value = 'running'
      busy.value = true
      void finalizeByIdentityVerificationId(String(run.identityVerificationId))
    }
  }

  visHandler = () => { if (document.visibilityState === 'visible') void maybeRecoverOrReset() }
  focusHandler = () => { void maybeRecoverOrReset() }
  pageShowHandler = () => { void maybeRecoverOrReset() }

  document.addEventListener('visibilitychange', visHandler)
  window.addEventListener('focus', focusHandler)
  window.addEventListener('pageshow', pageShowHandler)
}

function uninstallWebStuckGuard() {
  if (isNative) return
  window.removeEventListener('message', handleWindowMessage)
  if (visHandler) document.removeEventListener('visibilitychange', visHandler)
  if (focusHandler) window.removeEventListener('focus', focusHandler)
  if (pageShowHandler) window.removeEventListener('pageshow', pageShowHandler)
  visHandler = null
  focusHandler = null
  pageShowHandler = null
}

onMounted(async () => {
  if (isNative) {
    appUrlOpenSub = App.addListener('appUrlOpen', handleAppUrlOpen)
    browserFinishedSub = Browser.addListener('browserFinished', () => {
      // 사용자가 닫았을 수도 있으니 UI만 정리 (폴링은 계속 가능)
      busy.value = false
      mode.value = 'idle'
    })
  } else {
    installWebStuckGuard()
  }

  const ivId = route.query.identityVerificationId ? String(route.query.identityVerificationId) : ''
  if (ivId) {
    txIdRef.value = ivId
    mode.value = 'running'
    busy.value = true
    saveRunningStore(ivId)
    await finalizeByIdentityVerificationId(ivId)
    return
  }

  const qTx = route.query.txId ? String(route.query.txId) : ''
  if (qTx) {
    txIdRef.value = qTx
    mode.value = 'running'
    busy.value = true
    await proceedRouteByTx(qTx)
    return
  }

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
  uninstallWebStuckGuard()
})

/* ──────────────── navigation ──────────────── */
function onBack() {
  try {
    sessionStorage.removeItem('passTxId')
    localStorage.removeItem('PASS_RESULT_TX')
  } catch {}
  void forceReset()
  router.replace('/login')
}

function goSignup() {
  const txId = txIdRef.value || pr.value?.txId || ''
  if (!txId) return
  router.replace({ name: 'Signup', query: { passTxId: txId } })
}
function goHome() {
  router.replace('/')
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
.kv .v.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; }
.raw {
  margin: 8px 0 0;
  max-height: 240px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.06);
  padding: 8px;
  border-radius: 8px;
}
.tips { margin-top: 16px; font-size: 0.95rem; opacity: 0.9; }
.tips ul { margin: 6px 0 0 18px; }

.result-panel {
  margin-top: 16px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(0, 128, 255, 0.06);
  border: 1px solid rgba(0, 128, 255, 0.2);
}
.result-panel .panel-head { display: flex; align-items: baseline; gap: 8px; }
.result-panel .panel-head h3 { margin: 0; font-size: 1rem; }
.result-panel .panel-head .muted { opacity: 0.7; }
.result-actions { display: flex; gap: 8px; margin-top: 8px; }
.hint { margin-top: 6px; opacity: 0.7; font-size: 0.85rem; }
</style>
