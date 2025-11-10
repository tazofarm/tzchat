// backend/lib/pass/danalClient.js
// Danal UAS 본인인증 연동 (Ready → Start.php → CPCGI/CONFIRM)
// - startReady: uas.teledit.com 에 ITEMSEND 전송(TID 수신)
// - buildWauthFormHtml: wauth.teledit.com Start.php 로 TID/ByPass POST 자동 제출 폼 생성
// - confirmByTid: uas.teledit.com 에 CONFIRM 전송(CI/DI/DOB/SEX/NAME 수신)
// - parseCallback: 다날 WebAuth가 TARGETURL(CPCGI)로 TID를 POST하면 CONFIRM까지 수행

const axios = require('axios');
const qs = require('querystring');

// ── Env mapping (신규키 우선, 레거시 폴백)
const CPID = process.env.DANAL_CPID || process.env.PASS_CPID || '';
const CPPWD = process.env.DANAL_PWD  || process.env.PASS_PWD  || '';
const UAS_URL = (process.env.DANAL_BASE_URL || 'https://uas.teledit.com/uas/').replace(/\/+$/, '') + '/';
const WAUTH_WEB_START = 'https://wauth.teledit.com/Danal/WebAuth/Web/Start.php';
const WAUTH_MOBILE_START = 'https://wauth.teledit.com/Danal/WebAuth/Mobile/Start.php';

// 콜백 베이스(우리 CPCGI 엔드포인트) 결정
function resolveCallbackBase() {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProd) {
    return (process.env.PASS_CALLBACK_PROD || process.env.API_ORIGIN || 'https://tzchat.tazocode.com').replace(/\/+$/, '');
  }
  const port = process.env.PORT || 2000;
  return (process.env.PASS_CALLBACK_LOCAL || `http://localhost:${port}`).replace(/\/+$/, '');
}

// 다날이 인증 완료후 POST 해줄 TARGETURL(CPCGI)
function buildTargetUrl() {
  return `${resolveCallbackBase()}/api/auth/pass/callback`; // 우리 서버의 CPCGI 역할
}

