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
              <small>※ 안전을 위해 <b>로그인 후 반드시 비밀번호를 변경</b>해 주세요. (마이페이지 &gt; 보안 &gt; 비밀번호 변경)</small>
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
              <div v-if="!txId" class="row error">PASS 인증이 필요합니다. 포털에서 인증을 먼저 진행하세요.</div>
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
} from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

/** ✅ 백엔드 절대 URL (.env.*)
 *  dev:  VITE_API_BASE_URL=http://localhost:2000
 *  prod: VITE_API_BASE_URL=https://tzchat.tazocode.com
 */
const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const api = (path) => `${API}${path.startsWith('/') ? path : `/${path}`}`;

// ✅ txId: 쿼리 'txId' 우선, 없으면 세션스토리지 폴백
function readInitialTxId() {
  const q = route.query?.txId ? String(route.query.txId) : '';
  if (q) return q;
  try {
    const s = sessionStorage.getItem('passTxId') || '';
    return s;
  } catch { return ''; }
}
const txId = ref(readInitialTxId());

const busy = ref(false);
const error = ref('');
const success = ref(false);
const redirectInfo = ref('');
const endpointTried = ref('');

// ❌ 자동 시도 제거: 사용자가 버튼을 눌러 시도하도록 유지
onMounted(() => {
  // 안내만, 자동 로그인 시도는 하지 않음.
});

async function tryTempLogin() {
  error.value = '';
  success.value = false;
  endpointTried.value = '';
  if (!txId.value) {
    error.value = 'txId가 없습니다. PASS 인증부터 진행하세요.';
    return;
  }
  busy.value = true;

  // ✅ 백엔드 고정 경로: /api/auth/pass/temp-login
  const ENDPOINT = '/api/auth/pass/temp-login';
  endpointTried.value = ENDPOINT;

  try {
    const resp = await fetch(api(ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // httpOnly 쿠키 수신
      body: JSON.stringify({ txId: txId.value })
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `HTTP ${resp.status}`);
    }

    const json = await resp.json();
    if (!json?.ok) {
      throw new Error(json?.message || '임시로그인 실패');
    }

    if (json.token) {
      try { localStorage.setItem('authToken', json.token); } catch {}
    }

    success.value = true;

    // 이동 규칙
    const backable = window.history.length > 1;
    redirectInfo.value = backable ? '이전 화면' : '/home';

    setTimeout(() => {
      if (backable) router.back();
      else router.replace('/home');
    }, 650);
  } catch (e) {
    console.error('[TempLogin] error', e);
    error.value = e?.message || '알 수 없는 오류';
  } finally {
    busy.value = false;
  }
}

function goPass() {
  router.replace({ name: 'PassPortal' });
}

function goBack() {
  const backable = window.history.length > 1;
  if (backable) router.back();
  else router.replace('/home');
}
</script>

<style scoped>
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}
.desc { opacity: 0.9; margin-bottom: 12px; }
.status { margin: 10px 0 16px; }
.row { display: flex; align-items: center; gap: 8px; }
.row.error { color: var(--ion-color-danger); }
.row.success { color: var(--ion-color-success); }
.mr-2 { margin-right: 8px; }
.actions { display: grid; gap: 10px; margin-top: 8px; }
.meta { margin-top: 14px; font-size: 0.9rem; opacity: 0.85; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
</style>
