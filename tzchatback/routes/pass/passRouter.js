// backend/routes/pass/passRouter.js
// base: /api/auth/pass
// - POST /start
// - GET  /start?mode=html
// - ALL  /callback
// - GET  /status
// - GET  /route              ← ★ 실제 User 존재검증 추가(CI-only)
// - GET  /result/:txId
// ⚠️ 수동 입력 관련 엔드포인트는 passManualRouter.js로 분리되어 있습니다.

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
    return process.env.API_ORIGIN || process.env.PASS_CALLBACK_PROD || 'https://tzchat.tazocode.com';
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

/* ──────────────── 공급사 필드 추출 유틸 ──────────────── */
// 일부 환경에서 danal.parseCallback이 phone/carrier를 최상단에 넣지 않는 경우가 있어
// raw 안의 다양한 키 후보를 스캔하여 보강한다.
function extractPhoneFromParsed(parsed = {}) {
  const raw = parsed.raw || {};
  const candidates = [
    parsed.phone,
    raw.PHONE, raw.MOBILE_NO, raw.MOBILENO, raw.TEL_NO, raw.HP_NO,
    raw.MOBILE, raw.CELLPHONE, raw.PHONENO, raw.PHONE_NO,
    raw['PHONE_NO'], raw['MOBILENUM'], raw['MOBILE-NO'],
  ];
  for (const v of candidates) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}
