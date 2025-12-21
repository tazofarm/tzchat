// backend/routes/pass/passStartRouter.js
// base: /api/auth/pass
// - GET  /start/ping
// - ALL  /start                  ← 앱/웹 공용 시작 (preferUrl=1이면 외부 브라우저용 URL 반환)
// - GET  /start/html/:txId       ← 외부 브라우저용 캐시된 HTML 서빙
// - GET  /relay                  ← 웹/앱 통합 릴레이 페이지(복귀: tzchat://pass?txId=... or ?identityVerificationId=...)

const express = require('express');
const router = express.Router();
const qs = require('querystring');

const danal = require('@/lib/pass/danalClient');

/* ──────────────── 공통 유틸 ──────────────── */

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
  const env = (
    process.env.APP_WEB_ORIGIN ||
    process.env.API_ORIGIN ||
    process.env.PUBLIC_API_ORIGIN ||
    ''
  ).replace(/\/+$/, '');
  if (env) return env;

  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function resolvePostMessageTarget() {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProd) {
    return (
      process.env.APP_WEB_ORIGIN ||
      process.env.API_ORIGIN ||
      'https://tzchat.tazocode.com'
    );
  }
  return '*';
}

/* ──────────────── 메모리 HTML 캐시 ──────────────── */

const htmlCache = new Map(); // txId -> { html, expireAt }
const HTML_TTL_MS = 5 * 60 * 1000;

function saveHtml(txId, html) {
  htmlCache.set(txId, { html, expireAt: Date.now() + HTML_TTL_MS });
  setTimeout(() => {
    const v = htmlCache.get(txId);
    if (v && v.expireAt <= Date.now()) htmlCache.delete(txId);
  }, HTML_TTL_MS + 5000);
}

function loadHtml(txId) {
  const v = htmlCache.get(txId);
  if (!v) return null;
  if (v.expireAt <= Date.now()) {
    htmlCache.delete(txId);
    return null;
  }
  return v.html;
}

/* ──────────────── 릴레이 HTML 생성 ──────────────── */

// 환경변수로 앱 링크/스킴 설정 가능
const APP_PACKAGE =
  process.env.ANDROID_APP_PACKAGE ||
  process.env.APP_PACKAGE ||
  'com.example.tzchat';

const APP_LINK_BASE = (process.env.APP_LINK_BASE || 'https://tzchat.tazocode.com').replace(
  /\/+$/,
  ''
);

const CUSTOM_SCHEME = process.env.APP_CUSTOM_SCHEME || 'tzchat';

// 커스텀 스킴 + intent 복귀를 항상 시도
const USE_INTENT = true;

/**
 * ✅ 중요:
 * - PortOne: identityVerificationId 기준
 * - Danal PASS: txId 기준
 * 릴레이는 둘 다 지원하고, identityVerificationId가 있으면 그걸 우선 사용
 *
 * ✅ 그리고 "복귀 목적지"는 pass-result가 아니라 PassPortal(/pass)로 통일
 * - 웹:  https://.../pass?txId=... 또는 ?identityVerificationId=...
 * - 앱:  tzchat://pass?txId=... 또는 ?identityVerificationId=...
 */