// Ready(ITEMSEND): TID 발급 (에러 분류/타임아웃/로깅 강화)
async function startReady({ orderId = '', userId = '', cpTitle = '' } = {}) {
  if (!CPID || !CPPWD) {
    const miss = [];
    if (!CPID) miss.push('DANAL_CPID');
    if (!CPPWD) miss.push('DANAL_PWD');
    const err = new Error(`Danal PASS env missing: ${miss.join(', ')}`);
    err.code = 'ENV_MISSING';
    err.stage = 'READY';
    throw err;
  }

  const payload = {
    TXTYPE: 'ITEMSEND',
    SERVICE: 'UAS',
    AUTHTYPE: '36',
    CPID,
    CPPWD,
    TARGETURL: buildTargetUrl(),
    CPTITLE: cpTitle || 'tzchat.tazocode.com',
    USERID: userId || '',
    ORDERID: orderId || '',
  };

  const body = qs.stringify(payload);

  let res;
  try {
    res = await axios.post(UAS_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      timeout: 7000,
      validateStatus: () => true, // 200이 아니어도 본문 파싱해 원인 노출
    });
  } catch (e) {
    const err = new Error(`UAS request failed: ${e.message}`);
    err.code = (e.code === 'ECONNABORTED') ? 'READY_TIMEOUT' : 'READY_NETWORK';
    err.stage = 'READY';
    throw err;
  }

  const text = Buffer.isBuffer(res.data) ? res.data.toString('utf8') : String(res.data || '');
  if (res.status !== 200) {
    const err = new Error(`UAS HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.code = 'READY_HTTP';
    err.stage = 'READY';
    throw err;
  }

  const map = new Map();
  for (const kv of text.split('&')) {
    const [k, v = ''] = kv.split('=');
    if (k) map.set(k.trim(), v);
  }

  const code = (map.get('RETURNCODE') || '').trim();
  const msg  = (map.get('RETURNMSG')  || '').trim();
  if (code !== '0000') {
    const err = new Error(`READY_FAILED(${code}): ${msg || 'no message'}`);
    err.code = 'READY_FAIL';
    err.stage = 'READY';
    err.returnCode = code;
    throw err;
  }

  const tid = (map.get('TID') || '').trim();
  if (!tid) {
    const err = new Error('READY_FAILED: empty TID');
    err.code = 'READY_NO_TID';
    err.stage = 'READY';
    throw err;
  }

  return { tid, raw: Object.fromEntries(map) };
}


// 다날 WebAuth로 보낼 자동 submit 폼(웹/모바일 공용)
// ByPassValue는 CPCGI로 그대로 POST됨
function buildWauthFormHtml({ tid, bgColor = '00', charSet = 'EUC-KR', backUrl, useMobile = false, extraBypass = {} }) {
  const startUrl = useMobile ? WAUTH_MOBILE_START : WAUTH_WEB_START;

  // 필수: TID
  // 선택: BackURL, BgColor, IsCharSet, 그 외 모든 필드는 CPCGI에 ByPass로 전달
  const fields = {
    TID: tid,
    BackURL: backUrl || `${resolveCallbackBase()}/debug/pass-back`, // 없으면 빈값 가능
    BgColor: bgColor,
    IsCharSet: charSet,
    ...extraBypass,
  };

  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Danal PASS</title></head>
<body>
<form id="passStart" action="${startUrl}" method="post">
${inputs}
</form>
<script>document.getElementById('passStart').submit();</script>
</body></html>`;
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// CPCGI 단계: TID로 CONFIRM 호출하여 CI/DI 등 수신
async function confirmByTid(tid, { idenOption = 1, confirmOption = 0, orderId = '' } = {}) {
  const payload = {
    TXTYPE: 'CONFIRM',
    TID: tid,
    CONFIRMOPTION: String(confirmOption),
    IDENOPTION: String(idenOption),
  };
  if (confirmOption === 1) {
    payload.CPID = CPID;
    payload.ORDERID = orderId || '';
  }

  const body = qs.stringify(payload);
  let res;
  try {
    res = await axios.post(UAS_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      timeout: 7000,
      validateStatus: () => true
    });
  } catch (e) {
    return {
      success: false,
      failCode: e.code === 'ECONNABORTED' ? 'CONFIRM_TIMEOUT' : 'CONFIRM_NETWORK',
      returnMsg: e.message || '',
      txId: tid,
      raw: { error: e.message || String(e) }
    };
  }

  const text = Buffer.isBuffer(res.data) ? res.data.toString('utf8') : String(res.data || '');
  const map = new Map();
  for (const kv of text.split('&')) {
    const [k, v = ''] = kv.split('=');
    if (k) map.set(k, v);
  }

  const code = map.get('RETURNCODE') || '';
  const ok = code === '0000';

  const dob = map.get('DOB') || '';
  const sex = map.get('SEX') || '';
  const gender = sex === '1' ? 'M' : (sex === '2' ? 'F' : '');

  return {
    success: ok,
    failCode: ok ? null : code,
    returnMsg: map.get('RETURNMSG') || '',
    txId: map.get('TID') || tid,
    name: map.get('NAME') || '',
    birthdate: dob,
    gender,
    phone: '',
    carrier: '',
    ci: map.get('CI') || '',
    di: map.get('DI') || '',
    raw: Object.fromEntries(map),
  };
}


// ─────────────────────────────────────────────────────────────
// Public API (passRouter에서 사용)
// ─────────────────────────────────────────────────────────────
module.exports = {
  /**
   * /api/auth/pass/start 에서 호출
   * 1) UAS Ready(ITEMSEND) → TID
   * 2) wauth Start.php 로 auto-submit 되는 HTML 반환
   * 프런트가 XHR로 요청한다면 { formHtml } JSON으로 싸서 반환하고,
   * 팝업/새창에 바로 띄우려면 text/html 그대로 응답하면 됩니다.
   */
  async buildStart({ orderId, userId, intent, mode = 'json' }) {
    const { tid } = await startReady({ orderId, userId, cpTitle: 'tzchat.tazocode.com' });

    const backUrl = `${resolveCallbackBase()}/api/auth/pass/back`; // 선택(없어도 됨)
    const formHtml = buildWauthFormHtml({
      tid,
      backUrl,
      bgColor: '00',
      charSet: 'EUC-KR',
      useMobile: false,       // 필요 시 UA보고 분기
      extraBypass: { ByPassValue: intent || 'unified' },
    });

    return (mode === 'html') ? { contentType: 'text/html', body: formHtml } : { formHtml, tid };
  },

  /**
   * CPCGI 역할: 다날 WebAuth 가 TARGETURL로 POST(TID 등) → 여기서 CONFIRM 수행
   * req: Express req (GET/POST 모두 허용)
   */
  async parseCallback(req) {
    const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const tid = src.TID || src.tid || '';

    if (!tid) {
      return { success: false, failCode: 'NO_TID', raw: src };
    }

    // CONFIRM 호출(표준: IDENOPTION=1 → DOB/SEX 분리)
    const result = await confirmByTid(tid, { idenOption: 1, confirmOption: 0 });

    return result; // { success, name, birthdate, gender, ci, di, ... }
  },
};
 