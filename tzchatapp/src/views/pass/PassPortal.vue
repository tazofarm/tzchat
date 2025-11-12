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
            인증은 별도 팝업으로 진행됩니다. 완료되면 팝업이 자동으로 닫히고, 이 화면에서 결과를 확인합니다.
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

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const api = (path) => `${API}${path.startsWith('/') ? path : `/${path}`}`;

const busy = ref(false);
const lastFailCode = ref('');
const lastFailDetail = ref(null);
const statusPoller = ref(null);
const txIdRef = ref('');
const popupWin = ref(null);

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
// 팝업 유틸: 현재 탭 이동 금지
// ─────────────────────────────
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
  ].join(',');
  const final = features ? `${baseFeatures},${features}` : baseFeatures;

  // 같은 이름 재사용
  const w = window.open('', 'passPopup', final);
  if (!w) return null;

  try {
    w.document.open('text/html', 'replace');
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
        <div class="small">이 창은 인증 완료 시 자동으로 닫힙니다.</div>
      </div>
    `);
    w.document.close();
    try { w.focus(); } catch {}
  } catch {
    // 문서 쓰기 실패는 무시(일부 브라우저 보안설정)
  }

  popupWin.value = w;
  return w;
}

function popupBlockedFail() {
  lastFailCode.value = 'POPUP_BLOCKED';
  lastFailDetail.value = { code: 'POPUP_BLOCKED', message: '브라우저가 팝업을 차단했습니다. 팝업 허용 후 다시 시도하세요.' };
  mode.value = 'fail';
  busy.value = false;
}

// 외부 URL을 팝업에서만 열기
async function openExternal(url) {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      lastFailCode.value = 'NATIVE_BROWSER_OPEN_FAIL';
      mode.value = 'fail';
      busy.value = false;
      return;
    }
  }

  const w = popupWin.value && !popupWin.value.closed ? popupWin.value : openPopup();
  if (!w) {
    popupBlockedFail();
    return;
  }
  try {
    w.location.replace(url); // 현재 탭은 절대 이동 금지
  } catch {
    // 드물게 replace가 막히는 경우에도 현재 탭 이동은 하지 않는다.
    w.location.href = url;
  }
}

// formHtml을 팝업에만 주입
async function openExternalFormHtml(html) {
  if (isNative) {
    lastFailCode.value = 'NATIVE_NEEDS_URL';
    lastFailDetail.value = { message: '네이티브에선 URL 방식이 필요합니다.' };
    mode.value = 'fail'; busy.value = false;
    return;
  }
  const w = popupWin.value && !popupWin.value.closed ? popupWin.value : openPopup();
  if (!w) { popupBlockedFail(); return; }

  try {
    w.document.open('text/html', 'replace');
    w.document.write(html); // auto-submit form 가정
    w.document.close();
  } catch (e) {
    lastFailCode.value = 'POPUP_WRITE_FAIL';
    lastFailDetail.value = { message: String(e) };
    mode.value = 'fail'; busy.value = false;
  }
}

async function closeExternal() {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch {}
  }
  try {
    if (popupWin.value && !popupWin.value.closed) popupWin.value.close();
  } catch {}
  popupWin.value = null;
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
        await closeExternal();
      } else if (j.status === 'fail') {
        stopPolling();
        lastFailCode.value = j?.result?.failCode || 'UNKNOWN';
        lastFailDetail.value = { code: j?.result?.failCode || 'UNKNOWN', message: j?.result?.failMessage || '' };
        mode.value = 'fail'; busy.value = false;
        await closeExternal();
      } else if (j.status === 'success') {
        stopPolling();
        await proceedRouteByTx(txId);
      }
    } catch {
      // 일시 오류 무시
    }
  }, 1200);
}
function stopPolling() {
  if (statusPoller.value) {
    clearInterval(statusPoller.value);
    statusPoller.value = null;
  }
}

// postMessage & storage 핸들러
function onMessage(e) {
  const data = e?.data || {};
  if (data?.type === 'PASS_RESULT' && data?.txId) {
    txIdRef.value = String(data.txId);
    proceedRouteByTx(txIdRef.value);
  } else if (data?.type === 'PASS_FAIL') {
    lastFailCode.value = data?.reason || 'FAIL';
    lastFailDetail.value = data?.detail || {};
    mode.value = 'fail'; busy.value = false;
  }
}
function onStorage(e) {
  if (e.key === 'PASS_RESULT_TX' && e.newValue) {
    txIdRef.value = String(e.newValue);
    proceedRouteByTx(txIdRef.value);
  }
}

onMounted(async () => {
  window.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);

  const qTx = route.query.txId ? String(route.query.txId) : '';
  if (qTx) {
    txIdRef.value = qTx;
    mode.value = 'running';
    busy.value = true;
    await proceedRouteByTx(qTx);
    return;
  }

  const qFail = route.query.fail ? String(route.query.fail) : '';
  if (qFail) {
    lastFailCode.value = qFail;
    mode.value = 'fail';
    busy.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage);
  window.removeEventListener('storage', onStorage);
  stopPolling();
  void closeExternal();
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
      await closeExternal();
      return;
    }

    if (res.status === 410 || j?.code === 'CONSUMED') {
      lastFailCode.value = 'CONSUMED';
      lastFailDetail.value = { code: 'CONSUMED', message: '이미 사용된 PASS 토큰입니다.' };
      mode.value = 'fail'; busy.value = false;
      await closeExternal();
      return;
    }

    if (!res.ok || j?.ok === false) {
      lastFailCode.value = j?.code || 'ROUTE_ERROR';
      lastFailDetail.value = j;
      mode.value = 'fail'; busy.value = false;
      await closeExternal();
      return;
    }

    const stay = String(route.query.stay || '') === '1';
    if (stay) { mode.value = 'idle'; busy.value = false; return; }

    const nextRoute = j?.route || j?.next;
    if (!nextRoute) {
      lastFailCode.value = 'ROUTE_MISSING';
      lastFailDetail.value = j;
      mode.value = 'fail'; busy.value = false;
      await closeExternal();
      return;
    }

    try {
      sessionStorage.setItem('passTxId', txId);
      localStorage.setItem('PASS_RESULT_TX', txId);
    } catch {}

    if (nextRoute === 'signup') {
      try {
        await router.replace({ name: 'Signup', query: { passTxId: txId } });
      } catch {
        await router.replace({ path: `/signup?passTxId=${encodeURIComponent(txId)}` });
      }
      await closeExternal();
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
        await closeExternal();
        return;
      }
      await router.replace({ name: 'Home' });
      await closeExternal();
    } else {
      lastFailCode.value = 'ROUTE_UNKNOWN';
      lastFailDetail.value = j;
      mode.value = 'fail'; busy.value = false;
      await closeExternal();
    }
  } catch (e) {
    lastFailCode.value = e?.message || 'ROUTE_ERROR';
    lastFailDetail.value = { message: e?.message || '', stackTop: String(e?.stack || '').split('\n')[0] };
    mode.value = 'fail'; busy.value = false;
    await closeExternal();
  }
}

async function onClickPass() {
  lastFailCode.value = '';
  lastFailDetail.value = null;
  if (busy.value) return;
  busy.value = true; mode.value = 'running';

  try {
    if (isLocal) {
      await router.replace({ name: 'PassManual' });
      busy.value = false; mode.value = 'idle';
      return;
    }

    // 1) 팝업을 먼저 열어두기(팝업 차단 회피 & opener 확보)
    if (!popupWin.value || popupWin.value.closed) {
      const w = openPopup();
      if (!w) { popupBlockedFail(); return; }
    }

    // 2) PASS 세션 생성
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

    // 3) 팝업에서 인증 열기
    if (startJson.startUrl) {
      await openExternal(startJson.startUrl);      // GET/redirect 방식
    } else if (startJson.formHtml) {
      await openExternalFormHtml(startJson.formHtml); // POST(auto-submit) 방식
    } else {
      throw new Error('NO_START_ENTRY');
    }

    // 4) 상태 폴링 (postMessage/Storage가 먼저 오면 폴링은 즉시 멈춤)
    if (txIdRef.value) startStatusPolling(txIdRef.value);
  } catch (e) {
    lastFailCode.value = e?.message || 'START_ERROR';
    lastFailDetail.value = null;
    mode.value = 'fail'; busy.value = false;
    await closeExternal();
  }
}

// 뒤로가기
function onBack() {
  stopPolling();
  try {
    sessionStorage.removeItem('passTxId');
    localStorage.removeItem('PASS_RESULT_TX');
  } catch {}
  void closeExternal();
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
