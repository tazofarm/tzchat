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
            인증은 외부 브라우저(앱)에서 진행됩니다. 완료되면 자동으로 결과를 처리합니다.
          </p>

          <ion-button expand="block" :disabled="busy" @click="onClickPass" :color="buttonColor">
            <ion-spinner v-if="busy" name="dots" class="mr-2" />
            <span>{{ buttonText }}</span>
          </ion-button>

          <div v-if="lastFailCode" class="fail-code">
            실패 코드: <code>{{ lastFailCode }}</code>
          </div>

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

          <div v-if="hasPassResult" class="result-panel">
            <div class="panel-head">
              <h3>PASS 결과 (PassResult)</h3>
              <small class="muted">txId: {{ passTxShort }}</small>
            </div>

            <ul class="kv">
              <li><span class="k">status</span><span class="v">{{ pr.status }}</span></li>
              <li v-if="pr.failCode"><span class="k">failCode</span><span class="v">{{ pr.failCode }}</span></li>
              <li v-if="pr.provider"><span class="k">provider</span><span class="v">{{ pr.provider }}</span></li>
              <li v-if="pr.name"><span class="k">name</span><span class="v">{{ pr.name }}</span></li>
              <li v-if="pr.birthyear"><span class="k">birthyear</span><span class="v">{{ pr.birthyear }}</span></li>
              <li v-if="pr.gender !== undefined"><span class="k">gender</span><span class="v">{{ pr.gender }}</span></li>
              <li v-if="pr.phone"><span class="k">phone</span><span class="v">{{ pr.phone }}</span></li>
              <li v-if="pr.ciHash"><span class="k">ciHash</span><span class="v mono">{{ pr.ciHash }}</span></li>
              <li v-if="pr.diHash"><span class="k">diHash</span><span class="v mono">{{ pr.diHash }}</span></li>
              <li><span class="k">consumed</span><span class="v">{{ String(pr.consumed || false) }}</span></li>
              <li v-if="pr.usedAt"><span class="k">usedAt</span><span class="v">{{ fmt(pr.usedAt) }}</span></li>
              <li v-if="pr.createdAt"><span class="k">createdAt</span><span class="v">{{ fmt(pr.createdAt) }}</span></li>
              <li v-if="pr.updatedAt"><span class="k">updatedAt</span><span class="v">{{ fmt(pr.updatedAt) }}</span></li>
            </ul>

            <details v-if="passResultRaw">
              <summary>전체 JSON 보기</summary>
              <pre class="raw">{{ pretty(passResultRaw) }}</pre>
            </details>

            <div class="result-actions">
              <ion-button size="small" @click="goSignup" :disabled="busy">회원가입으로 이동</ion-button>
              <ion-button size="small" @click="goHome" :disabled="busy">홈으로 이동</ion-button>
            </div>
            <p class="hint">
              * 이 패널은 개발용입니다. 운영 시 제거/주석 처리하세요.
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
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const route = useRoute();
const router = useRouter();

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const api = (path) => `${API}${path.startsWith('/') ? path : `/${path}`}`;

const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID || '';
const CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY || '';

const busy = ref(false);
const lastFailCode = ref('');
const lastFailDetail = ref(null);

const txIdRef = ref(''); // identityVerificationId를 txId처럼 사용
const popupWin = ref(null);

// PassResult 디버그
const passResult = ref(null);
const passResultRaw = ref(null);
const hasPassResult = computed(() => !!passResult.value);
const pr = computed(() => (passResult.value?.result || passResult.value || {}));
const passTxShort = computed(
  () => (pr.value?.txId || txIdRef.value || '').slice(0, 18) + (txIdRef.value ? '…' : '')
);

// 버튼 상태
const mode = ref('idle'); // idle | running | fail
const buttonText = computed(() =>
  mode.value === 'running'
    ? '인증 중…'
    : mode.value === 'fail'
      ? '인증 실패 · 재시도'
      : 'PASS 인증하기'
);
const buttonColor = computed(() => (mode.value === 'fail' ? 'danger' : 'primary'));

const detail = computed(() => lastFailDetail.value || {});
const hasDetail = computed(() => !!lastFailDetail.value);

