// backend/routes/pass/passRouter.js
// base: /api/auth/pass
// - POST /start
// - GET  /start/html/:txId      ← 외부 브라우저용 캐시된 HTML 서빙
// - ALL  /callback               ← 결과 저장 후 /relay 로 302 리다이렉트
// - GET  /status
// - GET  /route
// - GET  /result/:txId
// - GET  /relay                  ← NEW: 웹/앱 통합 릴레이 페이지

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qs = require('querystring');

const { PassResult, User, PassIdentity } = require('@/models');
const danal = require('@/lib/pass/danalClient');

const sha256Hex = (s = '') => crypto.createHash('sha256').update(String(s)).digest('hex');

const maskName = (name = '') => {
  const n = String(name);
  if (n.length <= 1) return n;
  return n[0] + '*'.repeat(Math.max(1, n.length - 1));
};

// KR 기본 E.164 정규화 (+국제번호면 그대로)
function normalizePhoneKR(raw = '') {
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+0')) clean = '+' + clean.slice(2);
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  if (clean.startsWith('82')) return '+' + clean;
  return '+82' + clean;
}

function resolvePostMessageTarget() {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProd) {
    return process.env.APP_WEB_ORIGIN || process.env.API_ORIGIN || 'https://tzchat.tazocode.com';
  }
  return '*';
}

function json(res, status, body) {
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(status).json(body);
}

