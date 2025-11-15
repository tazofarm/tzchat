<!-- src/views/TempLogin.vue -->
<template>
  <ion-page class="temp-login">
    <ion-header>
      <ion-toolbar>
        <ion-title>임시로그인</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>PASS 인증 결과로 로그인</ion-card-title>
            <ion-card-subtitle>txId 기반 임시 세션 발급</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <p class="desc">
              PASS 포털에서 전달된 <b>txId</b>로 임시로그인을 진행합니다.<br />
              <b>아래 버튼을 눌러</b> 임시로그인을 시도하세요.<br />
              <small>※ 안전을 위해 <b>로그인 후 반드시 비밀번호를 변경</b>해 주세요.
                (마이페이지 &gt; 보안 &gt; 비밀번호 변경)</small>
            </p>

            <div class="status">
              <div v-if="busy" class="row">
                <ion-spinner name="dots" class="mr-2" />
                <span>로그인 처리중…</span>
              </div>

              <div v-else-if="error" class="row error">
                <span>로그인 실패: {{ error }}</span>
              </div>

              <div v-else-if="success" class="row success">
                <span>로그인 성공! 이동합니다…</span>
              </div>

              <div v-else class="row">
                <span>대기중: 아래 버튼으로 진행하세요.</span>
              </div>
            </div>

            <div class="actions">
              <ion-button
                expand="block"
                :disabled="busy || !txId"
                @click="tryTempLogin"
              >
                <ion-spinner v-if="busy" name="dots" class="mr-2" />
                <span>임시로그인 시도</span>
              </ion-button>

              <ion-button
                expand="block"
                fill="outline"
                :disabled="busy"
                @click="goPass"
              >
                PASS 다시 인증하기
              </ion-button>

              <ion-button
                expand="block"
                fill="clear"
                :disabled="busy"
                @click="goBack"
              >
                뒤로가기
              </ion-button>
            </div>

            <div class="meta">
              <div>txId: <code>{{ txId || '(없음)' }}</code></div>
              <div v-if="endpointTried">엔드포인트: <code>{{ endpointTried }}</code></div>
              <div v-if="redirectInfo">이동 대상: <code>{{ redirectInfo }}</code></div>
              <div v-if="!txId" class="row error">
                PASS 인증이 필요합니다. 포털에서 인증을 먼저 진행하세요.
              </div>
            </div>

            <!-- 🔎 디버그 패널: PASS 결과 + 매칭된 유저 정보 (나중에 주석처리 예정) -->
            <div v-if="passResult || debugUser" class="debug-panel">
              <h3>PASS 결과 (PassResult)</h3>

              <ul v-if="passResult && passResult.result" class="kv">
                <li>
                  <span class="k">status</span>
                  <span class="v">{{ passResult.result.status }}</span>
                </li>
                <li v-if="passResult.result.name">
                  <span class="k">name</span>
                  <span class="v">{{ passResult.result.name }}</span>
                </li>
                <li v-if="passResult.result.birthyear">
                  <span class="k">birthyear</span>
                  <span class="v">{{ passResult.result.birthyear }}</span>
                </li>
                <li v-if="passResult.result.gender">
                  <span class="k">gender</span>
                  <span class="v">{{ passResult.result.gender }}</span>
                </li>
                <li v-if="passResult.result.phone">
                  <span class="k">phone</span>
                  <span class="v">{{ passResult.result.phone }}</span>
                </li>
                <li v-if="passResult.result.carrier">
                  <span class="k">carrier</span>
                  <span class="v">{{ passResult.result.carrier }}</span>
                </li>
                <li v-if="passResult.result.ciHash">
                  <span class="k">ciHash</span>
                  <span class="v mono">{{ passResult.result.ciHash }}</span>
                </li>
              </ul>

              <div class="route-summary">
                <div>
                  route:
                  <code>{{ routeName || '(없음)' }}</code>
                </div>
                <div v-if="userExists !== null">
                  userExists:
                  <code>{{ String(userExists) }}</code>
                </div>
              </div>

              <details v-if="passResult">
                <summary>PASS 전체 JSON 보기</summary>
                <pre class="raw">{{ pretty(passResult) }}</pre>
              </details>

              <div v-if="debugUser" class="user-panel">
                <h3>동일 CI 매칭 유저 정보 (디버그)</h3>
                <ul class="kv">
                  <li>
                    <span class="k">userId</span>
                    <span class="v mono">{{ debugUser._id }}</span>
                  </li>
                  <li v-if="debugUser.nickname">
                    <span class="k">닉네임</span>
                    <span class="v">{{ debugUser.nickname }}</span>
                  </li>
                  <li v-if="debugUser.phone">
                    <span class="k">phone</span>
                    <span class="v">{{ debugUser.phone }}</span>
                  </li>
                  <li v-if="debugUser.carrier">
                    <span class="k">carrier</span>
                    <span class="v">{{ debugUser.carrier }}</span>
                  </li>
                  <li v-if="debugUser.gender">
                    <span class="k">gender</span>
                    <span class="v">{{ debugUser.gender }}</span>
                  </li>
                  <li v-if="debugUser.birthyear">
                    <span class="k">birthyear</span>
                    <span class="v">{{ debugUser.birthyear }}</span>
                  </li>
                  <li v-if="debugUser.level">
                    <span class="k">level</span>
                    <span class="v">{{ debugUser.level }}</span>
                  </li>
                  <li v-if="debugUser.createdAt">
                    <span class="k">createdAt</span>
                    <span class="v">{{ debugUser.createdAt }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <!-- 🔎 디버그 패널 끝 -->
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  toastController
} from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

