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
            모바일 앱에선 외부 브라우저(Chrome Custom Tabs)로 PASS 인증이 열립니다.
            인증을 마치고 앱으로 돌아오면 결과를 자동으로 확인합니다.
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

          <!-- 실패 상세 -->
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

          <!-- PASS 결과(서버 저장 PassResult) 디버그 패널 -->
          <div v-if="hasPassResult" class="result-panel">
            <div class="panel-head">
              <h3>PASS 결과 (PassResult)</h3>
              <small class="muted">txId: {{ passTxShort }}</small>
            </div>

            <ul class="kv">
              <li><span class="k">status</span><span class="v">{{ pr.status }}</span></li>
              <li v-if="pr.failCode"><span class="k">failCode</span><span class="v">{{ pr.failCode }}</span></li>
              <li v-if="pr.intent"><span class="k">intent</span><span class="v">{{ pr.intent }}</span></li>
              <li v-if="pr.provider"><span class="k">provider</span><span class="v">{{ pr.provider }}</span></li>
              <li v-if="pr.name"><span class="k">name</span><span class="v">{{ pr.name }}</span></li>
              <li v-if="pr.birthyear"><span class="k">birthyear</span><span class="v">{{ pr.birthyear }}</span></li>
              <li v-if="pr.gender !== undefined"><span class="k">gender</span><span class="v">{{ pr.gender }}</span></li>
              <li v-if="pr.phone"><span class="k">phone</span><span class="v">{{ pr.phone }}</span></li>
              <li v-if="pr.carrier"><span class="k">carrier</span><span class="v">{{ pr.carrier }}</span></li>
              <li v-if="pr.ciHash"><span class="k">ciHash</span><span class="v mono">{{ pr.ciHash }}</span></li>
              <li v-if="pr.diHash"><span class="k">diHash</span><span class="v mono">{{ pr.diHash }}</span></li>
              <li><span class="k">consumed</span><span class="v">{{ String(pr.consumed || false) }}</span></li>
              <li v-if="pr.usedAt"><span class="k">usedAt</span><span class="v">{{ fmt(pr.usedAt) }}</span></li>
              <li v-if="pr.createdAt"><span class="k">createdAt</span><span class="v">{{ fmt(pr.createdAt) }}</span></li>
              <li v-if="pr.updatedAt"><span class="k">updatedAt</span><span class="v">{{ fmt(pr.updatedAt) }}</span></li>
            </ul>

            <details v-if="pr.rawMasked">
              <summary>rawMasked 보기</summary>
              <pre class="raw">{{ pretty(pr.rawMasked) }}</pre>
            </details>

            <details v-if="passResultRaw">
              <summary>전체 JSON 보기</summary>
              <pre class="raw">{{ pretty(passResultRaw) }}</pre>
            </details>

            <div class="result-actions">
              <ion-button size="small" @click="goSignup" :disabled="busy">회원가입으로 이동</ion-button>
              <ion-button size="small" @click="goHome" :disabled="busy">홈으로 이동</ion-button>
            </div>
            <p class="hint">
              * 이 패널은 개발용으로 PassResult 전체를 노출합니다. 운영 시 제거/주석 처리하세요.
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
} from '@ionic/vue';
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';

const route = useRoute();
const router = useRouter();

// API helper
const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const api = (path) => `${API}${path.startsWith('/') ? path : `/${path}`}`;

const busy = ref(false);
const lastFailCode = ref('');
const lastFailDetail = ref(null);
const statusPoller = ref(null);
const txIdRef = ref('');

// PassResult 디버그
const passResult = ref(null);
const passResultRaw = ref(null);
const hasPassResult = computed(() => !!passResult.value);
const pr = computed(() => (passResult.value?.result || passResult.value || {}));
const passTxShort = computed(() => (pr.value?.txId || txIdRef.value || '').slice(0, 18) + (txIdRef.value ? '…' : ''));

// 버튼 상태
const mode = ref('idle'); // idle | running | fail
const buttonText = computed(() => mode.value === 'running' ? '인증 중…' : (mode.value === 'fail' ? '인증 실패 · 재시도' : 'PASS 인증하기'));
const buttonColor = computed(() => (mode.value === 'fail' ? 'danger' : 'primary'));

// 상세 표시
const detail = computed(() => lastFailDetail.value || {});
const hasDetail = computed(() => !!lastFailDetail.value);
const pretty = (obj) => { try { return JSON.stringify(obj, null, 2); } catch { return String(obj); } };
const fmt = (d) => {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    const z = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${z(dt.getMonth()+1)}-${z(dt.getDate())} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
  } catch { return String(d); }
};

const isNative = Capacitor.isNativePlatform();
const isLocal = !isNative && ['localhost', '127.0.0.1'].includes(location.hostname);

// ─────────────────────────────
// Browser API (동적 import; 웹빌드에서 @capacitor/browser 의존성 제거)
// - startUrl: GET/redirect 방식
// - formHtml: POST(auto-submit) 방식도 지원
// ─────────────────────────────
async function openExternal(url) {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      // 네이티브에서 플러그인 없을 때 폴백
    }
  }
  const win = window.open(url, '_blank', 'noopener');
  if (!win) location.href = url; // 팝업 차단 시 현재 탭으로 이동
}