// 퍼블릭 오리진(외부 브라우저에서 접근 가능해야 함)
function getPublicOrigin(req) {
  const env = (process.env.APP_WEB_ORIGIN || process.env.API_ORIGIN || process.env.PUBLIC_API_ORIGIN || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

/* ──────────────── 공급사 필드 추출 유틸 ──────────────── */
function toStr(v){ return (v==null ? '' : String(v)); }
function digits(s){ return toStr(s).replace(/[^\d+]/g,''); }
function plausibleKRPhone(s) {
  const d = digits(s);
  if (!/^\+?\d{9,14}$/.test(d)) return '';
  if (d.startsWith('+82') || d.startsWith('010') || d.startsWith('011') || d.startsWith('016') || d.startsWith('017') || d.startsWith('018') || d.startsWith('019')) {
    return normalizePhoneKR(d);
  }
  return normalizePhoneKR(d);
}
function deepScanForPhone(obj, maxDepth=3, path='') {
  try {
    if (!obj || typeof obj !== 'object' || maxDepth < 0) return { phone: '', via: '' };
    for (const [k, v] of Object.entries(obj)) {
      const key = String(k).toLowerCase();
      if (/(phone|mobile|hp|cell|tel|msisdn)/.test(key)) {
        const cand = plausibleKRPhone(v);
        if (cand) return { phone: cand, via: `deep:${path}${k}` };
      }
      if (typeof v === 'string') {
        const cand = plausibleKRPhone(v);
        if (cand) return { phone: cand, via: `deep:${path}${k}(str)` };
      }
      if (v && typeof v === 'object') {
        const sub = deepScanForPhone(v, maxDepth-1, `${path}${k}.`);
        if (sub.phone) return sub;
      }
    }
  } catch {}
  return { phone: '', via: '' };
}
function extractPhoneOne(source, label) {
  if (!source) return { phone: '', via: '' };
  const flat = [
    source.phone, source.phoneNo, source.phoneno,
    source.mobileno, source.mobileNo, source.mobile, source.cellphone, source.hp, source.hpNo,
    source.PHONE, source.PHONE_NO, source.PHONENO, source.TEL_NO, source.TELNO,
    source.MOBILE, source.MOBILE_NO, source.MOBILENO, source.MOBILENUM, source['MOBILE-NO'],
    source.HP, source.HP_NO, source.CELLPHONE, source.MSISDN,
    source.USER_PHONE, source.USER_MOBILE, source.CI_PHONENO, source.CI_PHONE,
  ];
  for (const v of flat) {
    const cand = plausibleKRPhone(v);
    if (cand) return { phone: cand, via: `flat:${label}` };
  }
  const deep = deepScanForPhone(source, 3, `${label}.`);
  if (deep.phone) return deep;
  return { phone: '', via: '' };
}
function extractPhoneFromSources(parsed, raw, body, query) {
  const tryList = [
    { obj: parsed, label: 'parsed' },
    { obj: raw,    label: 'raw' },
    { obj: body,   label: 'body' },
    { obj: query,  label: 'query' },
  ];
  for (const {obj, label} of tryList) {
    const r = extractPhoneOne(obj || {}, label);
    if (r.phone) return r;
  }
  return { phone: '', via: '' };
}
function extractCarrierFromParsed(parsed = {}, raw = {}, body = {}, query = {}) {
  const candidates = [
    parsed.carrier, parsed.telco, parsed.telecom,
    raw.TELCO, raw.TELCO_CODE, raw.CARRIER, raw.CI_TELECOM, raw.TELECOM, raw.CARRIER_NAME, raw.TELCOM, raw.OPERATOR,
    body.TELCO, body.TELCO_CODE, body.CARRIER, body.TELECOM, body.CARRIER_NAME,
    query.TELCO, query.TELCO_CODE, query.CARRIER, query.TELECOM, query.CARRIER_NAME,
  ];
  for (const v of candidates) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}
function mapCarrier(code) {
  if (!code) return '';
  const up = String(code).toUpperCase();
  if (up.includes('SKT')) return up.includes('MVNO') ? 'SKT(MVNO)' : 'SKT';
  if (up === 'KT' || up.includes('KT')) return up.includes('MVNO') ? 'KT(MVNO)' : 'KT';
  if (up.includes('LG')) return up.includes('MVNO') ? 'LGU+(MVNO)' : 'LGU+';
  if (up.includes('MVNO')) return 'MVNO';
  return up;
}

/* ===================== 메모리 HTML 캐시 ===================== */
const htmlCache = new Map(); // txId -> { html, expireAt }
const HTML_TTL_MS = 5 * 60 * 1000;
function saveHtml(txId, html) {
  htmlCache.set(txId, { html, expireAt: Date.now() + HTML_TTL_MS });
  setTimeout(() => { const v = htmlCache.get(txId); if (v && v.expireAt <= Date.now()) htmlCache.delete(txId); }, HTML_TTL_MS + 5000);
}
function loadHtml(txId) {
  const v = htmlCache.get(txId);
  if (!v) return null;
  if (v.expireAt <= Date.now()) { htmlCache.delete(txId); return null; }
  return v.html;
}

/* ===================== 릴레이 HTML 생성 ===================== */
// 환경변수로 앱 링크/스킴 설정 가능
const APP_PACKAGE = process.env.ANDROID_APP_PACKAGE || process.env.APP_PACKAGE || 'com.example.tzchat';
const APP_LINK_BASE = (process.env.APP_LINK_BASE || 'https://tzchat.tazocode.com').replace(/\/+$/, '');
const CUSTOM_SCHEME = process.env.APP_CUSTOM_SCHEME || 'tzchat';
const USE_INTENT = String(process.env.PASS_USE_INTENT || '0') === '1'; // 커스텀스킴+intent 병행할지

function buildRelayHtml({ txId, targetOrigin, appLinkBase }) {
  const appLinks = `${appLinkBase}/app/pass-result?txId=${encodeURIComponent(txId)}`;
  const customScheme = `${CUSTOM_SCHEME}://pass-result?txId=${encodeURIComponent(txId)}`;
  const intentUrl =
    `intent://pass-result?txId=${encodeURIComponent(txId)}#Intent;scheme=${encodeURIComponent(CUSTOM_SCHEME)};package=${encodeURIComponent(APP_PACKAGE)};S.browser_fallback_url=${encodeURIComponent(appLinks)};end`;

  return `<!doctype html>
<meta charset="utf-8">
<title>PASS 처리중…</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body{height:100%;margin:0;background:#111;color:#ddd;font-family:system-ui,Segoe UI,Roboto,Apple SD Gothic Neo,Pretendard,sans-serif}
  .wrap{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;text-align:center}
  .small{opacity:.7;font-size:12px}
</style>
<div class="wrap">
  <div>인증 결과를 전달하는 중…</div>
  <div class="small">잠시만 기다려주세요.</div>
</div>
<script>
(function(){
  var txId = ${JSON.stringify(txId)};
  // 1) 같은 브라우저 컨텍스트(웹 팝업/동일 탭) 전달
  try {
    if (txId) localStorage.setItem('PASS_RESULT_TX', txId);
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'PASS_RESULT', txId: txId }, ${JSON.stringify(targetOrigin)});
    }
  } catch(e){}

  // 2) 앱(커스텀탭) 신호
  var appLinks = ${JSON.stringify(appLinks)};
  var customScheme = ${JSON.stringify(customScheme)};
  var intentUrl = ${JSON.stringify(intentUrl)};

  // 기본: App Links로 앱 깨우기
  setTimeout(function(){ location.href = appLinks; }, 150);

  ${USE_INTENT ? `
  // 선택: 커스텀 스킴 + 인텐트 보강
  setTimeout(function(){ location.href = customScheme; }, 350);
  setTimeout(function(){ location.href = intentUrl; }, 650);
  ` : ''}

  // 3) 웹 팝업이면 닫기 시도
  setTimeout(function(){ try{ window.close(); }catch(e){} }, 1000);

  // 디버그 마커
  setTimeout(function(){
    document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;bottom:8px;left:8px;font-size:11px;opacity:.4">OK</div>');
  }, 1200);
})();
</script>`;
}

/* ===================== 1) START ======================= */
router.get('/start/ping', (req, res) => json(res, 200, { ok: true, pong: true, now: Date.now() }));

// APP 방식(방법 A): { ok, txId, startUrl } 반환 (외부 브라우저 열기)
router.all('/start', async (req, res) => {
  try {
    const intent = (req.body && req.body.intent) || (req.query && req.query.intent) || 'unified';
    const preferUrl = String((req.body && req.body.preferUrl) || (req.query && req.query.preferUrl) || '') === 'true'
                   || String((req.body && req.body.preferUrl) || (req.query && req.query.preferUrl) || '') === '1';
    const stub   = (req.query && req.query.stub)   || (req.body && req.body.stub);

    // 간이 STUB
    if (String(stub).toLowerCase() === '1' || String(stub).toLowerCase() === 'true') {
      const tx = `stub_${Date.now()}`;
      const html = `<!doctype html><html><body>
<form id="f" action="about:blank" method="post"><input type="hidden" name="TID" value="${tx}"></form>
<script>document.getElementById('f').submit();</script>
</body></html>`;
      saveHtml(tx, html);
      const startUrl = `${getPublicOrigin(req)}/api/auth/pass/start/html/${encodeURIComponent(tx)}`;
      return json(res, 200, { ok: true, txId: tx, startUrl });
    }

    // 실제 시작
    const out = await danal.buildStart({ intent, mode: 'json' });
    if (!out || (!out.body && !out.formHtml)) {
      return json(res, 502, { ok: false, code: 'START_NO_FORM', message: 'formHtml not generated' });
    }
    const txId = out.tid || `tid_${Date.now()}`;
    const html = out.body || out.formHtml;

    if (preferUrl) {
      // 캐시에 저장하고 URL만 돌려준다 (앱은 이 URL을 외부브라우저로 open)
      saveHtml(txId, html);
      const startUrl = `${getPublicOrigin(req)}/api/auth/pass/start/html/${encodeURIComponent(txId)}`;
      return json(res, 200, { ok: true, txId, startUrl });
    }

    // 과거(웹 팝업) 호환: formHtml 직접 반환
    return json(res, 200, { ok: true, txId, formHtml: html });
  } catch (e) {
    const code  = e?.code || e?.returnCode || 'START_ERROR';
    const theStage = e?.stage || 'UNKNOWN';
    const msg   = e?.message ? String(e.message).slice(0, 400) : 'PASS 시작 실패';
    console.error('[PASS/start] error:', { code, stage: theStage, msg });
    return json(res, 500, { ok: false, code, stage: theStage, message: msg });
  }
});

// 캐시에 저장된 HTML을 그대로 반환(외부 브라우저에서 열림)
router.get('/start/html/:txId', (req, res) => {
  const { txId } = req.params || {};
  const html = txId && loadHtml(txId);
  if (!html) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send('<!doctype html><html><body>Invalid or expired PASS session.</body></html>');
  }
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(200).send(html);
});

/* ===================== 2) CALLBACK ==================== */
router.all('/callback', async (req, res) => {
  try {
    try {
      const ctype = (req.headers['content-type'] || '').toLowerCase();
      const hasRaw = Buffer.isBuffer(req.rawBody);
      const rawLen = hasRaw ? req.rawBody.length : 0;
      console.log('[PASS/callback][hit]', { method: req.method, ctype, hasRaw, rawLen, q: Object.keys(req.query||{}), b: Object.keys(req.body||{}) });
    } catch {}

    // x-www-form-urlencoded 원문 재파싱(다날 EUC-KR 대응)
    if (req.method === 'POST') {
      const ctype = (req.headers['content-type'] || '').toLowerCase();
      if (ctype.includes('application/x-www-form-urlencoded')) {
        if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
          let text;
          try { text = require('iconv-lite').decode(req.rawBody, 'euc-kr'); }
          catch { text = req.rawBody.toString('utf8'); }
          req.body = qs.parse(text);
          console.log('[PASS/callback][decoded]', { len: text.length, keys: Object.keys(req.body||{}) });
        }
      }
    }

    // 1) 파싱
    const parsed = await danal.parseCallback(req);
    const txId = parsed.txId || `tx_${Date.now()}`;

    // 2) 핵심 필드 가공
    const birthdate = (parsed.birthdate && /^\d{8}$/.test(parsed.birthdate)) ? parsed.birthdate : '';
    const birthyear = birthdate ? Number(birthdate.slice(0,4)) : (Number(parsed.birthyear) || null);
    const g = String(parsed.gender || '').toUpperCase();
    const gender = (g === 'M' || g === 'MAN') ? 'man' : ((g === 'F' || g === 'WOMAN') ? 'woman' : '');

    const { phone: extractedPhone, via: phoneVia } = extractPhoneFromSources(parsed, parsed.raw || {}, req.body || {}, req.query || {});
    const phone  = extractedPhone ? normalizePhoneKR(extractedPhone) : '';

    const rawCarrierCandidate = extractCarrierFromParsed(parsed, parsed.raw || {}, req.body || {}, req.query || {});
    const carrier = mapCarrier(rawCarrierCandidate);

    const ciHash = parsed.ci ? sha256Hex(parsed.ci) : '';
    const diHash = parsed.di ? sha256Hex(parsed.di) : '';
    const nameMasked = maskName(parsed.name || '');

    const rawMasked = {
      ...parsed.raw,
      birthdate: birthdate || undefined,
      birthyear,
      ci: undefined,
      di: undefined,
      name: nameMasked,
      phone,
      carrier,
      __debug_phone_via: phoneVia || null,
      __debug_keys: {
        body: Object.keys(req.body || {}),
        query: Object.keys(req.query || {}),
        parsed: Object.keys(parsed || {}),
        raw: Object.keys(parsed?.raw || {})
      }
    };

    // 3) 결과 upsert
    try {
      const saved = await PassResult.findOneAndUpdate(
        { txId },
        {
          $set: {
            intent: parsed.intent || 'unified',
            status: parsed.success ? 'success' : 'fail',
            failCode: parsed.success ? null : (parsed.failCode || 'UNKNOWN'),
            failMessage: parsed.returnMsg || null,
            name: nameMasked,
            birthyear,
            gender,
            phone: phone || '',
            carrier: carrier || '',
            ciHash: ciHash || undefined,
            diHash: diHash || undefined,
            rawMasked,
            sensitiveFieldsRedacted: true,
          },
          $setOnInsert: { consumed: false, createdAt: new Date() },
        },
        { upsert: true, new: true }
      );
      console.log('[PASS/callback][upsert]', {
        txId: saved?.txId || txId,
        status: saved?.status || (parsed.success ? 'success' : 'fail'),
        hasPhone: !!phone,
        phoneVia: phoneVia || '(none)',
        phoneSample: phone ? (phone.slice(0, 4) + '...' + phone.slice(-2)) : '(empty)',
        carrier
      });
    } catch (dbErr) {
      console.warn('[PASS/callback][db] upsert warn:', dbErr?.message || dbErr);
    }

    // 4) 결과 페이지는 통합 릴레이로 이동(웹/앱 모두 동일 경로)
    const redirectUrl = `${getPublicOrigin(req)}/api/auth/pass/relay?txId=${encodeURIComponent(txId)}`;
    return res.redirect(302, redirectUrl);

  } catch (e) {
    console.error('[PASS/callback] hard error:', e?.stack || e?.message || e);
    // 실패 시에도 릴레이로 넘겨 postMessage/localStorage 처리(웹 팝업 닫기) 가능하게 함
    const redirectUrl = `${getPublicOrigin(req)}/api/auth/pass/relay?txId=${encodeURIComponent('')}`;
    try { return res.redirect(302, redirectUrl); } catch { return res.status(500).send('CALLBACK_ERROR'); }
  }
});