/** ✅ 백엔드 절대 URL (.env.*)
 *  dev:  VITE_API_BASE_URL=http://localhost:2000
 *  prod: VITE_API_BASE_URL=https://tzchat.tazocode.com
 */
const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const api = (path: string) => `${API}${path.startsWith('/') ? path : `/${path}`}`

const LS_KEYS = {
  TX: 'pass.txId',
  INTENT: 'pass.intent',
  ROUTE: 'pass.route',
  // 이전 버전 호환
  TX_OLD: 'passTxId'
}

// ✅ txId: 쿼리 'txId' 우선 → session/localStorage('pass.txId') → 구키('passTxId')
function readInitialTxId (): string {
  const q = route.query?.txId ? String(route.query.txId) : ''
  if (q) return q
  try {
    const s1 = sessionStorage.getItem(LS_KEYS.TX) || ''
    if (s1) return s1
  } catch {}
  try {
    const l1 = localStorage.getItem(LS_KEYS.TX) || ''
    if (l1) return l1
  } catch {}
  // 구버전 호환
  try {
    const sOld = sessionStorage.getItem(LS_KEYS.TX_OLD) || ''
    if (sOld) return sOld
  } catch {}
  try {
    const lOld = localStorage.getItem(LS_KEYS.TX_OLD) || ''
    if (lOld) return lOld
  } catch {}
  return ''
}

function clearPassStorage () {
  try {
    sessionStorage.removeItem(LS_KEYS.TX)
    sessionStorage.removeItem(LS_KEYS.INTENT)
    sessionStorage.removeItem(LS_KEYS.ROUTE)
    sessionStorage.removeItem(LS_KEYS.TX_OLD)
  } catch {}
  try {
    localStorage.removeItem(LS_KEYS.TX)
    localStorage.removeItem(LS_KEYS.INTENT)
    localStorage.removeItem(LS_KEYS.ROUTE)
    localStorage.removeItem(LS_KEYS.TX_OLD)
  } catch {}
}

const txId = ref<string>(readInitialTxId())

const busy = ref(false)
const error = ref('')
const success = ref(false)
const redirectInfo = ref('')
const endpointTried = ref('')

// 디버그용 PASS / 유저 정보
const passResult = ref<any | null>(null)
const debugUser = ref<any | null>(null)
const routeName = ref<string>('')
const userExists = ref<boolean | null>(null)

const pretty = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

// ❌ 자동 시도 없음: 사용자가 명시적으로 버튼을 눌러 진행
onMounted(async () => {
  // 안내 + 디버그용 데이터 로딩
  if (!txId.value) return

  // PASS 결과
  try {
    const res = await fetch(
      api(`/api/auth/pass/result/${encodeURIComponent(txId.value)}`),
      { credentials: 'include' }
    )
    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      json = { ok: false, raw: text }
    }
    passResult.value = json
  } catch (e: any) {
    passResult.value = { ok: false, error: String(e?.message || e) }
  }

  // route + 디버그 유저
  try {
    const res = await fetch(
      api(`/api/auth/pass/route?txId=${encodeURIComponent(txId.value)}&debug=1`),
      { credentials: 'include' }
    )
    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      json = { ok: false, raw: text }
    }

    if (json?.debugUser) {
      debugUser.value = json.debugUser
    }
    if (typeof json?.route === 'string') {
      routeName.value = json.route
    }
    if (typeof json?.userExists === 'boolean') {
      userExists.value = json.userExists
    }
  } catch (e: any) {
    // 디버그용이므로 실패해도 치명적이지 않음
  }
})

