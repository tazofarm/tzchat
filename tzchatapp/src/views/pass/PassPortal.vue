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

          <div v-if="lastFail.code" class="fail-code">
            실패 코드: <code>{{ lastFail.code }}</code>
          </div>
          <div v-if="lastFail.message" class="fail-code" style="opacity:.9">
            사유: {{ lastFail.message }}
          </div>
        </div>

        <!-- 디버그 -->
        <div class="debug" v-if="showDebug">
          <h3>디버그</h3>
          <ul>
            <li><b>mode</b>: {{ mode }}</li>
            <li><b>txId</b>: {{ txIdRef || '—' }}</li>
            <li><b>code</b>: {{ lastFail.code || '—' }}</li>
            <li><b>stage</b>: {{ lastFail.stage || '—' }}</li>
            <li><b>ctype</b>: {{ lastFail.ctype || '—' }}</li>
            <li><b>charset</b>: {{ lastFail.charset || '—' }}</li>
            <li><b>parsedKeys</b>: {{ (lastFail.parsedKeys || []).join(', ') || '—' }}</li>
            <li v-if="lastFail.rawHead"><b>rawHead</b>: <code>{{ lastFail.rawHead }}</code></li>
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

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const api = (p) => `${API}${p.startsWith('/') ? p : '/'+p}`;

const busy = ref(false);
const statusPoller = ref(null);
const openedWin = ref(null);
const heartbeat = ref(null);
const watchdog = ref(null);
const txIdRef = ref('');
const lastEventAt = ref(0);

// 실패 상세
const lastFail = ref({
  code: '',
  message: '',
  stage: '',
  ctype: '',
  charset: '',
  parsedKeys: [],
  rawHead: '',
});

const mode = ref('idle');
const buttonText = computed(() => mode.value === 'running' ? '인증중…' : (mode.value === 'fail' ? '인증 실패 · 재인증' : 'PASS 인증하기'));
const buttonColor = computed(() => mode.value === 'fail' ? 'danger' : 'primary');

const isNative = Capacitor.isNativePlatform();
const isLocal = !isNative && ['localhost','127.0.0.1'].includes(location.hostname);

const showDebug = true;
const lastEventAtStr = computed(() => lastEventAt.value ? new Date(lastEventAt.value).toLocaleString() : '');

function markEvent(){ lastEventAt.value = Date.now(); }
function startWatchdog(){
  clearWatchdog();
  watchdog.value = setTimeout(()=>{
    if (!txIdRef.value) {
      setFail({ code:'CALLBACK_TIMEOUT', message:'콜백 수신 타임아웃(15s)', stage:'WATCHDOG' });
      mode.value = 'fail'; busy.value = false; stopPopupAndPoll();
    }
  }, 15000);
}
function clearWatchdog(){ if (watchdog.value) { clearTimeout(watchdog.value); watchdog.value=null; } }

function setFail(payload = {}) {
  lastFail.value = {
    code: payload.code || 'FAIL',
    message: payload.message || '',
    stage: payload.stage || '',
    ctype: payload.ctype || '',
    charset: payload.charset || '',
    parsedKeys: payload.parsedKeys || [],
    rawHead: payload.rawHead || '',
  };
}

function handlePASS_RESULT(data) {
  markEvent();
  if (data.ok === false) {
    setFail(data);
    mode.value = 'fail'; busy.value = false;
    stopPopupAndPoll(); clearWatchdog();
    return;
  }
  if (data.ok === true && data.txId) {
    txIdRef.value = String(data.txId);
    stopPopupAndPoll(); clearWatchdog();
    proceedRouteByTx(txIdRef.value);
  }
}

function handlePostMessage(e){
  try {
    const d = e?.data;
    if (!d) return;
    if (d.type === 'PASS_RESULT') return handlePASS_RESULT(d);
    if (d.type === 'PASS_FAIL') return handlePASS_RESULT({ ok:false, code:String(d.reason||'FAIL'), stage:'LEGACY' });
  } catch {}
}

function handleStorage(e){
  try{
    if (e.key !== 'PASS_RESULT_FALLBACK') return;
    const raw = e.newValue; if (!raw) return;
    localStorage.removeItem('PASS_RESULT_FALLBACK');
    let d=null; try{ d=JSON.parse(raw);}catch{ return; }
    if (d && d.type==='PASS_RESULT') handlePASS_RESULT(d);
  }catch{}
}

function startHeartbeat(){
  if (heartbeat.value) clearInterval(heartbeat.value);
  heartbeat.value = setInterval(()=>{
    try{
      if (openedWin.value && openedWin.value.closed) {
        const raw = localStorage.getItem('PASS_RESULT_FALLBACK');
        if (raw) {
          localStorage.removeItem('PASS_RESULT_FALLBACK');
          let d=null; try{ d=JSON.parse(raw);}catch{}
          if (d && d.type==='PASS_RESULT') handlePASS_RESULT(d);
        }
      }
    }catch{}
  }, 400);
}

function startStatusPolling(txId){
  if (!txId) return;
  if (statusPoller.value) clearInterval(statusPoller.value);
  statusPoller.value = setInterval(async ()=>{
    try{
      const res = await fetch(api(`/api/auth/pass/status?txId=${encodeURIComponent(txId)}`), { credentials:'include' });
      let j=null; try{ j=await res.json(); }catch{ return; }
      if (!j?.ok) return;
      if (j.status === 'fail') {
        setFail({ code:j?.result?.failCode || 'UNKNOWN', stage:'STATUS' });
        stopPopupAndPoll(); clearWatchdog();
        mode.value='fail'; busy.value=false;
      } else if (j.status === 'success') {
        stopPopupAndPoll(); clearWatchdog();
        await proceedRouteByTx(txId);
      }
    }catch{}
  }, 1500);
}