/* ===================== 2.5) RELAY (웹/앱 브리지) ==================== */
router.get('/relay', (req, res) => {
  const txId = String(req.query.txId || '');
  const targetOrigin = resolvePostMessageTarget();
  const html = buildRelayHtml({ txId, targetOrigin, appLinkBase: APP_LINK_BASE });
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(200).send(html);
});

/* ===================== 3) STATUS ====================== */
router.get('/status', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId) return json(res, 400, { ok: false, code: 'NO_TXID', message: 'txId required' });

    const doc = await PassResult.findOne({ txId }).lean();
    if (!doc) return json(res, 200, { ok: true, status: 'pending' });

    if (doc.consumed === true) return json(res, 200, { ok: true, status: 'consumed', txId });

    if (doc.status === 'success') {
      return json(res, 200, {
        ok: true,
        status: 'success',
        result: {
          txId: doc.txId,
          status: doc.status,
          ciHash: doc.ciHash || null,
          diHash: doc.diHash || null,
          name: doc.name || '',
          birthyear: doc.birthyear ?? null,
          gender: doc.gender || '',
          phone: doc.phone || '',
          carrier: doc.carrier || '',
          debugPhoneVia: doc.rawMasked?.__debug_phone_via || null,
          debugKeys: doc.rawMasked?.__debug_keys || null,
        },
      });
    }

    if (doc.status === 'fail') {
      return json(res, 200, {
        ok: true,
        status: 'fail',
        result: {
          txId: doc.txId,
          status: doc.status,
          failCode: doc.failCode || 'UNKNOWN',
          failMessage: doc.failMessage || (doc.rawMasked && doc.rawMasked.RETURNMSG) || null
        },
      });
    }

    return json(res, 200, { ok: true, status: 'pending' });
  } catch (e) {
    console.error('[PASS/status] error:', e);
    return json(res, 500, { ok: false, code: 'STATUS_ERROR', message: '상태 조회 실패' });
  }
});

