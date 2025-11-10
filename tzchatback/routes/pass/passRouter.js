// backend/routes/pass/passRouter.js
// base: /api/auth/pass
// - POST /start: 서버 PASS 시작(다날 Ready → TID → wauth Start.php 자동전송 폼 생성)
// - GET  /start: mode=html 지원(팝업이 직접 이 엔드포인트를 열면 HTML 즉시 응답)
// - ALL  /callback: 공급사 콜백 수신(CPCGI) → CONFIRM 수행 → PassResult 저장 → postMessage
// - GET  /status: 상태 조회(폴링)
// - GET  /route : 분기(signup | templogin)
//
// ⚠️ 수동 입력 관련 엔드포인트는 passManualRouter.js로 분리되어 있습니다.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qs = require('querystring');

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

// KR 기본 E.164 정규화 (+국제번호면 그대로)
function normalizePhoneKR(raw = '') {
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+0')) clean = '+' + clean.slice(2);
  if (clean.startsWith('+')) return clean;            // 이미 국제 형식
  if (clean.startsWith('0')) return '+82' + clean.slice(1); // 010… → +8210…
  return '+82' + clean;                               // 나머지 가드
}

// postMessage 대상 오리진
function resolvePostMessageTarget() {
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

// 공통 JSON 응답 유틸 (항상 JSON + no-cache)
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
router.get('/start/ping', (req, res) => {
  return json(res, 200, { ok: true, pong: true, now: Date.now() });
});

router.all('/start', async (req, res) => {
  try {
    const intent = (req.body && req.body.intent) || (req.query && req.query.intent) || 'unified';
    const mode   = (req.query && req.query.mode)   || (req.body && req.body.mode)   || 'json';
    const stub   = (req.query && req.query.stub)   || (req.body && req.body.stub);

    // STUB: 파이프/프런트 점검용
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
    const stage = e && e.stage || 'UNKNOWN';
    const msg   = e && e.message ? String(e.message).slice(0, 400) : 'PASS 시작 실패';
    console.error('[PASS/start] error:', { code, stage, msg });

    return json(res, 500, { ok: false, code, stage, message: msg });
  }
});

/* =========================================================
 * 2) PASS 콜백 (다날 WebAuth → 우리 서버)
 *    - 어떤 경우에도 200 HTML로 응답(팝업 postMessage 후 닫힘)
 *    - EUC-KR/UTF-8 자동 판별 디코딩
 *    - 단계별 상세 로그
 * =======================================================*/

// 이 라우트만 raw로 받음(전역 bodyParser 우회)
const raw = express.raw({ type: '*/*', limit: '1mb' });

/** 팝업 닫기 + 결과 postMessage (항상 200) */
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
    if (window.opener && typeof window.opener.postMessage === 'function') {
      window.opener.postMessage(data, ${origin});
    } else {
      try { localStorage.setItem('PASS_RESULT_FALLBACK', JSON.stringify(data)); } catch (e) {}
    }
  } catch(e) { /* noop */ }
  window.close();
})();
</script>
완료
</body></html>`;
}

router.all('/callback', raw, async (req, res) => {
  const targetOrigin = resolvePostMessageTarget();

  try {
    const ctype = (req.headers['content-type'] || '').toLowerCase();
    const charset = getCharset(ctype);
    const rawBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

    console.log('[PASS/CB][IN]', {
      method: req.method,
      ctype,
      charset,
      rawLen: rawBuf.length,
      qKeys: Object.keys(req.query || {}),
    });

    // 본문 디코드(+ 폼 파싱)
    const text = decodeBody(rawBuf, ctype);
    if (text) console.log('[PASS/CB][RAW][head]', text.slice(0, 300));

    // 대부분 form-urlencoded. 벤더가 text/html로 보내도 "a=b&c=d"면 파싱됨.
    let form = {};
    if (text) form = parseFormLike(text);
    // 혹시 GET 쿼리로 오는 케이스 혼합 방지: 바디 우선, 쿼리 보강
    form = { ...(req.query || {}), ...(form || {}) };

    console.log('[PASS/CB][PARSED.keys]', Object.keys(form));

    // 최소 필수 필드 점검 (RESULT_CODE/TID)
    const { ok: minOk, fields: minFields, missing } = validateMinimalFields(form);
    if (!minOk) {
      console.error('[PASS/CB][ERR] missing fields:', missing);
      const payload = { type: 'PASS_RESULT', ok: false, code: 'UNHANDLED_MISSING_FIELDS', missing };
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(popupCloseHtml(payload, targetOrigin));
    }

    // danal.parseCallback 시도(있다면 풍부한 필드 확보)
    let parsed = null;
    try {
      // parseCallback이 req.body를 참조할 수 있으므로 form을 주입(호환)
      req.body = form;
      parsed = await danal.parseCallback(req);
    } catch (e) {
      console.warn('[PASS/CB][WARN] danal.parseCallback failed, fallback to minimal parse:', e?.message || e);
      parsed = {
        success: (minFields.RESULT_CODE === '0000' || minFields.RESULT_CODE === 'SUCCESS' || minFields.RESULT_CODE === '0'),
        txId: form.TID || form.tid || form.txId || null,
        failCode: minFields.RESULT_CODE && !(
          minFields.RESULT_CODE === '0000' || minFields.RESULT_CODE === 'SUCCESS' || minFields.RESULT_CODE === '0'
        ) ? String(minFields.RESULT_CODE) : null,
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

    const txId = parsed.txId || form.TID || form.tid || form.txId || `tx_${Date.now()}`;

    // birthdate(YYYYMMDD) → birthyear
    const birthdate = (parsed.birthdate && /^\d{8}$/.test(parsed.birthdate)) ? parsed.birthdate : '';
    const birthyear = birthdate ? Number(birthdate.slice(0, 4)) : (Number(parsed.birthyear) || null);

    // 성별: M/F → man/woman
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
          },
        },
        { upsert: true, new: true }
      );
      console.log('[PASS/CB][UPSERT]', { txId: saved?.txId || txId, status: saved?.status || (parsed.success ? 'success' : 'fail') });
    } catch (dbErr) {
      console.warn('[PASS/CB][DB] upsert warn:', dbErr?.message || dbErr);
    }

    // 항상 PASS_RESULT로 통일 (성공/실패 모두)
    const payload = parsed.success
      ? { type: 'PASS_RESULT', ok: true, txId }
      : { type: 'PASS_RESULT', ok: false, code: parsed.failCode || minFields.RESULT_CODE || 'FAIL', txId };

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(popupCloseHtml(payload, targetOrigin));
  } catch (e) {
    console.error('[PASS/CB][ERR] UNHANDLED:', e?.stack || e?.message || e);
    const payload = { type: 'PASS_RESULT', ok: false, code: 'UNHANDLED_ERROR' };
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(popupCloseHtml(payload, targetOrigin));
  }
});

/* =========================================================
 * 3) 상태 조회 (폴링)
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
 * 4) 분기 결정 (회원가입 / 임시로그인)
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

    // success
    if (!doc.ciHash) {
      return json(res, 200, { ok: true, next: 'signup', txId });
    }

    const existing = await User.findOne({ ciHash: doc.ciHash }).select('_id').lean();
    if (existing) {
      return json(res, 200, {
        ok: true,
        next: 'templogin',
        txId,
        userId: String(existing._id),
      });
    }

    return json(res, 200, { ok: true, next: 'signup', txId });
  } catch (e) {
    console.error('[PASS/route] error:', e);
    return json(res, 500, { ok: false, code: 'ROUTE_ERROR', message: '분기 결정 실패' });
  }
});

module.exports = router;
