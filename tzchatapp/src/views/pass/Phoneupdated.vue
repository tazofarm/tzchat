<!-- src/views/pass/PhoneUpdate.vue -->
<template>
  <ion-page class="phone-update">
    <ion-header>
      <ion-toolbar>
        <ion-title>전화번호 변경(PASS)</ion-title>
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
              <div class="row">
                <span class="label">통신사</span>
                <span class="value">{{ me?.carrier || '—' }}</span>
              </div>
            </div>

            <p class="desc">
              로그인된 계정에서 PASS 인증을 다시 수행해 <b>최신 전화번호/통신사</b>를 반영합니다.<br />
              인증은 <b>팝업</b>으로 열리고, 완료 시 팝업이 자동으로 닫힙니다.<br />
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
              <ion-button
                expand="block"
                :disabled="busy || certified"
                @click="onStartPass"
              >
                <ion-spinner v-if="busy && phase==='start'" name="dots" class="mr-2" />
                <span>{{ startBtnText }}</span>
              </ion-button>

              <ion-button
                expand="block"
                fill="outline"
                :disabled="busy || (!txId && errorCode!=='CI_MISMATCH')"
                @click="onSecondaryAction"
              >
                <ion-spinner v-if="busy && phase==='commit'" name="dots" class="mr-2" />
                <span>{{ secondaryBtnText }}</span>
              </ion-button>

              <ion-button
                expand="block"
                fill="clear"
                :disabled="busy"
                @click="reloadMe"
              >
                내 정보 새로고침
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent
} from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/lib/api'
import { startPass } from '@/lib/pass'