/* ===================== 4) RESULT ====================== */
router.get('/result/:txId', async (req, res) => {
  try {
    const { txId } = req.params || {};
    if (!txId) return json(res, 400, { ok: false, code: 'NO_TXID' });

    const doc = await PassResult.findOne({ txId }).lean();
    if (!doc) return json(res, 404, { ok: false, code: 'NOT_FOUND' });
    if (doc.consumed === true) return json(res, 410, { ok: false, code: 'CONSUMED' });

    return json(res, 200, {
      ok: true,
      status: doc.status,
      result: {
        txId: doc.txId,
        status: doc.status,
        failCode: doc.status === 'fail' ? (doc.failCode || 'UNKNOWN') : null,
        failMessage: doc.status === 'fail' ? (doc.failMessage || (doc.rawMasked && doc.rawMasked.RETURNMSG) || null) : null,
        ciHash: doc.ciHash || null,
        diHash: doc.diHash || null,
        name: doc.name || '',
        birthyear: doc.birthyear ?? null,
        gender: doc.gender || '',
        phone: doc.phone || '',
        carrier: doc.carrier || '',
      },
    });
  } catch (e) {
    console.error('[PASS/result] error:', e);
    return json(res, 500, { ok: false, code: 'RESULT_ERROR' });
  }
});

