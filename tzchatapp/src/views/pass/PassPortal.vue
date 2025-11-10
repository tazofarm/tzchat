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
            로컬은 수동 입력 팝업, 서버는 PASS 팝업에서 인증 후 결과만 이 화면으로 전달됩니다.
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

          <div v-if="lastFailCode" class="fail-code">
            실패 코드: <code>{{ lastFailCode }}</code>
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
} from '@ionic/vue';
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

/** ✅ 백엔드 절대 URL (환경별 .env에서 제공)
 *  - dev:  VITE_API_BASE_URL=http://localhost:2000
 *  - prod: VITE_API_BASE_URL=https://tzchat.tazocode.com
 */
const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const api = (path) => `${API}${path.startsWith('/') ? path : `/${path}`}`;

const busy = ref(false);
const lastFailCode = ref('');
const statusPoller = ref(null);
const openedWin = ref(null);
const heartbeat = ref(null);
const txIdRef = ref('');

// 버튼 렌더링 상태
const mode = ref('idle'); // idle | running | fail
const buttonText = computed(() => {
  if (mode.value === 'running') return '인증중…';
  if (mode.value === 'fail') return '인증 실패 · 재인증';
  return 'PASS 인증하기';
});
const buttonColor = computed(() => (mode.value === 'fail' ? 'danger' : 'primary'));

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

// postMessage 수신(성공/실패)
function handlePostMessage(ev) {
  try {
    const data = ev?.data || {};

    if (data?.type === 'PASS_FAIL') {
      lastFailCode.value = String(data?.reason || 'USER_CANCEL');
      stopPopupAndPoll();
      mode.value = 'fail';
      busy.value = false;
      return;
    }

    if (data?.type === 'PASS_RESULT' && data?.txId) {
      txIdRef.value = String(data.txId);
      stopPopupAndPoll();
      proceedRouteByTx(txIdRef.value);
      return;
    }
  } catch {}
}

// storage 폴백(성공/실패)
function handleStorage(ev) {
  try {
    if (ev.key === 'PASS_FAIL') {
      const reason = ev.newValue ? String(ev.newValue) : 'USER_CANCEL';
      localStorage.removeItem('PASS_FAIL');
      lastFailCode.value = reason || 'USER_CANCEL';
      stopPopupAndPoll();
      mode.value = 'fail';
      busy.value = false;
      return;
    }
    if (ev.key === 'PASS_RESULT_TX') {
      const tx = ev.newValue ? String(ev.newValue) : '';
      if (!tx) return;
      localStorage.removeItem('PASS_RESULT_TX');
      txIdRef.value = tx;
      stopPopupAndPoll();
      proceedRouteByTx(tx);
      return;
    }
  } catch {}
}

function startHeartbeat() {
  if (heartbeat.value) clearInterval(heartbeat.value);
  heartbeat.value = setInterval(() => {
    try {
      if (openedWin.value && openedWin.value.closed) {
        const tx = localStorage.getItem('PASS_RESULT_TX');
        const fail = localStorage.getItem('PASS_FAIL');
        if (tx) {
          localStorage.removeItem('PASS_RESULT_TX');
          txIdRef.value = String(tx);
          stopPopupAndPoll();
          proceedRouteByTx(txIdRef.value);
        } else if (fail) {
          localStorage.removeItem('PASS_FAIL');
          lastFailCode.value = String(fail);
          stopPopupAndPoll();
          mode.value = 'fail';
          busy.value = false;
        }
      }
    } catch {}
  }, 400);
}

onMounted(async () => {
  window.addEventListener('message', handlePostMessage);
  window.addEventListener('storage', handleStorage);

  const qTx = route.query.txId ? String(route.query.txId) : '';
  if (qTx) {
    txIdRef.value = qTx;
    mode.value = 'running';
    busy.value = true;
    await proceedRouteByTx(qTx);
  }

  const qFail = route.query.fail ? String(route.query.fail) : '';
  if (qFail) {
    lastFailCode.value = qFail;
    mode.value = 'fail';
    busy.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handlePostMessage);
  window.removeEventListener('storage', handleStorage);
  stopPopupAndPoll();
});

function stopPopupAndPoll() {
  if (statusPoller.value) {
    clearInterval(statusPoller.value);
    statusPoller.value = null;
  }
  if (heartbeat.value) {
    clearInterval(heartbeat.value);
    heartbeat.value = null;
  }
  try {
    if (openedWin.value && !openedWin.value.closed) openedWin.value.close();
  } catch {}
  openedWin.value = null;
}