const pretty = (obj) => {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
};
const fmt = (d) => {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    const z = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(dt.getDate())} ${z(dt.getHours())}:${z(dt.getMinutes())}:${z(dt.getSeconds())}`;
  } catch { return String(d); }
};

const isNative = Capacitor.isNativePlatform();

// PortOne SDK는 index.html CDN 로드 (window.PortOne)
function getPortOne() {
  // eslint-disable-next-line no-undef
  return window?.PortOne;
}

/* ──────────────── 네이티브 복귀: 딥링크 수신 ──────────────── */
let appUrlOpenSub = null;
let browserFinishedSub = null;

function handleAppUrlOpen(data) {
  try {
    const rawUrl = String(data?.url || '');
    const url = new URL(rawUrl);

    const ivId = url.searchParams.get('identityVerificationId') || '';
    if (ivId) {
      txIdRef.value = ivId;
      Browser.close().catch(() => {});
      finalizeByIdentityVerificationId(ivId);
      return;
    }

    // 호환: txId로 들어온 경우도 처리
    const txId = url.searchParams.get('txId') || '';
    if (txId) {
      txIdRef.value = txId;
      Browser.close().catch(() => {});
      proceedRouteByTx(txId);
      return;
    }

    lastFailCode.value = 'NO_ID';
    mode.value = 'fail';
    busy.value = false;
    Browser.close().catch(() => {});
  } catch {}
}

/* ─────────────────────────────
   (웹) 팝업 유틸
   ───────────────────────────── */
function openPopup(features = '') {
  const baseFeatures = [
    'popup=yes', 'width=480', 'height=720', 'menubar=no', 'toolbar=no',
    'location=no', 'status=no', 'resizable=yes', 'scrollbars=yes'
  ].join(',');
  const final = features ? `${baseFeatures},${features}` : baseFeatures;

  const w = window.open('', 'passPopup', final);
  if (!w) return null;

  try {
    w.document.open('text/html', 'replace');
    w.document.write(`
      <!doctype html><meta charset="utf-8">
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
    w.focus?.();
  } catch {}

  popupWin.value = w;
  return w;
}

function popupBlockedFail() {
  lastFailCode.value = 'POPUP_BLOCKED';
  lastFailDetail.value = { code: 'POPUP_BLOCKED', message: '브라우저가 팝업을 차단했습니다. 팝업 허용 후 다시 시도하세요.' };
  mode.value = 'fail';
  busy.value = false;
}

async function closeExternal() {
  if (isNative) {
    try { await Browser.close(); } catch {}
  }
  try {
    if (popupWin.value && !popupWin.value.closed) popupWin.value.close();
  } catch {}
  popupWin.value = null;
}

/* ──────────────── 포트원 결과 확정(서버 조회/저장) ──────────────── */
async function finalizeByIdentityVerificationId(identityVerificationId) {
  try {
    const res = await fetch(
      api(`/api/auth/pass/portone/complete?identityVerificationId=${encodeURIComponent(identityVerificationId)}`),
      { credentials: 'include' }
    );
    const txt = await res.text();
    let j;
    try { j = JSON.parse(txt); } catch { throw new Error('COMPLETE_NON_JSON'); }

    if (!res.ok || !j?.ok) {
      lastFailCode.value = j?.code || 'COMPLETE_ERROR';
      lastFailDetail.value = j;
      mode.value = 'fail';
      busy.value = false;
      await closeExternal();
      return;
    }

    const txId = j.txId || identityVerificationId;
    txIdRef.value = txId;

    await proceedRouteByTx(txId);
  } catch (e) {
    lastFailCode.value = e?.message || 'COMPLETE_ERROR';
    lastFailDetail.value = { message: e?.message || '', stackTop: String(e?.stack || '').split('\n')[0] };
    mode.value = 'fail';
    busy.value = false;
    await closeExternal();
  }
}

/* ──────────────── 서버 결과/분기 처리 (기존 유지) ──────────────── */
async function loadPassResult(txId) {
  if (!txId) return;
  try {
    const res = await fetch(api(`/api/auth/pass/result/${encodeURIComponent(txId)}`), { credentials: 'include' });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = { ok: false, raw: text }; }
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
    let j = null;
    try { j = JSON.parse(txt); } catch {
      lastFailCode.value = 'ROUTE_NON_JSON';
      lastFailDetail.value = { raw: txt };
      mode.value = 'fail';
      busy.value = false;
      await closeExternal();
      return;
    }

    if (!res.ok || j?.ok === false) {
      lastFailCode.value = j?.code || 'ROUTE_ERROR';
      lastFailDetail.value = j;
      mode.value = 'fail';
      busy.value = false;
      await closeExternal();
      return;
    }

    const nextRoute = j?.route || j?.next;
    if (!nextRoute) {
      lastFailCode.value = 'ROUTE_MISSING';
      lastFailDetail.value = j;
      mode.value = 'fail';
      busy.value = false;
      await closeExternal();
      return;
    }

    try {
      sessionStorage.setItem('passTxId', txId);
      localStorage.setItem('PASS_RESULT_TX', txId);
    } catch {}

    if (nextRoute === 'signup') {
      try { await router.replace({ name: 'Signup', query: { passTxId: txId } }); }
      catch { await router.replace({ path: `/signup?passTxId=${encodeURIComponent(txId)}` }); }
      await closeExternal();
      return;
    }

    if (nextRoute === 'templogin') {
      try { await router.replace({ name: 'TempLogin', query: { txId } }); }
      catch { await router.replace({ path: `/templogin?txId=${encodeURIComponent(txId)}` }); }
      await closeExternal();
      return;
    }

    lastFailCode.value = 'ROUTE_UNKNOWN';
    lastFailDetail.value = j;
    mode.value = 'fail';
    busy.value = false;
    await closeExternal();
  } catch (e) {
    lastFailCode.value = e?.message || 'ROUTE_ERROR';
    lastFailDetail.value = { message: e?.message || '', stackTop: String(e?.stack || '').split('\n')[0] };
    mode.value = 'fail';
    busy.value = false;
    await closeExternal();
  }
}