function buildRelayHtml({ txId, identityVerificationId, targetOrigin, appLinkBase }) {
  const safeTxId = String(txId || '');
  const safeIvId = String(identityVerificationId || '');

  // 쿼리 우선순위: identityVerificationId > txId
  const q = safeIvId
    ? `identityVerificationId=${encodeURIComponent(safeIvId)}`
    : `txId=${encodeURIComponent(safeTxId)}`;

  // ✅ PassPortal 라우트로 복귀
  const webReturn = `${appLinkBase}/pass?${q}`;
  const customScheme = `${CUSTOM_SCHEME}://pass?${q}`;

  // ✅ intent도 pass로 통일 (fallback: webReturn)
  const intent = `intent://pass?${q}#Intent;scheme=${encodeURIComponent(
    CUSTOM_SCHEME
  )};package=${encodeURIComponent(
    APP_PACKAGE
  )};S.browser_fallback_url=${encodeURIComponent(webReturn)};end`;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>PASS 인증 처리중…</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html,body{height:100%;margin:0;background:#111;color:#ddd;font-family:system-ui,Segoe UI,Roboto,Apple SD Gothic Neo,Pretendard,sans-serif}
    .wrap{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;text-align:center;padding:24px;box-sizing:border-box}
    .spinner{width:40px;height:40px;border-radius:50%;border:4px solid rgba(255,255,255,.2);border-top-color:#ffd54f;animation:spin 1s linear infinite;margin-bottom:8px}
    .title{font-size:18px;font-weight:600}
    .small{opacity:.7;font-size:12px;line-height:1.5}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="spinner"></div>
    <div class="title">유저 정보를 불러오고 있습니다</div>
    <div class="small">
      잠시만 기다려 주세요.<br/>
      인증 결과를 앱으로 전달하는 중입니다.
    </div>
    <div class="small" style="opacity:.5;margin-top:8px;">
      ${safeIvId ? `identityVerificationId: ${safeIvId}` : `txId: ${safeTxId || '—'}`}
    </div>
  </div>
  <script>
  (function(){
    var txId = ${JSON.stringify(safeTxId)};
    var identityVerificationId = ${JSON.stringify(safeIvId)};
    var targetOrigin = ${JSON.stringify(targetOrigin)};
    var webReturn = ${JSON.stringify(webReturn)};
    var customScheme = ${JSON.stringify(customScheme)};
    var intentUrl = ${JSON.stringify(intent)};

    function safeOpen(url){
      if(!url) return;
      try{ location.href = url; }catch(e){}
    }

    // 1) 웹/팝업 ↔ 부모창 통신(웹용)
    try{
      if(identityVerificationId){
        localStorage.setItem('PASS_LAST_IV_ID', identityVerificationId);
      }
      if(txId){
        localStorage.setItem('PASS_RESULT_TX', txId);
      }
      if(window.opener && !window.opener.closed){
        window.opener.postMessage(
          { type: 'PASS_RESULT', txId: txId, identityVerificationId: identityVerificationId },
          targetOrigin
        );
      }
    }catch(e){}

    // 2) 앱 복귀 시도: 커스텀 스킴 → 인텐트(웹 fallback 포함)
    setTimeout(function(){
      safeOpen(customScheme);
    }, 300);

    ${USE_INTENT ? `
    setTimeout(function(){
      safeOpen(intentUrl);
    }, 1200);
    ` : ''}

    // 3) 앱이 없거나 실패하면 웹(/pass)으로 복귀
    setTimeout(function(){
      safeOpen(webReturn);
    }, 2200);

    // 4) 웹 팝업으로 열린 경우에만 창 닫기 시도
    setTimeout(function(){
      try{
        if(window.opener && !window.opener.closed){
          window.close();
        }
      }catch(e){}
    }, 3000);
  })();
  </script>
</body>
</html>`;
}

/* ===================== 1) START ======================= */

router.get('/start/ping', (req, res) =>
  json(res, 200, { ok: true, pong: true, now: Date.now() })
);

// APP 방식(방법 A): { ok, txId, startUrl } 반환 (외부 브라우저 열기)
router.all('/start', async (req, res) => {
  try {
    const intent =
      (req.body && req.body.intent) ||
      (req.query && req.query.intent) ||
      'unified';

    const preferUrl =
      String(
        (req.body && req.body.preferUrl) ||
          (req.query && req.query.preferUrl) ||
          ''
      ) === 'true' ||
      String(
        (req.body && req.body.preferUrl) ||
          (req.query && req.query.preferUrl) ||
          ''
      ) === '1';

    const stub = (req.query && req.query.stub) || (req.body && req.body.stub);

    // 간이 STUB
    if (
      String(stub).toLowerCase() === '1' ||
      String(stub).toLowerCase() === 'true'
    ) {
      const tx = `stub_${Date.now()}`;
      const html = `<!doctype html><html><body>
<form id="f" action="about:blank" method="post"><input type="hidden" name="TID" value="${tx}"></form>
<script>document.getElementById('f').submit();</script>
</body></html>`;
      saveHtml(tx, html);
      const startUrl = `${getPublicOrigin(
        req
      )}/api/auth/pass/start/html/${encodeURIComponent(tx)}`;
      return json(res, 200, { ok: true, txId: tx, startUrl });
    }

    // 실제 시작
    const out = await danal.buildStart({ intent, mode: 'json' });
    if (!out || (!out.body && !out.formHtml)) {
      return json(res, 502, {
        ok: false,
        code: 'START_NO_FORM',
        message: 'formHtml not generated',
      });
    }

    const txId = out.tid || `tid_${Date.now()}`;
    const html = out.body || out.formHtml;

    if (preferUrl) {
      // 캐시에 저장하고 URL만 돌려준다 (앱은 이 URL을 외부브라우저로 open)
      saveHtml(txId, html);
      const startUrl = `${getPublicOrigin(
        req
      )}/api/auth/pass/start/html/${encodeURIComponent(txId)}`;
      return json(res, 200, { ok: true, txId, startUrl });
    }

    // 과거(웹 팝업) 호환: formHtml 직접 반환
    return json(res, 200, { ok: true, txId, formHtml: html });
  } catch (e) {
    const code = e?.code || e?.returnCode || 'START_ERROR';
    const theStage = e?.stage || 'UNKNOWN';
    const msg = e?.message
      ? String(e.message).slice(0, 400)
      : 'PASS 시작 실패';
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
    return res
      .status(404)
      .send(
        '<!doctype html><html><body>Invalid or expired PASS session.</body></html>'
      );
  }
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(200).send(html);
});

/* ===================== 2) RELAY (웹/앱 브리지) ==================== */

router.get('/relay', (req, res) => {
  const txId = String(req.query.txId || '');
  const identityVerificationId = String(req.query.identityVerificationId || '');
  const targetOrigin = resolvePostMessageTarget();

  const html = buildRelayHtml({
    txId,
    identityVerificationId,
    targetOrigin,
    appLinkBase: APP_LINK_BASE,
  });

  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(200).send(html);
});

module.exports = router;
