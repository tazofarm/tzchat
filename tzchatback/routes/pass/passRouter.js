// backend/routes/pass/passRouter.js
// base: /api/auth/pass
// - POST /start
// - GET  /start?mode=html
// - ALL  /callback
// - GET  /status
// - GET  /route
// - GET  /result/:txId

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
// 단일 객체에서(플랫 후보 + 딥스캔)
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
// parsed/raw/body/query 전체를 묶어서 탐색
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
    const theStage = e?.stage || 'UNKNOWN';
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

    // ✔ parsed/raw/body/query 전부 스캔
    const { phone: extractedPhone, via: phoneVia } = extractPhoneFromSources(parsed, parsed.raw || {}, req.body || {}, req.query || {});
    const phone  = extractedPhone ? normalizePhoneKR(extractedPhone) : '';

    const rawCarrierCandidate = extractCarrierFromParsed(parsed, parsed.raw || {}, req.body || {}, req.query || {});
    const carrier = mapCarrier(rawCarrierCandidate);

    const ciHash = parsed.ci ? sha256Hex(parsed.ci) : '';
    const diHash = parsed.di ? sha256Hex(parsed.di) : '';
    const nameMasked = maskName(parsed.name || '');

    // 3) rawMasked (민감정보 제거) + 디버그 힌트 저장
    const rawMasked = {
      ...parsed.raw,
      birthdate: birthdate || undefined,
      birthyear,
      ci: undefined,
      di: undefined,
      name: nameMasked,
      phone,      // 정규화된 값
      carrier,    // 맵핑된 통신사명
      __debug_phone_via: phoneVia || null,
      __debug_keys: {
        body: Object.keys(req.body || {}),
        query: Object.keys(req.query || {}),
        parsed: Object.keys(parsed || {}),
        raw: Object.keys(parsed?.raw || {})
      }
    };

    // 4) 결과 upsert
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

    // 5) 최종 응답
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
