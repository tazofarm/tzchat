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

          <!-- ⬇️ 실패 상세 패널 -->
          <div v-if="hasDetail" class="fail-detail">
            <h3>실패 상세</h3>
            <ul class="kv">
              <li v-if="detail.code"><span class="k">code</span><span class="v">{{ detail.code }}</span></li>
              <li v-if="detail.stage"><span class="k">stage</span><span class="v">{{ detail.stage }}</span></li>
              <li v-if="detail.message"><span class="k">message</span><span class="v">{{ detail.message }}</span></li>
              <li v-if="detail.returnMsg"><span class="k">returnMsg</span><span class="v">{{ detail.returnMsg }}</span></li>
              <li v-if="detail.stackTop"><span class="k">stackTop</span><span class="v">{{ detail.stackTop }}</span></li>
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
const lastFailDetail = ref(null); // { code, stage, message, returnMsg, stackTop, raw }
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

// ⬇️ 상세 표시용 계산값/헬퍼
const detail = computed(() => lastFailDetail.value || {});
const hasDetail = computed(() => !!lastFailDetail.value);
const pretty = (obj) => {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
};

// ✅ 앱(네이티브) 여부 우선 판단 → 앱이면 항상 서버 PASS
const isNative = Capacitor.isNativePlatform();
// ✅ 웹(브라우저)에서만 localhost 판단
const isLocal = !isNative && ['localhost', '127.0.0.1'].includes(location.hostname);

// ────────────────────────────────────────────────────────────
// 보조 유틸: PASS 관련 키 정리 (서버 소모형과 별개로 프론트 찌꺼기 제거)
// ────────────────────────────────────────────────────────────
function clearPassKeys() {
  try {
    sessionStorage.removeItem('passTxId');
    sessionStorage.removeItem('pass.intent');
  } catch {}
  try {
    localStorage.removeItem('PASS_RESULT_TX');
    localStorage.removeItem('PASS_FAIL');
    localStorage.removeItem('PASS_FAIL_DETAIL');
  } catch {}
}