function extractCarrierFromParsed(parsed = {}) {
  const raw = parsed.raw || {};
  const candidates = [
    parsed.carrier,
    raw.TELCO, raw.TELCO_CODE, raw.CARRIER, raw.CI_TELECOM,
    raw.TELECOM, raw.CARRIER_NAME
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
  return up;
}

/* ===================== 1) START ======================= */
router.get('/start/ping', (req, res) => json(res, 200, { ok: true, pong: true, now: Date.now() }));

router.all('/start', async (req, res) => {
  try {
    const intent = (req.body && req.body.intent) || (req.query && req.query.intent) || 'unified';
    const mode   = (req.query && req.query.mode)   || (req.body && req.body.mode)   || 'json';
    const stub   = (req.query && req.query.stub)   || (req.body && req.body.stub);

    if (String(stub).toLowerCase() === '1' || String(stub).toLowerCase() === 'true') {
      const dummyHtml = `<!doctype html><html><body>
<form id="f" action="about:blank" method="post"><input type="hidden" name="TID" value="STUB_${Date.now()}"></form>
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
    const code  = e?.code || e?.returnCode || 'START_ERROR';
    theStage = e?.stage || 'UNKNOWN';
    const msg   = e?.message ? String(e.message).slice(0, 400) : 'PASS 시작 실패';
    console.error('[PASS/start] error:', { code, stage: theStage, msg });
    return json(res, 500, { ok: false, code, stage: theStage, message: msg });
  }
});

/* ===================== 2) CALLBACK ==================== */
router.all('/callback', async (req, res) => {
  const targetOrigin = resolvePostMessageTarget();

  const endOk = (txId) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({ type:'PASS_RESULT', txId: ${JSON.stringify(txId)} }, ${JSON.stringify(targetOrigin)});
  } else { try { localStorage.setItem('PASS_RESULT_TX', ${JSON.stringify(txId)}); } catch (e) {} }
} catch (e) {}
window.close();
</script>OK</body></html>`);
  };
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
</script>FAIL</body></html>`);
  };

  try {
    try {
      const ctype = (req.headers['content-type'] || '').toLowerCase();
      const hasRaw = Buffer.isBuffer(req.rawBody);
      const rawLen = hasRaw ? req.rawBody.length : 0;
      console.log('[PASS/callback][hit]', { method: req.method, ctype, hasRaw, rawLen, q: Object.keys(req.query||{}), b: Object.keys(req.body||{}) });
    } catch {}

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

    // 2) 핵심 필드 가공 (누락 대비 다중 후보 추출)
    const birthdate = (parsed.birthdate && /^\d{8}$/.test(parsed.birthdate)) ? parsed.birthdate : '';
    const birthyear = birthdate ? Number(birthdate.slice(0,4)) : (Number(parsed.birthyear) || null);
    const g = String(parsed.gender || '').toUpperCase();
    const gender = (g === 'M' || g === 'MAN') ? 'man' : ((g === 'F' || g === 'WOMAN') ? 'woman' : '');

    const rawPhoneCandidate = extractPhoneFromParsed(parsed);
    const phone  = rawPhoneCandidate ? normalizePhoneKR(rawPhoneCandidate) : '';

    const rawCarrierCandidate = extractCarrierFromParsed(parsed);
    const carrier = mapCarrier(rawCarrierCandidate);

    const ciHash = parsed.ci ? sha256Hex(parsed.ci) : '';
    const diHash = parsed.di ? sha256Hex(parsed.di) : '';
    const nameMasked = maskName(parsed.name || '');

    // 3) rawMasked (민감정보 제거)
    const rawMasked = {
      ...parsed.raw,
      birthdate: birthdate || undefined,
      birthyear,
      ci: undefined,
      di: undefined,
      name: nameMasked,
      phone,      // 정규화된 값으로 기록(표시/디버깅 용도)
      carrier,    // 매핑된 통신사명
    };

    // 4) PassIdentity 스냅샷(추후 userId 매핑 용도)
    let identityId = null;
    try {
      const ident = await PassIdentity.create({
        ciHash: ciHash || undefined,
        diHash: diHash || undefined,
        name: nameMasked || undefined,
        phone: phone || undefined,
        carrier: carrier || undefined,
        birthyear: birthyear ?? undefined,
        gender: gender || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      identityId = ident?._id || null;
    } catch (e) {
      console.warn('[PASS/callback][identity] warn:', e?.message || e);
    }

    // 5) 결과 upsert (★ phone/carrier를 반드시 저장)
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
            phone: phone || '',                  // ← 핵심: 비어있더라도 키는 유지
            carrier: carrier || '',              // ← 핵심: 매핑된 통신사 저장
            ciHash: ciHash || undefined,
            diHash: diHash || undefined,
            identityId: identityId || undefined,
            rawMasked,
          },
          $setOnInsert: { consumed: false, createdAt: new Date() },
        },
        { upsert: true, new: true }
      );
      console.log('[PASS/callback][upsert]', {
        txId: saved?.txId || txId,
        status: saved?.status || (parsed.success ? 'success' : 'fail'),
        hasPhone: !!(phone),
        phoneSample: phone ? (phone.slice(0, 4) + '...' + phone.slice(-2)) : '(empty)',
        carrier
      });
    } catch (dbErr) {
      console.warn('[PASS/callback][db] upsert warn:', dbErr?.message || dbErr);
    }

    // 6) 최종 응답
    return parsed.success ? endOk(txId) : endFail({
      code: parsed.failCode || 'FAIL',
      stage: 'CONFIRM',
      message: parsed.returnMsg || '',
      returnMsg: parsed.returnMsg || '',
      raw: parsed.raw || {}
    });

  } catch (e) {
    console.error('[PASS/callback] hard error:', e?.stack || e?.message || e);
    return endFail('CALLBACK_ERROR');
  }
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
// 조건:
//  - PassResult.status === 'success' && consumed !== true
//  - CI가 존재하고,
//  - 아래 순서로 "실제 User"가 존재하는지 확인:
//    (A) PassIdentity.userId → 실제 User 존재 확인
//    (B) User.ciHash 또는 User.pass.ciHash 로 직접 조회
//  - 어디에도 실제 User가 없으면 route='signup', 있으면 route='templogin'
router.get('/route', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId) return json(res, 400, { ok: false, code: 'NO_TXID' });

    const pr = await PassResult.findOne({ txId }).lean();
    if (!pr) return json(res, 404, { ok: false, code: 'PASS_TX_NOT_FOUND' });
    if (pr.consumed === true) return json(res, 410, { ok: false, code: 'CONSUMED' });
    if (pr.status === 'fail') return json(res, 200, { ok: false, code: pr.failCode || 'FAIL', message: pr.failMessage || 'pass failed' });
    if (pr.status !== 'success') return json(res, 200, { ok: false, code: 'PASS_NOT_SUCCESS', status: pr.status });

    // CI 없으면 → 가입
    if (!pr.ciHash) {
      return json(res, 200, { ok: true, route: 'signup', txId, userExists: false });
    }

    let userExists = false;

    // (A) identityId → userId 매핑 검사 + 실제 User 존재 확인
    if (pr.identityId) {
      const ident = await PassIdentity.findOne({ _id: pr.identityId }).select('userId ciHash').lean().catch(() => null);
      if (ident?.userId) {
        const linked = await User.findOne({ _id: ident.userId }).select('_id').lean();
        if (linked?._id) userExists = true; // 진짜 유저가 있을 때만 인정
      }
    }

    // (B) 직접 CI로 User 조회 (구/신 버전 호환)
    if (!userExists) {
      const found = await User.findOne({
        $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
      })
        .select('_id')
        .lean();
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