const router = useRouter()
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const apiUrl = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`

const isNative = Capacitor.isNativePlatform()
const isLocal = !isNative && ['localhost', '127.0.0.1'].includes(location.hostname)

// 🔐 Authorization 헤더
function buildAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const token =
      localStorage.getItem('TZCHAT_AUTH_TOKEN') ||
      localStorage.getItem('authToken') ||
      ''
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {}
  return headers
}

// ✅ PASS 관련 로컬 저장소 키 정리
function clearPassStorage() {
  try {
    localStorage.removeItem('PASS_RESULT_TX')
    localStorage.removeItem('PASS_FAIL')
    localStorage.removeItem('PASS_FAIL_DETAIL')
    localStorage.removeItem('PASS_TX')
    localStorage.removeItem('PASS_STATE')
  } catch {}
}

// ─────────────────────────────
// 팝업 유틸 (PassPortal과 동일 정책)
// - 현재 탭 이동 금지
// - noopener/noreferrer 금지(opener 필요)
// - 동일 이름 재사용해 중복 생성 방지
// ─────────────────────────────
const popupWin = ref(null)

function openPopup(features = '') {
  const baseFeatures = [
    'popup=yes',
    'width=480',
    'height=720',
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',')
  const final = features ? `${baseFeatures},${features}` : baseFeatures

  const w = window.open('', 'passPopup', final)
  if (!w) return null

  // 로딩 안내 화면 즉시 렌더
  try {
    w.document.open('text/html', 'replace')
    w.document.write(`
      <!doctype html>
      <meta charset="utf-8">
      <title>PASS 인증 준비중…</title>
      <style>
        html,body{height:100%;margin:0;background:#111;color:#ddd;font-family:system-ui,Segoe UI,Roboto,Apple SD Gothic Neo,Pretendard,sans-serif}
        .wrap{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}
        .small{opacity:.7;font-size:12px}
      </style>
      <div class="wrap">
        <div>PASS 인증 창을 여는 중…</div>
        <div class="small">인증이 끝나면 이 창은 자동으로 닫힙니다.</div>
      </div>
    `)
    w.document.close()
    try { w.focus() } catch {}
  } catch {}

  popupWin.value = w
  return w
}

function popupBlockedFail() {
  error.value = '팝업이 차단되었습니다. 브라우저에서 팝업을 허용하고 다시 시도하세요.'
  errorCode.value = 'POPUP_BLOCKED'
  busy.value = false
  phase.value = 'idle'
}

// 외부 URL을 팝업에서만 열기(현재 탭 이동 금지)
async function openExternal(url) {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    } catch {
      error.value = '네이티브 브라우저를 열 수 없습니다.'
      errorCode.value = 'NATIVE_BROWSER_OPEN_FAIL'
      busy.value = false
      phase.value = 'idle'
      return
    }
  }
  const w = popupWin.value && !popupWin.value.closed ? popupWin.value : openPopup()
  if (!w) { popupBlockedFail(); return }
  try { w.location.replace(url) } catch { /* 현재 탭 이동 금지: 아무것도 하지 않음 */ }
}

// formHtml을 팝업 문서로만 주입
async function openExternalFormHtml(html) {
  if (isNative) {
    error.value = '네이티브에선 URL 방식이 필요합니다.'
    errorCode.value = 'NATIVE_NEEDS_URL'
    busy.value = false
    phase.value = 'idle'
    return
  }
  const w = popupWin.value && !popupWin.value.closed ? popupWin.value : openPopup()
  if (!w) { popupBlockedFail(); return }

  try {
    w.document.open('text/html', 'replace')
    w.document.write(html) // auto-submit form 가정
    w.document.close()
  } catch (e) {
    error.value = '팝업 문서 주입에 실패했습니다.'
    errorCode.value = 'POPUP_WRITE_FAIL'
    busy.value = false
    phase.value = 'idle'
  }
}

async function closeExternal() {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.close()
    } catch {}
  }
  try {
    if (popupWin.value && !popupWin.value.closed) popupWin.value.close()
  } catch {}
  popupWin.value = null
}

// ─────────────────────────────

const me = ref(null)
const busy = ref(false)
const error = ref('')
const errorCode = ref('')
const success = ref(false)
const updatedFields = ref([])
const phase = ref('idle')

// 인증/트랜잭션 상태
const certified = ref(false)
const txId = ref('')

// 상태 폴링
const statusPoller = ref(null)
const endpointCommit = '/api/user/pass-phone/commit'

const maskedPhone = computed(() => {
  const m = me.value?.phoneMasked || ''
  const f = me.value?.phoneFormatted || ''
  if (m) return m
  if (f) return f
  const p = me.value?.phone || ''
  if (!p) return ''
  return p.replace(/(\+\d{1,3})?(\d+)(\d{4})$/, (_, c = '', mid, last) => `${c}${'*'.repeat((mid||'').length)}${last}`)
})

const startBtnText = computed(() => (certified.value ? '인증완료' : '휴대전화 인증 시작'))
const secondaryBtnText = computed(() => (errorCode.value === 'CI_MISMATCH' ? '인증 실패 · 다시 인증' : '변경 반영하기'))

function onSecondaryAction() {
  if (errorCode.value === 'CI_MISMATCH') {
    resetPassState()
    onStartPass()
  } else {
    commitUpdate()
  }
}

// ✅ 상태 폴링 (postMessage/로컬스토리지가 먼저 오면 곧바로 중단)
function stopStatusPolling() {
  if (statusPoller.value) {
    clearInterval(statusPoller.value)
    statusPoller.value = null
  }
}
function startStatusPolling(currentTxId) {
  stopStatusPolling()
  if (!currentTxId) return
  statusPoller.value = setInterval(async () => {
    try {
      const res = await fetch(apiUrl(`/api/auth/pass/status?txId=${encodeURIComponent(currentTxId)}`), {
        credentials: 'include'
      })
      const txt = await res.text()
      let j = null; try { j = JSON.parse(txt) } catch { return }
      if (!j?.ok) return

      if (j.status === 'success') {
        certified.value = true
        stopStatusPolling()
        await closeExternal()
      } else if (j.status === 'fail') {
        error.value = j?.result?.failMessage || '인증 실패'
        errorCode.value = j?.result?.failCode || 'FAIL'
        stopStatusPolling()
        await closeExternal()
      } else if (j.status === 'consumed') {
        error.value = '이미 사용된 인증입니다. 다시 인증을 진행해주세요.'
        errorCode.value = 'CONSUMED'
        stopStatusPolling()
        await closeExternal()
      }
    } catch {}
  }, 1200)
}

// postMessage & storage 핸들러 (팝업 → 본창)
function onMessage(ev) {
  try {
    const data = ev?.data || {}
    if (data?.type === 'PASS_RESULT' && data?.txId) {
      txId.value = String(data.txId)
      certified.value = true
      stopStatusPolling()
      void closeExternal()
    } else if (data?.type === 'PASS_FAIL') {
      error.value = data?.detail?.message || String(data?.reason || 'FAIL')
      errorCode.value = data?.reason || 'FAIL'
      stopStatusPolling()
      void closeExternal()
    }
  } catch {}
}
function onStorage(ev) {
  try {
    if (ev.key === 'PASS_RESULT_TX' && ev.newValue) {
      txId.value = String(ev.newValue)
      certified.value = true
      stopStatusPolling()
      void closeExternal()
    }
  } catch {}
}

function resetPassState() {
  txId.value = ''
  certified.value = false
  error.value = ''
  errorCode.value = ''
  updatedFields.value = []
  stopStatusPolling()
}

async function reloadMe() {
  try {
    const res = await api.get('/api/me', { withCredentials: true })
    me.value = res?.data?.data || res?.data?.user || res?.data || null
  } catch {
    me.value = null
  }
}

async function onStartPass() {
  if (certified.value) return
  error.value = ''
  errorCode.value = ''
  success.value = false
  updatedFields.value = []
  txId.value = ''
  phase.value = 'start'
  busy.value = true

  try {
    if (isLocal) {
      // 팝업 선오픈(차단 회피 & opener 확보)
      if (!popupWin.value || popupWin.value.closed) {
        const w = openPopup()
        if (!w) { popupBlockedFail(); return }
      }
      // 수동 입력 화면을 팝업에서 열기
      const url = router.resolve({ name: 'PassManual' }).href
      await openExternal(`${location.origin}${url}`)
      return
    }

    // 서버에서 { ok, txId, startUrl?, formHtml? } 수신
    const result = await startPass('phone_update', { preferUrl: true })
    if (!result.ok) throw new Error(result.message || '시작 실패')

    if (result.manual) {
      if (!popupWin.value || popupWin.value.closed) {
        const w = openPopup()
        if (!w) { popupBlockedFail(); return }
      }
      const url = router.resolve({ name: 'PassManual' }).href
      await openExternal(`${location.origin}${url}`)
      return
    }

    if (result.txId) {
      txId.value = String(result.txId)
      startStatusPolling(txId.value)
    }

    // 팝업에서 PASS 진행
    if (result.startUrl) {
      await openExternal(result.startUrl)
    } else if (result.formHtml) {
      await openExternalFormHtml(result.formHtml)
    } else {
      throw new Error('유효한 PASS 시작 엔트리가 없습니다.')
    }
  } catch (e) {
    console.error('[PhoneUpdate][start] error', e)
    error.value = e?.message || '시작 실패'
    if (e?.message?.includes('로그인이 필요')) setTimeout(() => router.replace('/login'), 600)
    await closeExternal()
  } finally {
    busy.value = false
    phase.value = 'idle'
  }
}

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
      body: JSON.stringify({ txId: txId.value })
    })
    const text = await res.text()
    let json = null
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
        error.value = '인증유저 정보가 로그인한 회원정보와 다릅니다'
        errorCode.value = 'CI_MISMATCH'
      } else {
        error.value = json?.message || `반영 실패 (HTTP ${res.status})`
        errorCode.value = 'COMMIT_ERROR'
      }
      return
    }

    updatedFields.value = Array.isArray(json.updatedFields) ? json.updatedFields : []
    success.value = true
    clearPassStorage()
    await reloadMe()
    await closeExternal()
    setTimeout(() => { router.replace('/home/6page') }, 650)
  } catch (e) {
    console.error('[PhoneUpdate][commit] error', e)
    error.value = e?.message || '반영 실패'
    errorCode.value = 'COMMIT_EXCEPTION'
    await closeExternal()
  } finally {
    busy.value = false
    phase.value = 'idle'
  }
}

onMounted(async () => {
  clearPassStorage()
  window.addEventListener('message', onMessage)
  window.addEventListener('storage', onStorage)
  await reloadMe()
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('storage', onStorage)
  stopStatusPolling()
  void closeExternal()
})
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
</style>
