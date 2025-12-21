<!-- src/views/pass/PhoneUpdate.vue -->
<template>
  <ion-page class="phone-update">
    <ion-header>
      <ion-toolbar>
        <ion-title>전화번호 변경(PASS)</ion-title>
        <ion-button @click="goBack">뒤로가기</ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>본인인증으로 전화번호 최신화</ion-card-title>
            <ion-card-subtitle>동일 CI 검증 · 로그인 상태 전용</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <div class="current">
              <div class="row">
                <span class="label">현재 번호</span>
                <span class="value">{{ maskedPhone || '미등록' }}</span>
              </div>
            </div>

            <p class="desc">
              로그인된 계정에서 PASS 인증을 다시 수행해 <b>최신 전화번호/통신사</b>를 반영합니다.<br />
              인증은 외부(브라우저/앱)에서 진행되며, 완료되면 자동으로 결과를 처리합니다.<br />
              <small>※ 보안상, PASS 결과의 CI가 현재 계정과 다르면 반영하지 않습니다.</small>
            </p>

            <div class="status">
              <div v-if="busy" class="row">
                <ion-spinner name="dots" class="mr-2" />
                <span>처리중…</span>
              </div>

              <div v-else-if="error" class="row error">
                <span>{{ error }}</span>
              </div>

              <div v-else-if="success" class="row success">
                <span>업데이트 완료! 이동합니다…</span>
              </div>

              <div v-else-if="certified && txId" class="row pending">
                <span>인증완료 · txId=<code>{{ txId }}</code></span>
              </div>
            </div>

            <div class="actions">
              <ion-button expand="block" :disabled="busy || certified" @click="onStartPass">
                <ion-spinner v-if="busy && phase === 'start'" name="dots" class="mr-2" />
                <span>{{ startBtnText }}</span>
              </ion-button>

              <ion-button
                expand="block"
                fill="outline"
                :disabled="busy || (!txId && errorCode !== 'CI_MISMATCH')"
                @click="onSecondaryAction"
              >
                <ion-spinner v-if="busy && phase === 'commit'" name="dots" class="mr-2" />
                <span>{{ secondaryBtnText }}</span>
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
                </ul>

                <details v-if="detail.raw">
                  <summary>원시 응답 보기</summary>
                  <pre class="raw">{{ pretty(detail.raw) }}</pre>
                </details>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent
} from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '@/lib/api'

const router = useRouter()
const route = useRoute()

// ====== ENV ======
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const SERVICE_ORIGIN = String(import.meta.env.VITE_APP_WEB_ORIGIN || 'https://tzchat.tazocode.com').replace(/\/+$/, '')
const STORE_ID = String(import.meta.env.VITE_PORTONE_STORE_ID || '').trim()
const CHANNEL_KEY = String(import.meta.env.VITE_PORTONE_CHANNEL_KEY || '').trim()

