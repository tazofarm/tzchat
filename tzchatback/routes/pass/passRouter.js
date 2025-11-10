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

    // STUB: 파이프/프론트 점검용
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
 *    - EUC-KR 폼 본문을 raw 로 받아 UTF-8로 디코딩
 *    - 진입/디코딩/저장 단계별 최소 로그
 * =======================================================*/
router.all('/callback', async (req, res) => {
  const targetOrigin = resolvePostMessageTarget();

  const endOk = (txId) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({ type:'PASS_RESULT', txId: ${JSON.stringify(txId)} }, ${JSON.stringify(targetOrigin)});
  } else {
    try { localStorage.setItem('PASS_RESULT_TX', ${JSON.stringify(txId)}); } catch (e) {}
  }
} catch (e) {}
window.close();
</script>
PASS 처리 완료. 창을 닫아주세요.
</body></html>`);
  };

      // reason: 문자열 또는 { code, stage, message, returnMsg, raw } 객체
      const endFail = (reason) => {
        const detail = (typeof reason === 'object' && reason) ? reason : { code: String(reason || 'UNKNOWN') };
        res.set('Content-Type', 'text/html; charset=utf-8');
        return res.end(`<!doctype html><html><body>
    <script>
    try {
      const payload = { type: 'PASS_FAIL', reason: ${JSON.stringify(detail.code || 'UNKNOWN')}, detail: ${JSON.stringify(detail)} };
      if (window.opener) {
        window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
      } else {
        try { localStorage.setItem('PASS_FAIL', String(payload.reason)); } catch(e){}
        try { localStorage.setItem('PASS_FAIL_DETAIL', JSON.stringify(payload.detail)); } catch(e){}
      }
    } catch (e) {}
    window.close();
    </script>
    PASS 실패. 창을 닫아주세요.
    </body></html>`);
      };


  try {
    // 🔎 진입 로그(PII 최소화)
    try {
      const ctype = (req.headers['content-type'] || '').toLowerCase();
      const hasRaw = Buffer.isBuffer(req.rawBody);
      const rawLen = hasRaw ? req.rawBody.length : 0;
      console.log('[PASS/callback][hit]', {
        method: req.method,
        ctype,
        hasRaw,
        rawLen,
        q: Object.keys(req.query || {}),
        b: Object.keys(req.body || {}),
      });
    } catch (e) {
      console.warn('[PASS/callback][log] warn:', e?.message || e);
    }

    // ✅ EUC-KR 폼 디코딩 (POST 전용, main.js에서 req.rawBody 선캡처 필요)
    if (req.method === 'POST') {
      const ctype = (req.headers['content-type'] || '').toLowerCase();
      if (ctype.includes('application/x-www-form-urlencoded')) {
        if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
          let text;
          try {
            const iconv = require('iconv-lite');               // 동적 로드
            text = iconv.decode(req.rawBody, 'euc-kr');        // EUC-KR → UTF-8
          } catch (e) {
            console.warn('[PASS/callback] iconv-lite not available, fallback to utf8:', e?.message || e);
            text = req.rawBody.toString('utf8');               // 폴백
          }
          req.body = qs.parse(text);
          console.log('[PASS/callback][decoded]', { len: text.length, keys: Object.keys(req.body || {}) });
        } else {
          console.warn('[PASS/callback] rawBody missing, skip decode');
        }
      }
    }

    // 쿼리/바디가 비어도 danal.parseCallback은 안전(기본값 보정)
    const parsed = await danal.parseCallback(req);

    const txId = parsed.txId || `tx_${Date.now()}`;

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
      ...parsed.raw,
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
            failCode: parsed.success ? null : (parsed.failCode || 'UNKNOWN'),
            failMessage: parsed.returnMsg || null,   // ⬅️ 실패 사유(공급사 메시지)
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
      console.log('[PASS/callback][upsert]', { txId: saved?.txId || txId, status: saved?.status || (parsed.success ? 'success' : 'fail') });
    } catch (dbErr) {
      console.warn('[PASS/callback][db] upsert warn:', dbErr?.message || dbErr);
    }

        return parsed.success
      ? endOk(txId)
      : endFail({
          code: parsed.failCode || 'FAIL',
          stage: 'CONFIRM',
          message: parsed.returnMsg || '',
          returnMsg: parsed.returnMsg || '',
          raw: parsed.raw || {}
        });

  } catch (e) {
    console.error('[PASS/callback] hard error:', e?.stack || e?.message || e);
    // 절대 500 내지 않음
    return endFail('CALLBACK_ERROR');
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
            failMessage: doc.failMessage || (doc.rawMasked && doc.rawMasked.RETURNMSG) || null  // ⬅️ 상세사유 동봉
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
 