async function openExternalFormHtml(html) {
  if (isNative) {
    // 네이티브에서는 formHtml 처리 곤란 → 서버에서 URL을 주도록 재시도 유도
    throw new Error('NATIVE_NEEDS_URL');
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) location.href = url; // 팝업 차단 시 현재 탭 전환
}

async function closeExternal() {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch { /* noop */ }
  }
}

// 상태 폴링
function startStatusPolling(txId) {
  if (!txId) return;
  if (statusPoller.value) clearInterval(statusPoller.value);

  statusPoller.value = setInterval(async () => {
    try {
      const res = await fetch(api(`/api/auth/pass/status?txId=${encodeURIComponent(txId)}`), { credentials: 'include' });
      const txt = await res.text();
      let j = null; try { j = JSON.parse(txt); } catch { return; }
      if (!j?.ok) return;

      if (j.status === 'consumed') {
        stopPolling();
        lastFailCode.value = 'CONSUMED';
        lastFailDetail.value = { code: 'CONSUMED', message: '이미 사용된 PASS 토큰입니다.' };
        mode.value = 'fail'; busy.value = false;
      } else if (j.status === 'fail') {
        stopPolling();
        lastFailCode.value = j?.result?.failCode || 'UNKNOWN';
        lastFailDetail.value = { code: j?.result?.failCode || 'UNKNOWN', message: j?.result?.failMessage || '' };
        mode.value = 'fail'; busy.value = false;
      } else if (j.status === 'success') {
        stopPolling();
        await proceedRouteByTx(txId);
      }
    } catch {
      // 일시 오류 무시
    }
  }, 1500);
}
function stopPolling() {
  if (statusPoller.value) {
    clearInterval(statusPoller.value);
    statusPoller.value = null;
  }
}

onMounted(async () => {
  // URL의 txId로 재진입한 경우
  const qTx = route.query.txId ? String(route.query.txId) : '';
  if (qTx) {
    txIdRef.value = qTx;
    mode.value = 'running';
    busy.value = true;
    await proceedRouteByTx(qTx);
    return;
  }

  // 실패 쿼리 표시
  const qFail = route.query.fail ? String(route.query.fail) : '';
  if (qFail) {
    lastFailCode.value = qFail;
    mode.value = 'fail';
    busy.value = false;
  }
});

onBeforeUnmount(() => {
  stopPolling();
});

async function loadPassResult(txId) {
  if (!txId) return;
  try {
    const res = await fetch(api(`/api/auth/pass/result/${encodeURIComponent(txId)}`), { credentials: 'include' });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { json = { ok: false, raw: text }; }
    passResultRaw.value = json;
    passResult.value = json;
    try { localStorage.setItem('PASS_LAST_RESULT', JSON.stringify(json)); } catch {}
  } catch (e) {
    passResult.value = { ok: false, error: String(e) };
    passResultRaw.value = { ok: false, error: String(e) };
  }
}

async function proceedRouteByTx(txId) {
  try {
    await loadPassResult(txId);

    const res = await fetch(api(`/api/auth/pass/route?txId=${encodeURIComponent(txId)}`), { credentials: 'include' });
    const txt = await res.text();
    let j = null; try { j = JSON.parse(txt); } catch {
      lastFailCode.value = 'ROUTE_NON_JSON';
      lastFailDetail.value = { raw: txt };
      mode.value = 'fail'; busy.value = false;
      return;
    }

    if (res.status === 410 || j?.code === 'CONSUMED') {
      lastFailCode.value = 'CONSUMED';
      lastFailDetail.value = { code: 'CONSUMED', message: '이미 사용된 PASS 토큰입니다.' };
      mode.value = 'fail'; busy.value = false;
      return;
    }

    if (!res.ok || j?.ok === false) {
      lastFailCode.value = j?.code || 'ROUTE_ERROR';
      lastFailDetail.value = j;
      mode.value = 'fail'; busy.value = false;
      return;
    }

    const stay = String(route.query.stay || '') === '1';
    if (stay) { mode.value = 'idle'; busy.value = false; return; }

    const nextRoute = j?.route || j?.next;
    if (!nextRoute) {
      lastFailCode.value = 'ROUTE_MISSING';
      lastFailDetail.value = j;
      mode.value = 'fail'; busy.value = false;
      return;
    }

    try {
      sessionStorage.setItem('passTxId', txId);
      localStorage.setItem('PASS_RESULT_TX', txId);
    } catch {}

    if (nextRoute === 'signup') {
      const qs = `?passTxId=${encodeURIComponent(txId)}`;
      try {
        await router.replace({ name: 'Signup', query: { passTxId: txId } });
      } catch {
        await router.replace({ path: `/signup${qs}` });
      }
      try { await closeExternal(); } catch {}
    } else if (nextRoute === 'templogin') {
      try {
        const resp = await fetch(api(`/api/auth/pass/temp-login`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ txId, updateProfile: true })
        });
        const bodyText = await resp.text();
        const jj = JSON.parse(bodyText);
        if (!resp.ok || !jj?.ok) throw new Error(jj?.code || 'TEMPLOGIN_FAILED');
      } catch (e) {
        lastFailCode.value = e?.message || 'TEMPLOGIN_FAILED';
        lastFailDetail.value = { response: String(e) };
        mode.value = 'fail'; busy.value = false;
        return;
      }
      await router.replace({ name: 'Home' });
      try { await closeExternal(); } catch {}
    } else {
      lastFailCode.value = 'ROUTE_UNKNOWN';
      lastFailDetail.value = j;
      mode.value = 'fail'; busy.value = false;
    }
  } catch (e) {
    lastFailCode.value = e?.message || 'ROUTE_ERROR';
    lastFailDetail.value = { message: e?.message || '', stackTop: String(e?.stack || '').split('\n')[0] };
    mode.value = 'fail'; busy.value = false;
  }
}