/* ──────────────── 시작 버튼 (PortOne SDK: CDN) ──────────────── */
async function onClickPass() {
  lastFailCode.value = '';
  lastFailDetail.value = null;
  if (busy.value) return;

  if (!STORE_ID || !CHANNEL_KEY) {
    lastFailCode.value = 'ENV_MISSING';
    lastFailDetail.value = { message: 'VITE_PORTONE_STORE_ID 또는 VITE_PORTONE_CHANNEL_KEY 가 비어있습니다.' };
    mode.value = 'fail';
    busy.value = false;
    return;
  }

  const PortOne = getPortOne();
  if (!PortOne?.requestIdentityVerification) {
    lastFailCode.value = 'SDK_NOT_LOADED';
    lastFailDetail.value = { message: 'PortOne 브라우저 SDK가 로드되지 않았습니다. index.html에 CDN script가 있는지 확인하세요.' };
    mode.value = 'fail';
    busy.value = false;
    return;
  }

  busy.value = true;
  mode.value = 'running';

  try {
    if (!isNative) {
      if (!popupWin.value || popupWin.value.closed) {
        const w = openPopup();
        if (!w) {
          popupBlockedFail();
          return;
        }
      }
    }

    const identityVerificationId =
      `iv_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    txIdRef.value = identityVerificationId;

    /**
     * ✅ 중요
     * - 웹: location.origin 사용 가능
     * - 앱(캡/안드): location.origin이 capacitor://localhost 같은 값이 될 수 있어 외부 인증사가 복귀 못할 수 있음
     *   그래서 "서비스 도메인"으로 복귀 URL을 고정하는 것을 권장
     */
    const serviceOrigin = 'https://tzchat.tazocode.com';
    const redirectUrl =
      `${serviceOrigin}/app/pass-result?identityVerificationId=${encodeURIComponent(identityVerificationId)}`;

    const resp = await PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY,
      identityVerificationId,
      redirectUrl,
    });

    // 즉시 실패로 반환되는 케이스 방어
    if (resp?.code) {
      lastFailCode.value = resp.code || 'PORTONE_FAIL';
      lastFailDetail.value = resp;
      mode.value = 'fail';
      busy.value = false;
      await closeExternal();
      return;
    }

    // 일부 환경에서는 즉시 id가 반환될 수 있음
    if (resp?.identityVerificationId) {
      await finalizeByIdentityVerificationId(resp.identityVerificationId);
      return;
    }

    // 리디렉션/외부 UI로 진행되면 여기서 끝(복귀에서 처리)
    busy.value = false;
    mode.value = 'idle';
  } catch (e) {
    lastFailCode.value = e?.message || 'PORTONE_START_ERROR';
    lastFailDetail.value = { message: String(e?.message || e) };
    mode.value = 'fail';
    busy.value = false;
    await closeExternal();
  }
}

/* ──────────────── 라이프사이클 ──────────────── */
onMounted(async () => {
  if (isNative) {
    appUrlOpenSub = App.addListener('appUrlOpen', handleAppUrlOpen);
    browserFinishedSub = Browser.addListener('browserFinished', () => {
      busy.value = false;
      mode.value = 'idle';
    });
  }

  // (웹) 복귀: /pass?identityVerificationId=... (혹시 이 라우트로도 복귀시키는 경우 대비)
  const ivId = route.query.identityVerificationId ? String(route.query.identityVerificationId) : '';
  if (ivId) {
    txIdRef.value = ivId;
    mode.value = 'running';
    busy.value = true;
    await finalizeByIdentityVerificationId(ivId);
    return;
  }

  // (호환) /pass?txId=...
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
  void closeExternal();
  if (appUrlOpenSub) appUrlOpenSub.remove?.();
  if (browserFinishedSub) browserFinishedSub.remove?.();
});

/* ──────────────── 뒤로가기 ──────────────── */
function onBack() {
  try {
    sessionStorage.removeItem('passTxId');
    localStorage.removeItem('PASS_RESULT_TX');
  } catch {}
  void closeExternal();
  router.replace('/login');
}

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
.card {
  background: var(--ion-card-background, #1e1e1e);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}
h2 { margin: 0 0 8px; }
.desc { opacity: 0.85; margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }
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
.kv .v.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; }
.raw {
  margin: 8px 0 0;
  max-height: 240px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.06);
  padding: 8px;
  border-radius: 8px;
}
.tips { margin-top: 16px; font-size: 0.95rem; opacity: 0.9; }
.tips ul { margin: 6px 0 0 18px; }

.result-panel {
  margin-top: 16px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(0, 128, 255, 0.06);
  border: 1px solid rgba(0, 128, 255, 0.2);
}
.result-panel .panel-head { display: flex; align-items: baseline; gap: 8px; }
.result-panel .panel-head h3 { margin: 0; font-size: 1rem; }
.result-panel .panel-head .muted { opacity: 0.7; }
.result-actions { display: flex; gap: 8px; margin-top: 8px; }
.hint { margin-top: 6px; opacity: 0.7; font-size: 0.85rem; }
</style>