async function toast (
  message: string,
  color: 'primary' | 'success' | 'warning' | 'danger' = 'primary'
) {
  const t = await toastController.create({
    message,
    color,
    duration: 1800,
    position: 'bottom'
  })
  await t.present()
}

async function tryTempLogin () {
  error.value = ''
  success.value = false
  endpointTried.value = ''
  if (!txId.value) {
    error.value = 'txId가 없습니다. PASS 인증부터 진행하세요.'
    await toast(error.value, 'warning')
    return
  }
  busy.value = true

  // ✅ 백엔드 고정 경로: /api/auth/pass/temp-login
  const ENDPOINT = '/api/auth/pass/temp-login'
  endpointTried.value = ENDPOINT

  try {
    const resp = await fetch(api(ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // httpOnly 쿠키 수신
      body: JSON.stringify({ txId: txId.value })
    })

    // 상세 에러 파싱
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`
      try {
        const maybe = await resp.json()
        msg = maybe?.message || maybe?.code || msg
        if (
          resp.status === 410 ||
          String(maybe?.code || '').toUpperCase().includes('CONSUMED')
        ) {
          msg = '이 인증 토큰은 이미 사용되었습니다.(410 consumed)'
        }
      } catch {
        try {
          const text = await resp.text()
          if (text) msg = text
        } catch {}
      }
      throw new Error(msg)
    }

    const json = await resp.json()
    if (!json?.ok) {
      throw new Error(json?.message || '임시로그인 실패')
    }

    // 토큰 병행(백엔드는 httpOnly 쿠키도 발행)
    if (json.token) {
      try {
        localStorage.setItem('authToken', json.token)
      } catch {}
    }

    // 민감 상태 정리
    clearPassStorage()

    success.value = true

    // 이동 규칙
    const backable = window.history.length > 1
    redirectInfo.value = backable ? '이전 화면' : '/home'

    setTimeout(() => {
      if (backable) router.back()
      else router.replace('/home')
    }, 650)
  } catch (e: any) {
    console.error('[TempLogin] error', e)
    const raw = String(e?.message || '알 수 없는 오류')
    if (/410|consumed/i.test(raw)) {
      error.value = '이미 사용된 인증입니다. PASS를 다시 인증해 주세요.'
    } else if (/UNHANDLED_ERROR/i.test(raw)) {
      error.value = '서버 내부 오류(UNHANDLED_ERROR). 잠시 후 다시 시도해 주세요.'
    } else if (/NOT_SUCCESS|NO_TX|NO_ROUTE|NO_RESULT/i.test(raw)) {
      error.value = '유효하지 않은 인증 결과입니다. PASS를 다시 진행해 주세요.'
    } else {
      error.value = raw
    }
    await toast(error.value, 'danger')
  } finally {
    busy.value = false
  }
}

function goPass () {
  router.replace({ name: 'PassPortal' })
}

function goBack () {
  const backable = window.history.length > 1
  if (backable) router.back()
  else router.replace('/home')
}
</script>

<style scoped>
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}
.desc {
  opacity: 0.9;
  margin-bottom: 12px;
}
.status {
  margin: 10px 0 16px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row.error {
  color: var(--ion-color-danger);
}
.row.success {
  color: var(--ion-color-success);
}
.mr-2 {
  margin-right: 8px;
}
.actions {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}
.meta {
  margin-top: 14px;
  font-size: 0.9rem;
  opacity: 0.85;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', monospace;
}

.debug-panel {
  margin-top: 18px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(0, 128, 255, 0.06);
  border: 1px solid rgba(0, 128, 255, 0.25);
  font-size: 0.9rem;
}
.debug-panel h3 {
  margin: 4px 0 6px;
  font-size: 0.95rem;
}
.kv {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
}
.kv li {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px;
  padding: 2px 0;
}
.kv .k {
  opacity: 0.7;
}
.kv .v {
  word-break: break-all;
}
.kv .v.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', monospace;
}
.raw {
  margin: 6px 0 0;
  max-height: 200px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.06);
  padding: 8px;
  border-radius: 8px;
}
.user-panel {
  margin-top: 10px;
}
.route-summary {
  margin: 6px 0 8px;
  font-size: 0.85rem;
  opacity: 0.9;
}
.route-summary code {
  font-size: 0.8rem;
}
</style>