onMounted(async ()=>{
  window.addEventListener('message', handlePostMessage);
  window.addEventListener('storage', handleStorage);

  const qTx = route.query.txId ? String(route.query.txId) : '';
  if (qTx) {
    txIdRef.value = qTx;
    mode.value='running'; busy.value=true;
    startStatusPolling(qTx); startWatchdog();
    await proceedRouteByTx(qTx);
  }
  const qFail = route.query.fail ? String(route.query.fail) : '';
  if (qFail) {
    setFail({ code:qFail, stage:'QUERY' });
    mode.value='fail'; busy.value=false;
  }
});

onBeforeUnmount(()=>{
  window.removeEventListener('message', handlePostMessage);
  window.removeEventListener('storage', handleStorage);
  stopPopupAndPoll(); clearWatchdog();
});

function stopPopupAndPoll(){
  if (statusPoller.value){ clearInterval(statusPoller.value); statusPoller.value=null; }
  if (heartbeat.value){ clearInterval(heartbeat.value); heartbeat.value=null; }
  try{ if (openedWin.value && !openedWin.value.closed) openedWin.value.close(); }catch{}
  openedWin.value=null;
}

async function forceStatusCheck(){
  if (!txIdRef.value) return;
  try{
    const res = await fetch(api(`/api/auth/pass/status?txId=${encodeURIComponent(txIdRef.value)}`), { credentials:'include' });
    const j = await res.json(); markEvent();
    if (j?.status === 'fail') {
      setFail({ code:j?.result?.failCode || 'UNKNOWN', stage:'STATUS_FORCE' });
      mode.value='fail'; busy.value=false; stopPopupAndPoll(); clearWatchdog();
    } else if (j?.status === 'success') {
      stopPopupAndPoll(); clearWatchdog();
      await proceedRouteByTx(txIdRef.value);
    }
  }catch{}
}

function resetState(){
  stopPopupAndPoll(); clearWatchdog();
  txIdRef.value=''; lastEventAt.value=0;
  setFail({});
  busy.value=false; mode.value='idle';
}

async function proceedRouteByTx(txId){
  try{
    const res = await fetch(api(`/api/auth/pass/route?txId=${encodeURIComponent(txId)}`), { credentials:'include' });
    const j = await res.json();
    if (!j?.ok) throw new Error(j?.code || 'ROUTE_ERROR');
    const next = j.next;
    if (next === 'signup') router.replace({ name:'Signup', query:{ passTxId: txId } });
    else if (next === 'templogin') router.replace({ name:'Home' });
    else if (next === 'pending') { if (!statusPoller.value) startStatusPolling(txId); }
    else throw new Error('ROUTE_UNKNOWN');
  }catch(e){
    setFail({ code: e?.message || 'ROUTE_ERROR', stage:'ROUTE' });
    mode.value='fail'; busy.value=false;
  }
}

async function onClickPass(){
  setFail({});
  if (busy.value) return;
  busy.value=true; mode.value='running'; startWatchdog();

  try{
    if (isLocal) {
      const manualUrl = `${location.origin}${router.resolve({ name:'PassManual' }).href}`;
      openedWin.value = window.open(manualUrl, 'PASS_AUTH', 'width=460,height=680,menubar=no,toolbar=no,location=no,status=no');
      startHeartbeat(); return;
    }

    const resp = await fetch(api('/api/auth/pass/start'), {
      method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include',
      body: JSON.stringify({ intent:'unified' })
    });
    const j = await resp.json();
    if (!resp.ok || !j?.ok || !j?.formHtml) throw new Error(j?.code || 'START_ERROR');

    txIdRef.value = j.txId || '';
    openedWin.value = window.open('', 'PASS_AUTH', 'width=460,height=680,menubar=no,toolbar=no,location=no,status=no');
    if (!openedWin.value) throw new Error('POPUP_BLOCKED');
    openedWin.value.document.open(); openedWin.value.document.write(String(j.formHtml)); openedWin.value.document.close();

    if (txIdRef.value) startStatusPolling(txIdRef.value);
    startHeartbeat();
  }catch(e){
    setFail({ code: e?.message || 'START_ERROR', stage:'START' });
    mode.value='fail'; busy.value=false; clearWatchdog();
  }
}

function onBack(){ stopPopupAndPoll(); clearWatchdog(); router.replace('/login'); }
</script>

<style scoped>
.container { max-width: 720px; margin: 0 auto; padding: 16px; }
.card { background: var(--ion-card-background, #1e1e1e); border-radius: 16px; padding: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
h2 { margin: 0 0 8px; }
.desc { opacity: 0.85; margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }
.fail-code { margin-top: 12px; color: var(--ion-color-danger); }
.debug { margin-top: 16px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.05); }
.debug h3 { margin: 0 0 8px; font-size: 1rem; opacity: 0.9; }
.debug ul { margin: 0; padding-left: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.88rem; word-break: break-all; }
.debug .btns { margin-top: 10px; display: flex; gap: 8px; }
</style>