/* ===================== 5) ROUTE (CI-only & real user check) ====================== */
router.get('/route', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId) return json(res, 400, { ok: false, code: 'NO_TXID' });

    const pr = await PassResult.findOne({ txId }).lean();
    if (!pr) return json(res, 404, { ok: false, code: 'PASS_TX_NOT_FOUND' });
    if (pr.consumed === true) return json(res, 410, { ok: false, code: 'CONSUMED' });
    if (pr.status === 'fail') return json(res, 200, { ok: false, code: pr.failCode || 'FAIL', message: pr.failMessage || 'pass failed' });
    if (pr.status !== 'success') return json(res, 200, { ok: false, code: 'PASS_NOT_SUCCESS', status: pr.status });

    if (!pr.ciHash) {
      return json(res, 200, { ok: true, route: 'signup', txId, userExists: false });
    }

    let userExists = false;

    const ident = await PassIdentity.findOne({ ciHash: pr.ciHash }).select('userId').lean().catch(() => null);
    if (ident?.userId) {
      const linked = await User.findOne({ _id: ident.userId }).select('_id').lean();
      if (linked?._id) userExists = true;
    }

    if (!userExists) {
      const found = await User.findOne({
        $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
      }).select('_id').lean();
      if (found?._id) userExists = true;
    }

    const routeName = userExists ? 'templogin' : 'signup';
    return json(res, 200, { ok: true, route: routeName, txId, userExists });
  } catch (e) {
    console.error('[PASS/route] error:', e);
    return json(res, 500, { ok: false, code: 'ROUTE_UNHANDLED', message: e?.message || '분기 결정 실패' });
  }
});

module.exports = router;
