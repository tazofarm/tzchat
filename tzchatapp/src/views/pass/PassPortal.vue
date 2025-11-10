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

        <!-- 🔎 실시간 디버그 패널 -->
        <div class="debug" v-if="showDebug">
          <h3>디버그</h3>
          <ul>
            <li><b>mode</b>: {{ mode }}</li>
            <li><b>txId</b>: {{ txIdRef || '—' }}</li>
            <li><b>lastFailCode</b>: {{ lastFailCode || '—' }}</li>
            <li><b>lastEventAt</b>: {{ lastEventAtStr || '—' }}</li>
          </ul>
          <div class="btns">
            <ion-button size="small" @click="forceStatusCheck" :disabled="!txIdRef">강제 상태 확인</ion-button>
            <ion-button size="small" @click="resetState" color="medium">상태 초기화</ion-button>
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
import { Capacitor } from '@capacitor/core';

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
const watchdog = ref(null);
const txIdRef = ref('');
const lastEventAt = ref(0);

// 버튼 렌더링 상태
const mode = ref('idle'); // idle | running | fail
const buttonText = computed(() => {
  if (mode.value === 'running') return '인증중…';
  if (mode.value === 'fail') return '인증 실패 · 재인증';
  return 'PASS 인증하기';
});
const buttonColor = computed(() => (mode.value === 'fail' ? 'danger' : 'primary'));

// ✅ 앱(네이티브) 여부 우선 판단 → 앱이면 항상 서버 PASS
const isNative = Capacitor.isNativePlatform();
// ✅ 웹(브라우저)에서만 localhost 판단
const isLocal = !isNative && ['localhost', '127.0.0.1'].includes(location.hostname);

// 개발 중 디버그 패널 항상 표시 권장
const showDebug = true;
const lastEventAtStr = computed(() => (lastEventAt.value ? new Date(lastEventAt.value).toLocaleString() : ''));

// 공통 업데이트
function markEvent() { lastEventAt.value = Date.now(); }

// 🔔 워치독: 콜백/폴백 미수신 시 강제 실패로 전환
function startWatchdog() {
  clearWatchdog();
  watchdog.value = setTimeout(() => {
    // 아직도 결과/txId 둘 다 없으면 실패 처리
    if (!txIdRef.value) {
      lastFailCode.value = 'CALLBACK_TIMEOUT';
      mode.value = 'fail';
      busy.value = false;
      stopPopupAndPoll();
    }
  }, 15000); // 15초
}
function clearWatchdog() {
  if (watchdog.value) {
    clearTimeout(watchdog.value);
    watchdog.value = null;
  }
}

// postMessage 수신 (신규: PASS_RESULT 단일 포맷, 구버전 호환: PASS_FAIL)
function handlePostMessage(ev) {
  try {
    const data = ev?.data || {};
    if (!data) return;

    // 🔙 하위호환: PASS_FAIL
    if (data.type === 'PASS_FAIL') {
      markEvent();
      lastFailCode.value = String(data?.reason || 'USER_CANCEL');
      mode.value = 'fail';
      busy.value = false;
      stopPopupAndPoll();
      clearWatchdog();
      return;
    }

    // ✅ 권장: PASS_RESULT { ok, txId, code? }
    if (data.type === 'PASS_RESULT') {
      markEvent();
      if (data.ok === false) {
        lastFailCode.value = String(data.code || 'FAIL');
        mode.value = 'fail';
        busy.value = false;
        stopPopupAndPoll();
        clearWatchdog();
        return;
      }
      if (data.ok === true && data.txId) {
        txIdRef.value = String(data.txId);
        stopPopupAndPoll();
        clearWatchdog();
        proceedRouteByTx(txIdRef.value);
        return;
      }
    }
  } catch {}
}

// storage 폴백 (서버에서 항상 PASS_RESULT_FALLBACK 저장하도록 권장)
function handleStorage(ev) {
  try {
    if (ev.key !== 'PASS_RESULT_FALLBACK') return;
    const raw = ev.newValue;
    if (!raw) return;
    localStorage.removeItem('PASS_RESULT_FALLBACK');

    let data = null;
    try { data = JSON.parse(raw); } catch { return; }
    if (!data || data.type !== 'PASS_RESULT') return;

    markEvent();
    if (data.ok === false) {
      lastFailCode.value = String(data.code || 'FAIL');
      mode.value = 'fail';
      busy.value = false;
      stopPopupAndPoll();
      clearWatchdog();
      return;
    }
    if (data.ok === true && data.txId) {
      txIdRef.value = String(data.txId);
      stopPopupAndPoll();
      clearWatchdog();
      proceedRouteByTx(txIdRef.value);
      return;
    }
  } catch {}
}

function startHeartbeat() {
  if (heartbeat.value) clearInterval(heartbeat.value);
  heartbeat.value = setInterval(() => {
    try {
      // 팝업이 닫혔을 때도 폴백 키 확인
      if (openedWin.value && openedWin.value.closed) {
        const raw = localStorage.getItem('PASS_RESULT_FALLBACK');
        if (raw) {
          localStorage.removeItem('PASS_RESULT_FALLBACK');
          let data = null;
          try { data = JSON.parse(raw); } catch {}
          if (data && data.type === 'PASS_RESULT') {
            markEvent();
            if (data.ok === false) {
              lastFailCode.value = String(data.code || 'FAIL');
              mode.value = 'fail';
              busy.value = false;
              stopPopupAndPoll();
              clearWatchdog();
            } else if (data.ok === true && data.txId) {
              txIdRef.value = String(data.txId);
              stopPopupAndPoll();
              clearWatchdog();
              proceedRouteByTx(txIdRef.value);
            }
          }
        }
      }
    } catch {}
  }, 400);
}

