// backend/routes/pass/passResultCallbackRouter.js
// base: /api/auth/pass
// - ALL  /callback   ← 결과 저장 후 /relay 로 302 리다이렉트

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qs = require('querystring');

const { PassResult } = require('@/models');
const danal = require('@/lib/pass/danalClient');

/* ──────────────── 공통 유틸 ──────────────── */

const sha256Hex = (s = '') =>
  crypto.createHash('sha256').update(String(s)).digest('hex');

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

/* ──────────────── 전화번호/통신사 추출 유틸 ──────────────── */

function toStr(v) {
  return v == null ? '' : String(v);
}

function digits(s) {
  return toStr(s).replace(/[^\d+]/g, '');
}

function plausibleKRPhone(s) {
  const d = digits(s);
  if (!/^\+?\d{9,14}$/.test(d)) return '';
  if (
    d.startsWith('+82') ||
    d.startsWith('010') ||
    d.startsWith('011') ||
    d.startsWith('016') ||
    d.startsWith('017') ||
    d.startsWith('018') ||
    d.startsWith('019')
  ) {
    return normalizePhoneKR(d);
  }
  return normalizePhoneKR(d);
}

function deepScanForPhone(obj, maxDepth = 3, path = '') {
  try {
    if (!obj || typeof obj !== 'object' || maxDepth < 0) {
      return { phone: '', via: '' };
    }
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
        const sub = deepScanForPhone(v, maxDepth - 1, `${path}${k}.`);
        if (sub.phone) return sub;
      }
    }
  } catch {}
  return { phone: '', via: '' };
}

function extractPhoneOne(source, label) {
  if (!source) return { phone: '', via: '' };

  const flat = [
    source.phone,
    source.phoneNo,
    source.phoneno,
    source.mobileno,
    source.mobileNo,
    source.mobile,
    source.cellphone,
    source.hp,
    source.hpNo,
    source.PHONE,
    source.PHONE_NO,
    source.PHONENO,
    source.TEL_NO,
    source.TELNO,
    source.MOBILE,
    source.MOBILE_NO,
    source.MOBILENO,
    source.MOBILENUM,
    source['MOBILE-NO'],
    source.HP,
    source.HP_NO,
    source.CELLPHONE,
    source.MSISDN,
    source.USER_PHONE,
    source.USER_MOBILE,
    source.CI_PHONENO,
    source.CI_PHONE,
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
    { obj: raw, label: 'raw' },
    { obj: body, label: 'body' },
    { obj: query, label: 'query' },
  ];
  for (const { obj, label } of tryList) {
    const r = extractPhoneOne(obj || {}, label);
    if (r.phone) return r;
  }
  return { phone: '', via: '' };
}

function extractCarrierFromParsed(parsed = {}, raw = {}, body = {}, query = {}) {
  const candidates = [
    parsed.carrier,
    parsed.telco,
    parsed.telecom,
    raw.TELCO,
    raw.TELCO_CODE,
    raw.CARRIER,
    raw.CI_TELECOM,
    raw.TELECOM,
    raw.CARRIER_NAME,
    raw.TELCOM,
    raw.OPERATOR,
    body.TELCO,
    body.TELCO_CODE,
    body.CARRIER,
    body.TELECOM,
    body.CARRIER_NAME,
    query.TELCO,
    query.TELCO_CODE,
    query.CARRIER,
    query.TELECOM,
    query.CARRIER_NAME,
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

/* ===================== 1) CALLBACK ==================== */

router.all('/callback', async (req, res) => {
  try {
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
    } catch {}

    // x-www-form-urlencoded 원문 재파싱(다날 EUC-KR 대응)
    if (req.method === 'POST') {
      const ctype = (req.headers['content-type'] || '').toLowerCase();
      if (ctype.includes('application/x-www-form-urlencoded')) {
        if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
          let text;
          try {
            text = require('iconv-lite').decode(req.rawBody, 'euc-kr');
          } catch {
            text = req.rawBody.toString('utf8');
          }
          req.body = qs.parse(text);
          console.log('[PASS/callback][decoded]', {
            len: text.length,
            keys: Object.keys(req.body || {}),
          });
        }
      }
    }

    // 1) 파싱
    const parsed = await danal.parseCallback(req);
    const txId = parsed.txId || `tx_${Date.now()}`;

    // 2) 핵심 필드 가공
    const birthdate =
      parsed.birthdate && /^\d{8}$/.test(parsed.birthdate)
        ? parsed.birthdate
        : '';
    const birthyear = birthdate
      ? Number(birthdate.slice(0, 4))
      : Number(parsed.birthyear) || null;
    const g = String(parsed.gender || '').toUpperCase();
    const gender =
      g === 'M' || g === 'MAN'
        ? 'man'
        : g === 'F' || g === 'WOMAN'
        ? 'woman'
        : '';

    const { phone: extractedPhone, via: phoneVia } = extractPhoneFromSources(
      parsed,
      parsed.raw || {},
      req.body || {},
      req.query || {}
    );
    const phone = extractedPhone ? normalizePhoneKR(extractedPhone) : '';

    const rawCarrierCandidate = extractCarrierFromParsed(
      parsed,
      parsed.raw || {},
      req.body || {},
      req.query || {}
    );
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
        raw: Object.keys(parsed?.raw || {}),
      },
    };

    // 3) 결과 upsert
    try {
      const saved = await PassResult.findOneAndUpdate(
        { txId },
        {
          $set: {
            intent: parsed.intent || 'unified',
            status: parsed.success ? 'success' : 'fail',
            failCode: parsed.success ? null : parsed.failCode || 'UNKNOWN',
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
        phoneSample: phone
          ? phone.slice(0, 4) + '...' + phone.slice(-2)
          : '(empty)',
        carrier,
      });
    } catch (dbErr) {
      console.warn('[PASS/callback][db] upsert warn:', dbErr?.message || dbErr);
    }

    // 4) 결과 페이지는 통합 릴레이로 이동(웹/앱 모두 동일 경로)
    const redirectUrl = `${getPublicOrigin(
      req
    )}/api/auth/pass/relay?txId=${encodeURIComponent(txId)}`;
    return res.redirect(302, redirectUrl);
  } catch (e) {
    console.error('[PASS/callback] hard error:', e?.stack || e?.message || e);
    // 실패 시에도 릴레이로 넘겨 postMessage/localStorage 처리(웹 팝업 닫기) 가능하게 함
    const redirectUrl = `${getPublicOrigin(
      req
    )}/api/auth/pass/relay?txId=${encodeURIComponent('')}`;
    try {
      return res.redirect(302, redirectUrl);
    } catch {
      return res.status(500).send('CALLBACK_ERROR');
    }
  }
});

module.exports = router;