// postMessage 수신(성공/실패)
function handlePostMessage(ev) {
  try {
    const data = ev?.data || {};

    if (data?.type === 'PASS_FAIL') {
      lastFailCode.value = String(data?.reason || 'USER_CANCEL');
      // 상세 객체 포함 시 저장
      if (data?.detail && typeof data.detail === 'object') {
        lastFailDetail.value = data.detail;
      } else {
        // 폴백: localStorage PASS_FAIL_DETAIL 확인
        try {
          const s = localStorage.getItem('PASS_FAIL_DETAIL');
          if (s) lastFailDetail.value = JSON.parse(s);
          localStorage.removeItem('PASS_FAIL_DETAIL');
        } catch {}
      }
      stopPopupAndPoll();
      clearPassKeys();
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
      // 함께 저장된 상세가 있으면 읽기
      try {
        const s = localStorage.getItem('PASS_FAIL_DETAIL');
        if (s) lastFailDetail.value = JSON.parse(s);
        localStorage.removeItem('PASS_FAIL_DETAIL');
      } catch {}
      stopPopupAndPoll();
      clearPassKeys();
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
          // 닫힐 때 남긴 상세도 함께 수거
          try {
            const s = localStorage.getItem('PASS_FAIL_DETAIL');
            if (s) lastFailDetail.value = JSON.parse(s);
            localStorage.removeItem('PASS_FAIL_DETAIL');
          } catch {}
          stopPopupAndPoll();
          clearPassKeys();
          mode.value = 'fail';
          busy.value = false;
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

      if (j.status === 'consumed') {
        // 서버에서 이미 소모됨 → 재시작 유도
        stopPopupAndPoll();
        clearPassKeys();
        lastFailCode.value = 'CONSUMED';
        lastFailDetail.value = { code: 'CONSUMED', message: '이미 사용된 PASS 토큰입니다.' };
        mode.value = 'fail';
        busy.value = false;
      } else if (j.status === 'fail') {
        lastFailCode.value = j?.result?.failCode || 'UNKNOWN';
        // ⬇️ 백엔드가 동봉한 상세 사유(예: returnMsg) 반영
        lastFailDetail.value = {
          code: j?.result?.failCode || 'UNKNOWN',
          message: j?.result?.failMessage || '',
        };
        stopPopupAndPoll();
        clearPassKeys();
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

onMounted(async () => {
  window.addEventListener('message', handlePostMessage);
  window.addEventListener('storage', handleStorage);

  // 진입 시 프론트 찌꺼기 정리(로그아웃/재시작 안전)
  clearPassKeys();

  // 1) URL 쿼리 우선
  const qTx = route.query.txId ? String(route.query.txId) : '';
  if (qTx) {
    txIdRef.value = qTx;
    mode.value = 'running';
    busy.value = true;
    await proceedRouteByTx(qTx);
    return;
  }

  // 2) 팝업이 남겨둔 스토리지 폴백 회수
  try {
    const s = sessionStorage.getItem('passTxId') || '';
    const l = localStorage.getItem('PASS_RESULT_TX') || '';
    const tx = s || l;
    if (tx) {
      // 회수 후 즉시 분기
      txIdRef.value = tx;
      mode.value = 'running';
      busy.value = true;
      await proceedRouteByTx(tx);
      return;
    }
  } catch {}

  // 실패 안내 쿼리 처리
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

async function proceedRouteByTx(txId) {
  try {
    const res = await fetch(api(`/api/auth/pass/route?txId=${encodeURIComponent(txId)}`), {
      credentials: 'include'
    });
    const txt = await res.text();
    let j = null;
    try { j = JSON.parse(txt); } catch {
      lastFailCode.value = 'ROUTE_NON_JSON';
      lastFailDetail.value = { raw: txt };
      mode.value = 'fail';
      busy.value = false;
      return;
    }

    // consumed(410) 대응
    if (res.status === 410 || j?.code === 'CONSUMED') {
      clearPassKeys();
      lastFailCode.value = 'CONSUMED';
      lastFailDetail.value = { code: 'CONSUMED', message: '이미 사용된 PASS 토큰입니다.' };
      mode.value = 'fail';
      busy.value = false;
      return;
    }

    // 서버가 실패를 명시한 경우 그대로 노출
    if (!res.ok || j?.ok === false) {
      lastFailCode.value = j?.code || 'ROUTE_ERROR';
      lastFailDetail.value = j;
      mode.value = 'fail';
      busy.value = false;
      return;
    }

    const nextRoute = j?.route || j?.next;
    if (!nextRoute) {
      lastFailCode.value = 'ROUTE_MISSING';
      lastFailDetail.value = j;
      mode.value = 'fail';
      busy.value = false;
      return;
    }

    // 네비게이션 안전 실행기(이름→경로→강제 이동 순 폴백)
    const safeReplace = async (preferredTo, fallbackPath, finalHref) => {
      try {
        await router.replace(preferredTo);
        return true;
      } catch (e1) {
        console.warn('[route] replace by name failed → try path', e1);
        try {
          await router.replace({ path: fallbackPath });
          return true;
        } catch (e2) {
          console.warn('[route] replace by path failed → hard redirect', e2);
          try {
            window.location.assign(finalHref);
            return true;
          } catch (e3) {
            lastFailCode.value = 'ROUTE_NAV_FAIL';
            lastFailDetail.value = { response: j, e1: String(e1), e2: String(e2), e3: String(e3) };
            mode.value = 'fail';
            busy.value = false;
            return false;
          }
        }
      }
    };

    // ✅ 분기하기 직전 잠깐 저장(페이지 전환 실패시 복구용)
    try {
      sessionStorage.setItem('passTxId', txId);
      localStorage.setItem('PASS_RESULT_TX', txId);
    } catch { /* noop */ }

    if (nextRoute === 'signup') {
      const qs = `?passTxId=${encodeURIComponent(txId)}`;
      const ok = await safeReplace(
        { name: 'Signup', query: { passTxId: txId } },
        `/signup${qs}`,
        `/signup${qs}`
      );
      if (!ok) return;
      // 성공 이동 시에도 찌꺼기 제거 (서버는 소모형으로 방어)
      clearPassKeys();
    } else if (nextRoute === 'templogin') {
      const ok = await safeReplace(
        { name: 'Home' },
        `/`,
        `/`
      );
      if (!ok) return;
      clearPassKeys();
    } else {
      lastFailCode.value = 'ROUTE_UNKNOWN';
      lastFailDetail.value = j;
      mode.value = 'fail';
      busy.value = false;
      return;
    }
  } catch (e) {
    console.error('[proceedRouteByTx] error', e);
    lastFailCode.value = e?.message || 'ROUTE_ERROR';
    lastFailDetail.value = {
      message: e?.message || '',
      stackTop: String(e?.stack || '').split('\n')[0]
    };
    mode.value = 'fail';
    busy.value = false;
  }
}

async function onClickPass() {
  lastFailCode.value = '';
  lastFailDetail.value = null;
  if (busy.value) return;

  busy.value = true;
  mode.value = 'running';

  // 시작 전 기존 찌꺼기 제거
  clearPassKeys();

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
    console.error(e);
    lastFailCode.value = e?.message || 'START_ERROR';
    lastFailDetail.value = null;
    mode.value = 'fail';
    busy.value = false;
  }
}

// 🔙 뒤로가기
function onBack() {
  stopPopupAndPoll();
  clearPassKeys();
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

/* ⬇️ 상세 패널 스타일 */
.fail-detail { margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(255, 0, 0, 0.06); border: 1px solid rgba(255, 0, 0, 0.2); }
.fail-detail h3 { margin: 0 0 8px; font-size: 1rem; }
.kv { list-style: none; padding: 0; margin: 0 0 8px; }
.kv li { display: grid; grid-template-columns: 96px 1fr; gap: 8px; padding: 4px 0; }
.kv .k { opacity: 0.7; }
.kv .v { word-break: break-all; }
.raw { margin: 8px 0 0; max-height: 240px; overflow: auto; background: rgba(255,255,255,0.06); padding: 8px; border-radius: 8px; }

.tips { margin-top: 16px; font-size: 0.95rem; opacity: 0.9; }
.tips ul { margin: 6px 0 0 18px; }
</style>
