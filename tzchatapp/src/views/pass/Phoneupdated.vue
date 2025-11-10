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
              이 화면은 로그인된 계정의 <b>전화번호 변경</b>에 사용됩니다.<br />
              PASS 인증 완료 후 동일 CI 여부를 확인하여, 제공된 <b>최신 전화번호/통신사</b>를 계정에 즉시 반영합니다.<br />
              <small>※ 보안상, PASS 결과의 CI가 현재 계정의 CI와 다르면 반영되지 않습니다.</small>
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

            <!-- ▼ 디버그/가이드는 화면 노이즈 방지를 위해 유지 주석 ▼
            <div class="meta">
              <div>txId: <code>{{ txId || '(없음)' }}</code></div>
              <div v-if="endpointStart">start: <code>{{ endpointStart }}</code></div>
              <div v-if="endpointCommit">commit: <code>{{ endpointCommit }}</code></div>
              <div v-if="updatedFields.length">갱신: <code>{{ updatedFields.join(', ') }}</code></div>
            </div>
            -->
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
import { api } from '@/lib/api'

const router = useRouter()

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const apiUrl = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`

// 🔐 로컬/웹 공통 Authorization 헤더 구성
function buildAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const token = localStorage.getItem('authToken')
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {}
  return headers
}

// ✅ PASS 관련 로컬 저장소 키 정리(콜백 복귀 후 잔여 키 제거)
function clearPassStorage() {
  try {
    localStorage.removeItem('PASS_RESULT_TX')
    localStorage.removeItem('PASS_FAIL')
    localStorage.removeItem('PASS_TX')
    localStorage.removeItem('PASS_STATE')
  } catch {}
}

const me = ref(null)
const busy = ref(false)
const error = ref('')
const errorCode = ref('')
const success = ref(false)
const updatedFields = ref([])
const phase = ref('idle')
const certified = ref(false)

const txId = ref('')
const openedWin = ref(null)
const heartbeat = ref(null)

const endpointStart = '/api/user/pass-phone/start'
const endpointCommit = '/api/user/pass-phone/commit'

const maskedPhone = computed(() => {
  const p = me.value?.phone || ''
  if (!p) return ''
  return p.replace(/(\+\d{1,3})?(\d+)(\d{4})$/, (_, c = '', m, last) => `${c}${'*'.repeat((m||'').length)}${last}`)
})
const updatedFieldsLabel = computed(() => updatedFields.value.length ? updatedFields.value.join(', ') : '변경 없음')

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

function stopHeartbeat() {
  if (heartbeat.value) {
    clearInterval(heartbeat.value)
    heartbeat.value = null
  }
  try { if (openedWin.value && !openedWin.value.closed) openedWin.value.close() } catch {}
  openedWin.value = null
}

function startHeartbeat() {
  if (heartbeat.value) clearInterval(heartbeat.value)
  heartbeat.value = setInterval(() => {
    try {
      if (openedWin.value && openedWin.value.closed) {
        const tx = localStorage.getItem('PASS_RESULT_TX')
        const fail = localStorage.getItem('PASS_FAIL')
        if (tx) {
          localStorage.removeItem('PASS_RESULT_TX')
          txId.value = String(tx)
          certified.value = true
          stopHeartbeat()
        } else if (fail) {
          localStorage.removeItem('PASS_FAIL')
          error.value = 'PASS 인증이 취소되었거나 실패했습니다.'
          errorCode.value = 'USER_CANCEL'
          stopHeartbeat()
        }
      }
    } catch {}
  }, 400)
}

function handlePostMessage(ev) {
  try {
    const data = ev?.data || {}
    if (data?.type === 'PASS_RESULT' && data?.txId) {
      txId.value = String(data.txId)
      certified.value = true
      stopHeartbeat()
    } else if (data?.type === 'PASS_FAIL') {
      error.value = String(data?.reason || 'USER_CANCEL')
      errorCode.value = 'USER_CANCEL'
      stopHeartbeat()
    }
  } catch {}
}

function resetPassState() {
  txId.value = ''
  certified.value = false
  error.value = ''
  errorCode.value = ''
  updatedFields.value = []
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
    // ✅ 네이티브(앱) 우선: 앱이면 항상 서버 PASS 사용
    const isNative = Capacitor.isNativePlatform()
    const isLocal = !isNative && ['localhost', '127.0.0.1'].includes(location.hostname)

    if (isLocal) {
      const url = router.resolve({ name: 'PassManual' }).href
      openedWin.value = window.open(
        `${location.origin}${url}`,
        'PASS_PHONE',
        'width=460,height=680,menubar=no,toolbar=no,location=no,status=no'
      )
      startHeartbeat()
      return
    }

    const res = await fetch(apiUrl(endpointStart), {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include'
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { throw new Error('START_NON_JSON') }
    if (!res.ok || !json?.ok) {
      if (res.status === 401) throw new Error('로그인이 필요합니다.')
      throw new Error(json?.message || '시작 실패')
    }

    // 서버가 내려주는 PASS 이동 URL(또는 form HTML 처리 후의 최종 URL)
    openedWin.value = window.open(
      json.redirectUrl,
      'PASS_PHONE',
      'width=460,height=680,menubar=no,toolbar=no,location=no,status=no'
    )
    startHeartbeat()
  } catch (e) {
    console.error('[PhoneUpdate][start] error', e)
    error.value = e?.message || '시작 실패'
    if (e?.message?.includes('로그인이 필요')) {
      setTimeout(() => router.replace('/login'), 600)
    }
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
      // 🔁 410 consumed 대응: 재사용 불가 → 재인증 유도
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
        errorCode.value = json?.code || 'COMMIT_ERROR'
      }
      return
    }

    // 성공 처리
    updatedFields.value = Array.isArray(json.updatedFields) ? json.updatedFields : (json?.profileUpdate?.updatedFields || [])
    success.value = true

    // 세션/스토리지 정리
    clearPassStorage()
    await reloadMe()

    // 완료 후 이동
    setTimeout(() => { router.replace('/home/6page') }, 650)
  } catch (e) {
    console.error('[PhoneUpdate][commit] error', e)
    error.value = e?.message || '반영 실패'
    errorCode.value = 'COMMIT_EXCEPTION'
  } finally {
    busy.value = false
    phase.value = 'idle'
  }
}

onMounted(async () => {
  // 콜백 복귀 시 잔여 스토리지 정리 → 중복 커밋/재사용 방지
  clearPassStorage()
  window.addEventListener('message', handlePostMessage)
  await reloadMe()
})
onBeforeUnmount(() => {
  window.removeEventListener('message', handlePostMessage)
  stopHeartbeat()
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
/* .meta 섹션은 템플릿에서 주석 처리됨 */
code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
</style>
