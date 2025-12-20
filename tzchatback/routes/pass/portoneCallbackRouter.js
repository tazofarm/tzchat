// backend/routes/pass/portoneCallbackRouter.js
// base: /api/auth/pass/portone
// - GET /complete?identityVerificationId=...

const express = require('express');
const router = express.Router();

const { PassResult } = require('@/models');
const { getIdentityVerification } = require('@/lib/pass/portoneClient');

function json(res, status, body) {
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(status).json(body);
}

function safeString(v) {
  return v === undefined || v === null ? '' : String(v);
}

function safeGet(obj, path, fallback = undefined) {
  try {
    const out = path
      .split('.')
      .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    return out === undefined ? fallback : out;
  } catch {
    return fallback;
  }
}

function maskRaw(raw) {
  // ✅ 운영에서는 더 강하게 마스킹(전화번호/이메일/CI/DI 등) 권장
  if (!raw || typeof raw !== 'object') return { raw };
  return raw;
}

function safeOneLine(v) {
  try {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.replace(/\s+/g, ' ').slice(0, 300);
  } catch {
    return '';
  }
}

/**
 * PortOne 조회 retry
 * - 404: 생성 직후 조회 타이밍/PG 지연으로 간헐 발생 가능
 * - 429, 5xx: 일시 오류
 */
async function fetchIdentityVerificationWithRetry(identityVerificationId) {
  const maxTries = Number(process.env.PORTONE_IV_FETCH_TRIES || 6);
  const delayMs = Number(process.env.PORTONE_IV_FETCH_DELAY_MS || 350);
  const storeId = safeString(process.env.PORTONE_STORE_ID).trim();

  let last = { status: 0, data: null };

  for (let i = 0; i < maxTries; i++) {
    const r = await getIdentityVerification(identityVerificationId, storeId ? { storeId } : undefined);
    last = { status: r.status, data: r.data };

    // 성공
    if (r.status >= 200 && r.status < 300) return last;

    const retryable =
      (r.status === 404) ||
      (r.status === 429) ||
      (r.status >= 500 && r.status <= 599);

    const isLast = i === maxTries - 1;
    if (!retryable || isLast) return last;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return last;
}

function pickBirthYear(iv) {
  const candidates = [
    safeGet(iv, 'birthyear', null),
    safeGet(iv, 'birthYear', null),
    safeGet(iv, 'customer.birthYear', null),
    safeGet(iv, 'verifiedCustomer.birthYear', null),
    safeGet(iv, 'birthDate', ''),
    safeGet(iv, 'customer.birthDate', ''),
    safeGet(iv, 'verifiedCustomer.birthDate', ''),
  ];

  for (const c of candidates) {
    if (c === undefined || c === null) continue;

    if (typeof c === 'number') {
      if (Number.isFinite(c) && c > 1900) return c;
      continue;
    }

    const s = safeString(c).trim();
    if (!s) continue;

    const y = Number(s.slice(0, 4));
    if (Number.isFinite(y) && y > 1900) return y;
  }

  return null;
}

router.get('/complete', async (req, res) => {
  try {
    const identityVerificationId = safeString(req.query.identityVerificationId || '').trim();
    if (!identityVerificationId) {
      return json(res, 400, { ok: false, code: 'NO_IDENTITY_VERIFICATION_ID' });
    }

    // ✅ 한 줄 로그(요청)
    console.log(
      `[PASS][portone][complete] id=${identityVerificationId} ua=${safeString(req.headers['user-agent']).slice(0, 80)}`
    );

    // 1) PortOne V2 API로 조회 (portoneClient로 통일 + retry)
    const { status, data } = await fetchIdentityVerificationWithRetry(identityVerificationId);

    // ✅ 한 줄 로그(PortOne 응답)
    console.log(
      `[PASS][portone][complete] id=${identityVerificationId} portoneStatus=${status} body=${safeOneLine(data)}`
    );

    if (status === 401 || status === 403) {
      return json(res, 500, {
        ok: false,
        code: 'PORTONE_UNAUTHORIZED',
        message: `PortOne 인증 실패(HTTP ${status}) - V2 API Secret 확인`,
        httpStatus: status,
        detail: data,
      });
    }

    if (status < 200 || status >= 300) {
      return json(res, 502, {
        ok: false,
        code: 'PORTONE_API_ERROR',
        message: `PortOne API error: HTTP ${status}`,
        httpStatus: status,
        detail: data,
      });
    }

    // 2) 응답 형태 흡수(혹시 data.identityVerification 형태 대비)
    const iv = data?.identityVerification || data || {};
    const ivStatus = safeString(iv?.status || data?.status || '');

    // 3) 성공 판정(상태 문자열 다양성 대비)
    const isVerified = /verified|success|completed|succeeded/i.test(ivStatus);

    const txId = identityVerificationId;

    // 4) PassResult upsert
    const update = {
      txId,
      provider: 'portone',
      status: isVerified ? 'success' : 'fail',
      consumed: false,

      name: safeString(
        iv?.name ||
          safeGet(iv, 'customer.name', '') ||
          safeGet(iv, 'verifiedCustomer.name', '')
      ),

      birthyear: pickBirthYear(iv),

      gender: safeString(
        iv?.gender ||
          safeGet(iv, 'customer.gender', '') ||
          safeGet(iv, 'verifiedCustomer.gender', '')
      ),

      phone: safeString(
        iv?.phoneNumber ||
          safeGet(iv, 'customer.phoneNumber', '') ||
          safeGet(iv, 'verifiedCustomer.phoneNumber', '')
      ),

      carrier: safeString(
        iv?.carrier ||
          safeGet(iv, 'customer.carrier', '') ||
          safeGet(iv, 'verifiedCustomer.carrier', '')
      ),

      ciHash: safeString(iv?.ciHash || iv?.ci || ''),
      diHash: safeString(iv?.diHash || iv?.di || ''),

      rawMasked: maskRaw(iv),
      updatedAt: new Date(),
    };

    if (!isVerified) {
      update.failCode = safeString(
        safeGet(iv, 'failure.code', '') || iv?.code || ivStatus || 'NOT_VERIFIED'
      );
      update.failMessage = safeString(
        safeGet(iv, 'failure.message', '') || iv?.message || `status=${ivStatus}`
      );
    }

    await PassResult.updateOne(
      { txId },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    // ✅ 성공일 때만 ok:true
    if (!isVerified) {
      return json(res, 200, {
        ok: false,
        code: 'NOT_VERIFIED',
        txId,
        identityVerificationId,
        ivStatus,
      });
    }

    return json(res, 200, {
      ok: true,
      txId,
      identityVerificationId,
      status: update.status,
      ivStatus,
    });
  } catch (e) {
    console.error('[PASS/portone/complete] error:', e?.message || e);
    return json(res, 500, {
      ok: false,
      code: e?.code || 'PORTONE_COMPLETE_ERROR',
      message: e?.message || 'complete failed',
    });
  }
});

module.exports = router;