async function onClickPass() {
  lastFailCode.value = '';
  lastFailDetail.value = null;
  if (busy.value) return;
  busy.value = true; mode.value = 'running';

  try {
    // 로컬 개발(웹)은 수동 입력 페이지로 유도
    if (isLocal) {
      await router.replace({ name: 'PassManual' });
      busy.value = false; mode.value = 'idle';
      return;
    }

    // 서버에서 PASS 세션 생성: { ok, txId, startUrl? , formHtml? }
    const resp = await fetch(api('/api/auth/pass/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ intent: 'unified', preferUrl: true })
    });
    const startText = await resp.text();
    let startJson = null; try { startJson = JSON.parse(startText); } catch { throw new Error('START_NON_JSON'); }

    if (!resp.ok || !startJson?.ok || !(startJson?.startUrl || startJson?.formHtml)) {
      throw new Error(startJson?.code || 'START_ERROR');
    }

    txIdRef.value = startJson.txId || '';

    if (startJson.startUrl) {
      await openExternal(startJson.startUrl);      // GET/redirect 방식
    } else if (startJson.formHtml) {
      await openExternalFormHtml(startJson.formHtml); // POST(auto-submit) 방식(웹)
    } else {
      throw new Error('NO_START_ENTRY');
    }

    // 상태 폴링 시작
    if (txIdRef.value) startStatusPolling(txIdRef.value);
  } catch (e) {
    lastFailCode.value = e?.message || 'START_ERROR';
    lastFailDetail.value = null;
    mode.value = 'fail'; busy.value = false;
  }
}

// 뒤로가기
function onBack() {
  stopPolling();
  try {
    sessionStorage.removeItem('passTxId');
    localStorage.removeItem('PASS_RESULT_TX');
    // 개발 중 캐시 정리(선택)
    // localStorage.removeItem('PASS_LAST_RESULT');
  } catch {}
  router.replace('/login');
}

// 디버그 패널 버튼
function goSignup() {
  const txId = txIdRef.value || pr.value?.txId || '';
  if (!txId) return;
  router.replace({ name: 'Signup', query: { passTxId: txId } });
}
function goHome() {
  router.replace('/');
}
</script>

<style scoped>
.container { max-width: 720px; margin: 0 auto; padding: 16px; }
.card { background: var(--ion-card-background, #1e1e1e); border-radius: 16px; padding: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
h2 { margin: 0 0 8px; }
.desc { opacity: 0.85; margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }
.fail-code { margin-top: 12px; color: var(--ion-color-danger); }

.fail-detail { margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(255, 0, 0, 0.06); border: 1px solid rgba(255, 0, 0, 0.2); }
.fail-detail h3 { margin: 0 0 8px; font-size: 1rem; }
.kv { list-style: none; padding: 0; margin: 0 0 8px; }
.kv li { display: grid; grid-template-columns: 112px 1fr; gap: 8px; padding: 4px 0; }
.kv .k { opacity: 0.7; }
.kv .v { word-break: break-all; }
.kv .v.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
.raw { margin: 8px 0 0; max-height: 240px; overflow: auto; background: rgba(255,255,255,0.06); padding: 8px; border-radius: 8px; }

.tips { margin-top: 16px; font-size: 0.95rem; opacity: 0.9; }
.tips ul { margin: 6px 0 0 18px; }

.result-panel { margin-top: 16px; padding: 12px; border-radius: 12px; background: rgba(0, 128, 255, 0.06); border: 1px solid rgba(0, 128, 255, 0.2); }
.result-panel .panel-head { display: flex; align-items: baseline; gap: 8px; }
.result-panel .panel-head h3 { margin: 0; font-size: 1rem; }
.result-panel .panel-head .muted { opacity: 0.7; }
.result-actions { display: flex; gap: 8px; margin-top: 8px; }
.hint { margin-top: 6px; opacity: 0.7; font-size: 0.85rem; }
</style>
