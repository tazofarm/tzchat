// backend/routes/pass/passRouter.js
// base: /api/auth/pass
// - POST /start: 서버 PASS 시작(다날 Ready → TID → wauth Start.php 자동전송 폼 생성)
// - GET  /start: mode=html 지원(팝업이 직접 이 엔드포인트를 열면 HTML 즉시 응답)
// - GET  /callback: 공급사 콜백 수신(CPCGI) → CONFIRM 수행 → PassResult 저장 → postMessage
// - GET  /status: 상태 조회(폴링)
// - GET  /route : 분기(signup | templogin)
//
// ⚠️ 수동 입력 관련 엔드포인트는 passManualRouter.js로 분리되어 있습니다.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
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
 *  - 기본: JSON 반환 { ok, txId, formHtml }
 *  - mode=html: text/html 직접 반환 (팝업이 이 URL을 열도록 할 때)
 * =======================================================*/
router.all('/start', async (req, res) => {
  try {
    const intent = (req.body && req.body.intent) || (req.query && req.query.intent) || 'unified';
    const mode = (req.query && req.query.mode) || (req.body && req.body.mode) || 'json';

    const out = await danal.buildStart({ intent, mode: mode === 'html' ? 'html' : 'json' });

    if (mode === 'html') {
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
      return res.status(200).send(out.body);
    }

    // JSON 모드
    return json(res, 200, { ok: true, txId: out.tid || null, formHtml: out.formHtml || null });
  } catch (e) {
    console.error('[PASS/start] error:', e);
    // 프론트가 "START_NON_JSON"을 피하려면 반드시 JSON으로 내려줘야 함
    return json(res, 500, { ok: false, code: 'START_ERROR', message: e?.message || 'PASS 시작 실패' });
  }
});

/* =========================================================
 * 2) PASS 콜백 (다날 WebAuth → 우리 서버)
 *    - CPCGI 역할: TID 수신 → UAS CONFIRM 호출 → PassResult upsert
 *    - 팝업에서 postMessage 후 창 닫기
 * =======================================================*/
router.get('/callback', async (req, res) => {
  try {
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

    // 전화번호는 표준 응답에 없으므로 공백 가능(향후 추가 시 normalize)
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

    await PassResult.findOneAndUpdate(
      { txId },
      {
        $set: {
          status: parsed.success ? 'success' : 'fail',
          failCode: parsed.success ? null : (parsed.failCode || 'UNKNOWN'),
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

    const targetOrigin = resolvePostMessageTarget();

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({ type:'PASS_RESULT', txId: ${JSON.stringify(txId)} }, ${JSON.stringify(targetOrigin)});
  }
} catch (e) {}
window.close();
</script>
PASS 처리 완료. 창을 닫아주세요.
</body></html>`);
  } catch (e) {
    console.error('[PASS/callback] error:', e);
    return res
      .status(500)
      .send('<!doctype html><html><body>PASS 콜백 처리 실패</body></html>');
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