const isNative = Capacitor.isNativePlatform()
const apiUrl = (p: string) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`

function getPortOne(): any { return (window as any)?.PortOne }

function pretty(obj: any) {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}

function makeIdentityVerificationId() {
  const ts = Date.now()
  const rnd = Math.random().toString(16).slice(2)
  return `app_iv_${ts}_${rnd}`
}

function isPortOneTxId(id: any): boolean {
  return typeof id === 'string' && /^app_iv_/i.test(id)
}

// ====== AUTH HEADER(기존 유지) ======
function buildAuthHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const token =
      localStorage.getItem('TZCHAT_AUTH_TOKEN') ||
      localStorage.getItem('authToken') ||
      ''
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {}
  return headers
}

function clearPassStorage() {
  try {
    localStorage.removeItem('PASS_RESULT_TX')
    localStorage.removeItem('PASS_FAIL')
    localStorage.removeItem('PASS_FAIL_DETAIL')
    localStorage.removeItem('PASS_TX')
    localStorage.removeItem('PASS_STATE')
  } catch {}
  try {
    sessionStorage.removeItem('passTxId')
    sessionStorage.removeItem('pass.txId')
  } catch {}
}

// ====== UI STATE ======
const me = ref<any>(null)
const busy = ref(false)
const error = ref('')
const errorCode = ref('')
const success = ref(false)
const updatedFields = ref<string[]>([])
const phase = ref<'idle' | 'start' | 'commit'>('idle')

// 인증/트랜잭션 상태
const certified = ref(false)
const txId = ref('')

// 상세 로그(디버그)
const lastFailCode = ref('')
const lastFailDetail = ref<any>(null)
const detail = computed(() => lastFailDetail.value || {})
const hasDetail = computed(() => !!lastFailDetail.value)

const endpointCommit = '/api/user/pass-phone/commit'

const maskedPhone = computed(() => {
  const m = me.value?.phoneMasked || ''
  const f = me.value?.phoneFormatted || ''
  if (m) return m
  if (f) return f
  const p = me.value?.phone || ''
  if (!p) return ''
  return p.replace(/(\+\d{1,3})?(\d+)(\d{4})$/, (_: any, c = '', mid: string, last: string) =>
    `${c}${'*'.repeat((mid || '').length)}${last}`
  )
})

const startBtnText = computed(() => (certified.value ? '인증완료' : '휴대전화 인증 시작'))
const secondaryBtnText = computed(() => (errorCode.value === 'CI_MISMATCH' ? '인증 실패 · 다시 인증' : '변경 반영하기'))

function resetPassState() {
  txId.value = ''
  certified.value = false
  error.value = ''
  errorCode.value = ''
  success.value = false
  updatedFields.value = []
  lastFailCode.value = ''
  lastFailDetail.value = null
}

// ====== overlay action ======
function onSecondaryAction() {
  if (errorCode.value === 'CI_MISMATCH') {
    resetPassState()
    onStartPass()
  } else {
    commitUpdate()
  }
}

// ====== me ======
async function reloadMe() {
  try {
    const res = await api.get('/api/me', { withCredentials: true })
    me.value = res?.data?.data || res?.data?.user || res?.data || null
  } catch {
    me.value = null
  }
}

// ====== fetch timeout ======
async function fetchWithTimeout(url: string, opts: any = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    return res
  } finally {
    clearTimeout(t)
  }
}

// ====== PortOne complete polling (PassPortal과 동일) ======
const POLL_INTERVAL_MS = 900
const POLL_TIMEOUT_MS = 90_000

let pollingAbort = false
let pollingPromise: Promise<any> | null = null
let pollingResolve: ((v: any) => void) | null = null
let pollingReject: ((e: any) => void) | null = null

function stopPolling() {
  pollingAbort = true
  pollingPromise = null
  pollingResolve = null
  pollingReject = null
}

function shouldKeepPolling(respJson: any) {
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

function startPollingComplete(identityVerificationId: string) {
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
        apiUrl(`/api/auth/pass/portone/complete?identityVerificationId=${encodeURIComponent(identityVerificationId)}`),
        { credentials: 'include' },
        15000
      )

      const txt = await res.text()
      let j: any
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
    } catch {
      setTimeout(loop, POLL_INTERVAL_MS)
    }
  }

  void loop()
  return pollingPromise
}

async function finalizeByIdentityVerificationId(identityVerificationId: string) {
  try {
    const j = await startPollingComplete(identityVerificationId)
    const nextTxId = j?.txId || identityVerificationId

    txId.value = String(nextTxId)
    certified.value = true
    busy.value = false
    phase.value = 'idle'

    lastFailDetail.value = {
      stage: 'complete:ok',
      httpStatus: 200,
      ivStatus: j?.ivStatus || null,
      raw: j,
    }
  } catch (e: any) {
    const payload = e?.payload || null
    lastFailCode.value = payload?.code || e?.message || 'COMPLETE_ERROR'
    lastFailDetail.value = payload || {
      stage: 'complete:exception',
      message: e?.message || '',
      stackTop: String(e?.stack || '').split('\n')[0],
      raw: { identityVerificationId },
    }
    error.value = '인증 확인 실패'
    errorCode.value = lastFailCode.value || 'COMPLETE_ERROR'
    busy.value = false
    phase.value = 'idle'
  }
}

// ====== message / deep link handlers ======
function handleWindowMessage(ev: MessageEvent) {
  try {
    const data: any = (ev as any)?.data || {}
    if (!data || typeof data !== 'object') return
    if (data.type !== 'PASS_RESULT') return

    const ivId = data.identityVerificationId ? String(data.identityVerificationId) : ''
    const tx = data.txId ? String(data.txId) : ''

    if (ivId) {
      busy.value = true
      phase.value = 'start'
      certified.value = false
      txId.value = ivId
      void finalizeByIdentityVerificationId(ivId)
      return
    }

    if (tx) {
      txId.value = tx
      certified.value = true
      return
    }
  } catch {}
}

async function handleAppUrlOpen(data: any) {
  try {
    const rawUrl = String(data?.url || '')
    const url = new URL(rawUrl)

    const ivId = url.searchParams.get('identityVerificationId') || ''
    if (ivId) {
      busy.value = true
      phase.value = 'start'
      certified.value = false
      txId.value = ivId
      try { await Browser.close() } catch {}
      await finalizeByIdentityVerificationId(ivId)
      return
    }

    const tx = url.searchParams.get('txId') || ''
    if (tx) {
      txId.value = tx
      certified.value = true
      try { await Browser.close() } catch {}
      return
    }
  } catch {}
}

// ====== start pass (최신 PortOne 직접 호출) ======
async function onStartPass() {
  if (certified.value) return

  resetPassState()
  clearPassStorage()

  if (!STORE_ID || !CHANNEL_KEY) {
    error.value = '환경변수(VITE_PORTONE_STORE_ID / VITE_PORTONE_CHANNEL_KEY)가 비어있습니다.'
    errorCode.value = 'ENV_MISSING'
    return
  }

  const PortOne = getPortOne()
  if (!PortOne?.requestIdentityVerification) {
    error.value = 'PortOne 브라우저 SDK가 로드되지 않았습니다. index.html CDN script를 확인하세요.'
    errorCode.value = 'SDK_NOT_LOADED'
    return
  }

  busy.value = true
  phase.value = 'start'

  try {
    const identityVerificationId = makeIdentityVerificationId()
    txId.value = identityVerificationId

    // ✅ redirectUrl을 relay로 통일 (신규 파이프라인)
    const redirectUrl =
      `${SERVICE_ORIGIN}/api/auth/pass/relay?identityVerificationId=${encodeURIComponent(identityVerificationId)}`

    // ✅ complete 폴링 먼저 시작(인증 완료 시 PassResult 생성 보장)
    void finalizeByIdentityVerificationId(identityVerificationId)

    // ✅ PortOne 시작
    const resp = await PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY,
      identityVerificationId,
      redirectUrl,
    })

    if (resp?.code) {
      stopPolling()
      busy.value = false
      phase.value = 'idle'
      error.value = resp?.message || '인증 시작 실패'
      errorCode.value = String(resp.code || 'PORTONE_FAIL')
      lastFailDetail.value = { stage: 'start:resp', raw: resp }
      return
    }

    // native일 경우 외부 열림은 SDK/환경에 따라 다르므로 별도 처리 없음.
    // (relay/appUrlOpen/message로 복귀 시 finalize가 알아서 진행)
  } catch (e: any) {
    stopPolling()
    busy.value = false
    phase.value = 'idle'
    error.value = e?.message || '인증 시작 실패'
    errorCode.value = 'PORTONE_START_ERROR'
    lastFailDetail.value = { stage: 'start:exception', message: String(e?.message || e) }
  }
}

// ====== commit ======
async function commitUpdate() {
  if (!txId.value) {
    error.value = 'txId가 없습니다. PASS 인증부터 진행하세요.'
    errorCode.value = 'NO_TXID'
    return
  }

  error.value = ''
  errorCode.value = ''
  success.value = false
  updatedFields.value = []
  phase.value = 'commit'
  busy.value = true

  try {
    const res = await fetch(apiUrl(endpointCommit), {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ txId: txId.value }),
    })

    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { throw new Error('COMMIT_NON_JSON') }

    if (!res.ok || !json?.ok) {
      if (res.status === 401) {
        error.value = '로그인이 필요합니다.'
        errorCode.value = 'UNAUTHORIZED'
        setTimeout(() => router.replace('/login'), 650)
        return
      }

      if (res.status === 410 || json?.code === 'CONSUMED') {
        error.value = '이미 사용된 인증입니다. 다시 인증을 진행해주세요.'
        errorCode.value = 'CONSUMED'
        resetPassState()
        clearPassStorage()
        return
      }

      if (json?.code === 'CI_MISMATCH' || res.status === 403) {
        error.value = '인증한 정보가 로그인한 회원정보와 다릅니다.'
        errorCode.value = 'CI_MISMATCH'
        window.alert('인증한 정보가 로그인한 회원정보와 다릅니다.')
        router.replace('/home/6page')
        return
      }

      if (json?.code === 'PHONE_NOT_CHANGED') {
        error.value = '기존의 전화번호와 같습니다.'
        errorCode.value = 'PHONE_NOT_CHANGED'
        window.alert('기존의 전화번호와 같습니다.')
        router.replace('/home/6page')
        return
      }

      error.value = json?.message || `반영 실패 (HTTP ${res.status})`
      errorCode.value = json?.code || 'COMMIT_ERROR'
      return
    }

    updatedFields.value = Array.isArray(json.updatedFields) ? json.updatedFields : []
    success.value = true
    clearPassStorage()
    await reloadMe()
    setTimeout(() => router.replace('/home/6page'), 650)
  } catch (e: any) {
    error.value = e?.message || '반영 실패'
    errorCode.value = 'COMMIT_EXCEPTION'
  } finally {
    busy.value = false
    phase.value = 'idle'
  }
}

// ====== lifecycle ======
let appUrlOpenSub: any = null

onMounted(async () => {
  clearPassStorage()
  await reloadMe()

  if (isNative) {
    appUrlOpenSub = App.addListener('appUrlOpen', handleAppUrlOpen)
  } else {
    window.addEventListener('message', handleWindowMessage)
  }

  // 혹시 URL로 identityVerificationId가 들어온 경우(예외 대응)
  const ivId = typeof route.query.identityVerificationId === 'string' ? route.query.identityVerificationId : ''
  if (ivId) {
    busy.value = true
    phase.value = 'start'
    txId.value = ivId
    certified.value = false
    await finalizeByIdentityVerificationId(ivId)
  }
})

onBeforeUnmount(() => {
  stopPolling()
  if (appUrlOpenSub) appUrlOpenSub.remove?.()
  window.removeEventListener('message', handleWindowMessage)
})
const goBack = () => {
  console.log('[phoneupdate] 뒤로가기 클릭')
  router.back()
}
</script>

<style scoped>
.container { max-width: 720px; margin: 0 auto; padding: 16px; }
.current { display: grid; gap: 6px; margin-bottom: 10px; }
.current .row { display: flex; justify-content: space-between; }
.current .label { color: #888; font-size: 12px; }
.current .value { font-weight: 700; font-size: 12px; color: var(--ion-text-color, #fff); }
.desc { opacity: .9; margin: 8px 0 12px; font-size: 12px; }
.status { margin: 8px 0 14px; }
.row { display: flex; align-items: center; gap: 8px; }
.row.error { color: var(--ion-color-danger); }
.row.success { color: var(--ion-color-success); }
.row.pending { color: #ffd26a; }
.mr-2 { margin-right: 8px; }
.actions { display: grid; gap: 8px; margin: 8px 0 10px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

/* debug box */
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
</style>