function startStatusPolling(txId) {
  if (!txId) return;
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
        markEvent();
        lastFailCode.value = j?.result?.failCode || 'UNKNOWN';
        stopPopupAndPoll();
        clearWatchdog();
        mode.value = 'fail';
        busy.value = false;
      } else if (j.status === 'success') {
        stopPopupAndPoll();
        clearWatchdog();
        await proceedRouteByTx(txId);
      }
    } catch (e) {
      console.warn('[poll] error', e);
    }
  }, 1500);
}

onMounted(async () => {
  window.addEventListener('message', handlePostMessage);
  window.addEventListener('storage', handleStorage);

  // 쿼리로 txId 전달되어 들어온 경우 즉시 분기
  const qTx = route.query.txId ? String(route.query.txId) : '';
  if (qTx) {
    txIdRef.value = qTx;
    mode.value = 'running';
    busy.value = true;
    startStatusPolling(qTx);
    startWatchdog();
    await proceedRouteByTx(qTx);
  }

  // 쿼리로 실패 코드가 들어온 경우
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
  clearWatchdog();
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

async function forceStatusCheck() {
  if (!txIdRef.value) return;
  try {
    const res = await fetch(api(`/api/auth/pass/status?txId=${encodeURIComponent(txIdRef.value)}`), {
      credentials: 'include'
    });
    const j = await res.json();
    markEvent();
    if (j?.status === 'fail') {
      lastFailCode.value = j?.result?.failCode || 'UNKNOWN';
      mode.value = 'fail';
      busy.value = false;
      stopPopupAndPoll();
      clearWatchdog();
    } else if (j?.status === 'success') {
      stopPopupAndPoll();
      clearWatchdog();
      await proceedRouteByTx(txIdRef.value);
    }
  } catch {}
}

function resetState() {
  stopPopupAndPoll();
  clearWatchdog();
  txIdRef.value = '';
  lastFailCode.value = '';
  busy.value = false;
  mode.value = 'idle';
  lastEventAt.value = 0;
}

async function proceedRouteByTx(txId) {
  try {
    const res = await fetch(api(`/api/auth/pass/route?txId=${encodeURIComponent(txId)}`), {
      credentials: 'include'
    });
    const txt = await res.text();
    let j = null;
    try { j = JSON.parse(txt); } catch { throw new Error('ROUTE_NON_JSON'); }
    if (!j?.ok) throw new Error(j?.code || 'ROUTE_ERROR');

    const next = j.next;
    if (next === 'signup') {
      router.replace({ name: 'Signup', query: { passTxId: txId } });
    } else if (next === 'templogin') {
      router.replace({ name: 'Home' });
    } else if (next === 'pending') {
      // 계속 대기(이상 시 폴링 유지)
      if (!statusPoller.value) startStatusPolling(txId);
    } else {
      throw new Error('ROUTE_UNKNOWN');
    }
  } catch (e) {
    lastFailCode.value = e?.message || 'ROUTE_ERROR';
    mode.value = 'fail';
    busy.value = false;
  }
}

async function onClickPass() {
  lastFailCode.value = '';
  if (busy.value) return;

  busy.value = true;
  mode.value = 'running';
  startWatchdog();

  try {
    // ✅ 앱이면 항상 서버 PASS. 웹에서만 localhost → 수동 PASS
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

    const startText = await resp.text();
    let startJson = null;
    try { startJson = JSON.parse(startText); } catch { throw new Error('START_NON_JSON'); }
    if (!resp.ok || !startJson?.ok || !startJson?.formHtml) {
      throw new Error(startJson?.code || 'START_ERROR');
    }

    // txId가 없더라도 콜백 이벤트로 회복 가능 → 폴링은 txId 있을 때만
    txIdRef.value = startJson.txId || '';

    openedWin.value = window.open(
      '',
      'PASS_AUTH',
      'width=460,height=680,menubar=no,toolbar=no,location=no,status=no'
    );
    if (!openedWin.value) throw new Error('POPUP_BLOCKED');

    openedWin.value.document.open();
    openedWin.value.document.write(String(startJson.formHtml));
    openedWin.value.document.close();

    if (txIdRef.value) startStatusPolling(txIdRef.value);
    startHeartbeat();
  } catch (e) {
    lastFailCode.value = e?.message || 'START_ERROR';
    mode.value = 'fail';
    busy.value = false;
    clearWatchdog();
  }
}

// 🔙 뒤로가기
function onBack() {
  stopPopupAndPoll();
  clearWatchdog();
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

.debug { margin-top: 16px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.05); }
.debug h3 { margin: 0 0 8px; font-size: 1rem; opacity: 0.9; }
.debug ul { margin: 0; padding-left: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.88rem; }
.debug .btns { margin-top: 10px; display: flex; gap: 8px; }
</style>