async function onClickPass() {
  lastFailCode.value = '';
  if (busy.value) return;

  busy.value = true;
  mode.value = 'running';

  try {
    if (isLocal) {
      const manualUrl = `${location.origin}${router.resolve({ name: 'PassManual' }).href}`;
      openedWin.value = window.open(
        manualUrl,
        'PASS_AUTH',
        'width=460,height=680,menubar=no,toolbar=no,location=no,status=no'
      );
      startHeartbeat();
      return;
    }

    const resp = await fetch(api('/api/auth/pass/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ intent: 'unified' })
    });
    // start는 반드시 JSON이어야 함
    const startText = await resp.text();
    let startJson = null;
    try { startJson = JSON.parse(startText); } catch { throw new Error('START_NON_JSON'); }
    if (!resp.ok || !startJson?.ok) throw new Error(startJson?.code || 'PASS 시작 실패');

    txIdRef.value = startJson.txId;

    openedWin.value = window.open(
      startJson.redirectUrl,
      'PASS_AUTH',
      'width=460,height=680,menubar=no,toolbar=no,location=no,status=no'
    );

    startStatusPolling(txIdRef.value);
    startHeartbeat();
  } catch (e) {
    console.error(e);
    mode.value = 'fail';
    busy.value = false;
  }
}

function startStatusPolling(txId) {
  if (statusPoller.value) clearInterval(statusPoller.value);

  statusPoller.value = setInterval(async () => {
    try {
      const res = await fetch(api(`/api/auth/pass/status?txId=${encodeURIComponent(txId)}`), {
        credentials: 'include'
      });
      const t = await res.text();
      let j = null;
      try { j = JSON.parse(t); } catch { return; }
      if (!j?.ok) return;

      if (j.status === 'fail') {
        lastFailCode.value = j?.result?.failCode || 'UNKNOWN';
        stopPopupAndPoll();
        mode.value = 'fail';
        busy.value = false;
      } else if (j.status === 'success') {
        stopPopupAndPoll();
        await proceedRouteByTx(txId);
      }
    } catch (e) {
      console.warn('[poll] error', e);
    }
  }, 1500);
}

async function proceedRouteByTx(txId) {
  try {
    const res = await fetch(api(`/api/auth/pass/route?txId=${encodeURIComponent(txId)}`), {
      credentials: 'include'
    });

    // 방어: 우선 텍스트로 받고 JSON 파싱 시도 (HTML 응답 대비)
    const raw = await res.text();
    let j = null;
    try {
      j = JSON.parse(raw);
    } catch {
      console.error('Non-JSON response from /route:', raw.slice(0, 200));
      throw new Error('ROUTE_ERROR_NON_JSON');
    }

    if (!res.ok || !j?.ok) {
      lastFailCode.value = j?.code || j?.reason || 'ROUTE_ERROR';
      mode.value = 'fail';
      busy.value = false;
      return;
    }

    const next = j?.next ?? j?.route; // 하위호환
    if (next === 'pending') {
      await new Promise(r => setTimeout(r, 600));
      return proceedRouteByTx(txId);
    }
    if (next === 'signup') {
      // ✅ 쿼리 키를 txId 로 맞춤 + 세션 저장
      sessionStorage.setItem('passTxId', txId);
      busy.value = false;
      mode.value = 'idle';
      router.replace({ path: '/signup', query: { txId } });
      return;
    }
    if (next === 'templogin') {
      sessionStorage.setItem('passTxId', txId);
      router.replace({ path: '/templogin', query: { txId } });
      return;
    }

    lastFailCode.value = 'UNKNOWN_ROUTE';
    mode.value = 'fail';
    busy.value = false;
  } catch (e) {
    console.error(e);
    lastFailCode.value = e?.message || 'ROUTE_ERROR';
    mode.value = 'fail';
    busy.value = false;
  }
}

// 🔙 뒤로가기: 모든 작업 정리 후 /login 이동
function onBack() {
  stopPopupAndPoll();
  router.replace('/login');
}
</script>

<style scoped>
.container { max-width: 720px; margin: 0 auto; padding: 16px; }
.card { background: var(--ion-card-background, #1e1e1e); border-radius: 16px; padding: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
h2 { margin: 0 0 8px; }
.desc { opacity: 0.85; margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }
.fail-code { margin-top: 12px; color: var(--ion-color-danger); }
.tips { margin-top: 16px; font-size: 0.95rem; opacity: 0.9; }
.tips ul { margin: 6px 0 0 18px; }
</style>
