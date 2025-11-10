// backend/routes/pass/passRouter.js
// base: /api/auth/pass
// - POST /start
// - GET  /start?mode=html
// - ALL  /callback
// - GET  /status
// - GET  /route

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const { PassResult, User } = require('@/models');
const danal = require('@/lib/pass/danalClient');
const {
  decodeBody,
  parseFormLike,
  validateMinimalFields,
  getCharset,
} = require('@/lib/pass/danalCallback');

const sha256Hex = (s = '') => crypto.createHash('sha256').update(String(s)).digest('hex');

const maskName = (name = '') => {
  const n = String(name);
  if (n.length <= 1) return n;
  return n[0] + '*'.repeat(Math.max(1, n.length - 1));
};

function normalizePhoneKR(raw = '') {
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+0')) clean = '+' + clean.slice(2);
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  return '+82' + clean;
}

function resolvePostMessageTarget() {
  if (process.env.PASS_POSTMSG_ORIGIN) return process.env.PASS_POSTMSG_ORIGIN;
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProd) {
    return (
      process.env.API_ORIGIN ||
      process.env.PASS_CALLBACK_PROD ||
      'https://tzchat.tazocode.com'
    );
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

/* =========================================================
 * 1) PASS 시작
 * =======================================================*/
router.get('/start/ping', (req, res) => json(res, 200, { ok: true, pong: true, now: Date.now() }));

router.all('/start', async (req, res) => {
  try {
    const intent = (req.body && req.body.intent) || (req.query && req.query.intent) || 'unified';
    const mode   = (req.query && req.query.mode)   || (req.body && req.body.mode)   || 'json';
    const stub   = (req.query && req.query.stub)   || (req.body && req.body.stub);

    if (String(stub).toLowerCase() === '1' || String(stub).toLowerCase() === 'true') {
      const dummyHtml = `<!doctype html><html><body>
<form id="f" action="about:blank" method="post">
  <input type="hidden" name="TID" value="STUB_${Date.now()}">
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`;
      return json(res, 200, { ok: true, txId: `stub_${Date.now()}`, formHtml: dummyHtml });
    }

    const out = await danal.buildStart({ intent, mode: 'json' });

    if (!out || (!out.formHtml && mode !== 'html')) {
      return json(res, 502, { ok: false, code: 'START_NO_FORM', message: 'formHtml not generated' });
    }

    if (mode === 'html') {
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
      return res.status(200).send(out.body);
    }

    return json(res, 200, { ok: true, txId: out.tid || null, formHtml: out.formHtml || null });
  } catch (e) {
    const code  = e && (e.code || e.returnCode) || 'START_ERROR';
    const stage = e && e.stage || 'START';
    const msg   = e && e.message ? String(e.message).slice(0, 400) : 'PASS 시작 실패';
    console.error('[PASS/start] error:', { code, stage, msg });
    return json(res, 500, { ok: false, code, stage, message: msg });
  }
});

/* =========================================================
 * 2) PASS 콜백
 * =======================================================*/
const raw = express.raw({ type: '*/*', limit: '1mb' });

function popupCloseHtml(payload, targetOrigin) {
  const jsonStr = JSON.stringify(payload).replace(/</g, '\\u003c');
  const origin = JSON.stringify(targetOrigin || '*');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>PASS Callback</title></head>
<body>
<script>
(function(){
  try {
    var data = ${jsonStr};
    try {
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage(data, ${origin});
      }
      try { localStorage.setItem('PASS_RESULT_FALLBACK', JSON.stringify(data)); } catch (e) {}
    } catch (e) { /* noop */ }
  } catch(e) { /* noop */ }
  window.close();
})();
</script>
완료
</body></html>`;
}

// 🔎 잘못 들어온 "시작 폼"을 감지(RESULT_CODE 없음 + dnData/BackURL 등)
function looksLikeStartForm(form = {}) {
  const keys = Object.keys(form || {}).map(k => k.toLowerCase());
  const hasStartKeys = ['dndata', 'backurl'].some(k => keys.includes(k));
  const hasResult = keys.includes('result_code') || keys.includes('resultcode');
  return hasStartKeys && !hasResult;
}

// 🔁 wauth Start.php로 서버에서 릴레이(자동 제출)
function relayToWauthHtml(form = {}) {
  const WAUTH_URL =
    process.env.PASS_WAUTH_URL ||
    'https://wauth.teledit.com/v1.0/Start.php';

  // form key/value를 그대로 보존하여 wauth로 전달
  const inputs = Object.entries(form)
    .map(([k, v]) => {
      const name = String(k);
      const val = v == null ? '' : String(v);
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      return `<input type="hidden" name="${esc(name)}" value="${esc(val)}">`;
    })
    .join('\n');

  return `<!doctype html>
<html><head><meta charset="euc-kr"><title>Relay to WAuth</title></head>
<body>
<form id="wauth" action="${WAUTH_URL}" method="post" accept-charset="euc-kr">
${inputs}
</form>
<script>document.getElementById('wauth').submit();</script>
</body></html>`;
}

router.all('/callback', raw, async (req, res) => {
  const targetOrigin = resolvePostMessageTarget();
  let stage = 'IN';
  try {
    const ctype = (req.headers['content-type'] || '').toLowerCase();
    const charset = getCharset(ctype);
    const rawBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    console.log('[PASS/CB][IN]', { method: req.method, ctype, charset, rawLen: rawBuf.length });

    stage = 'DECODE';
    const text = decodeBody(rawBuf, ctype);
    const rawHead = text ? text.slice(0, 200) : '';
    if (rawHead) console.log('[PASS/CB][RAW.head]', rawHead);

    stage = 'PARSE_FORM';
    let form = text ? parseFormLike(text) : {};
    form = { ...(req.query || {}), ...(form || {}) };
    const parsedKeys = Object.keys(form || {});
    console.log('[PASS/CB][PARSED.keys]', parsedKeys);

    // ✅ A안: 시작폼이 잘못 우리 콜백으로 들어온 경우 → wauth 로 릴레이하여 정상 플로우 복구
    if (looksLikeStartForm(form)) {
      console.warn('[PASS/CB][EARLY_START_POST] Start-form hit our callback. Relaying to wauth.');
      res.set('Content-Type', 'text/html; charset=euc-kr');
      return res.status(200).send(relayToWauthHtml(form));
    }

    stage = 'MIN_CHECK';
    const { ok: minOk, fields: minFields, missing } = validateMinimalFields(form);
    if (!minOk) {
      const payload = {
        type: 'PASS_RESULT',
        ok: false,
        code: 'UNHANDLED_MISSING_FIELDS',
        message: '필수 콜백 필드 누락',
        stage,
        ctype,
        charset,
        parsedKeys,
        rawHead,
        txId: form.TID || form.tid || form.txId || null,
      };
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(popupCloseHtml(payload, targetOrigin));
    }

    stage = 'PARSE_VENDOR';
    let parsed = null;
    try {
      req.body = form; // vendor 파서 호환
      parsed = await danal.parseCallback(req);
    } catch (e) {
      console.warn('[PASS/CB][WARN] parseCallback fail:', e?.message || e);
      parsed = {
        success: (minFields.RESULT_CODE === '0000' || minFields.RESULT_CODE === 'SUCCESS' || minFields.RESULT_CODE === '0'),
        txId: form.TID || form.tid || form.txId || null,
        failCode: (minFields.RESULT_CODE && !(minFields.RESULT_CODE === '0000' || minFields.RESULT_CODE === 'SUCCESS' || minFields.RESULT_CODE === '0'))
          ? String(minFields.RESULT_CODE) : null,
        name: form.NAME || form.name || '',
        birthdate: form.BIRTHDATE || form.birthdate || '',
        birthyear: form.BIRTHYEAR || form.birthyear || '',
        gender: form.GENDER || form.gender || '',
        phone: form.PHONE || form.phone || '',
        carrier: form.CARRIER || form.carrier || '',
        ci: form.CI || form.ci || '',
        di: form.DI || form.di || '',
        raw: form,
      };
    }

    stage = 'SHAPE';
    const txId = parsed.txId || form.TID || form.tid || form.txId || `tx_${Date.now()}`;
    const birthdate = (parsed.birthdate && /^\d{8}$/.test(parsed.birthdate)) ? parsed.birthdate : '';
    const birthyear = birthdate ? Number(birthdate.slice(0, 4)) : (Number(parsed.birthyear) || null);
    const g = (parsed.gender || '').toString().toUpperCase();
    const gender =
      g === 'M' || g === 'MAN' ? 'man' :
      g === 'F' || g === 'WOMAN' ? 'woman' : '';
    const phone = parsed.phone ? normalizePhoneKR(parsed.phone) : '';
    const ciHash = parsed.ci ? sha256Hex(parsed.ci) : '';
    const diHash = parsed.di ? sha256Hex(parsed.di) : '';
    const nameMasked = maskName(parsed.name || '');
    const rawMasked = {
      ...(parsed.raw || form || {}),
      birthdate: birthdate || undefined,
      birthyear,
      ci: undefined,
      di: undefined,
      name: nameMasked,
      phone,
    };

    stage = 'UPSERT';
    try {
      const saved = await PassResult.findOneAndUpdate(
        { txId },
        {
          $set: {
            status: parsed.success ? 'success' : 'fail',
            failCode: parsed.success ? null : (parsed.failCode || minFields.RESULT_CODE || 'UNKNOWN'),
            name: nameMasked,
            birthyear,
            gender,
            phone,
            carrier: parsed.carrier || '',
            ciHash: ciHash || undefined,
            diHash: diHash || undefined,
            rawMasked,
            _dbg: { ctype, charset, parsedKeys, rawHead },
          },
        },
        { upsert: true, new: true }
      );
      console.log('[PASS/CB][UPSERT]', { txId: saved?.txId || txId, status: saved?.status || (parsed.success ? 'success' : 'fail') });
    } catch (dbErr) {
      console.warn('[PASS/CB][DB] upsert warn:', dbErr?.message || dbErr);
    }

    stage = 'REPLY';
    const payload = parsed.success
      ? { type: 'PASS_RESULT', ok: true, txId, stage, ctype, charset, parsedKeys }
      : {
          type: 'PASS_RESULT',
          ok: false,
          code: (parsed.failCode || minFields.RESULT_CODE || 'FAIL').toString().toUpperCase(),
          message: '벤더 실패 코드 반환',
          stage,
          txId,
          ctype,
          charset,
          parsedKeys,
          rawHead,
        };

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(popupCloseHtml(payload, targetOrigin));
  } catch (e) {
    console.error('[PASS/CB][ERR] UNHANDLED:', e?.stack || e?.message || e);
    const payload = {
      type: 'PASS_RESULT',
      ok: false,
      code: 'UNHANDLED_ERROR',
      message: e?.message || 'UNHANDLED_ERROR',
      stage,
    };
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(popupCloseHtml(payload, targetOrigin));
  }
});

/* =========================================================
 * 3) 상태 조회
 * =======================================================*/
router.get('/status', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId) return json(res, 400, { ok: false, code: 'NO_TXID', message: 'txId required' });

    const doc = await PassResult.findOne({ txId }).lean();
    if (!doc) return json(res, 200, { ok: true, status: 'pending' });

    if (doc.status === 'success') {
      return json(res, 200, {
        ok: true,
        status: 'success',
        result: {
          txId: doc.txId,
          status: doc.status,
          failCode: null,
          ciHash: doc.ciHash || null,
          diHash: doc.diHash || null,
          name: doc.name || '',
          birthyear: doc.birthyear ?? null,
          gender: doc.gender || '',
          phone: doc.phone || '',
          carrier: doc.carrier || '',
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
        },
      });
    }

    return json(res, 200, { ok: true, status: 'pending' });
  } catch (e) {
    console.error('[PASS/status] error:', e);
    return json(res, 500, { ok: false, code: 'STATUS_ERROR', message: '상태 조회 실패' });
  }
});

/* =========================================================
 * 4) 분기
 * =======================================================*/
router.get('/route', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId) return json(res, 400, { ok: false, code: 'NO_TXID', message: 'txId required' });

    const doc = await PassResult.findOne({ txId }).lean();
    if (!doc) return json(res, 200, { ok: false, code: 'NO_TX', message: 'no pass tx found' });

    if (doc.status === 'fail') {
      return json(res, 200, { ok: false, code: doc.failCode || 'FAIL', message: 'pass failed' });
    }

    if (doc.status !== 'success') {
      return json(res, 200, { ok: true, next: 'pending', txId });
    }

    if (!doc.ciHash) {
      return json(res, 200, { ok: true, next: 'signup', txId });
    }

    const existing = await User.findOne({ ciHash: doc.ciHash }).select('_id').lean();
    if (existing) {
      return json(res, 200, { ok: true, next: 'templogin', txId, userId: String(existing._id) });
    }

    return json(res, 200, { ok: true, next: 'signup', txId });
  } catch (e) {
    console.error('[PASS/route] error:', e);
    return json(res, 500, { ok: false, code: 'ROUTE_ERROR', message: '분기 결정 실패' });
  }
});

module.exports = router;
