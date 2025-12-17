// backend/routes/pass/portoneCallbackRouter.js
// base: /api/auth/pass/portone
// - GET /complete?identityVerificationId=...

const express = require('express');
const axios = require('axios');
const router = express.Router();

const { PassResult } = require('@/models');

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

/**
 * PortOne V2 API 호출
 * - base: https://api.portone.io (기본)
 * - Authorization: PortOne {V2_API_SECRET}
 */
async function fetchIdentityVerification(identityVerificationId) {
  const secret = process.env.PORTONE_V2_API_SECRET || '';
  if (!secret) {
    const err = new Error('PORTONE_V2_API_SECRET is missing');
    err.code = 'ENV_MISSING';
    throw err;
  }

  const base = (process.env.PORTONE_API_BASE || 'https://api.portone.io').replace(/\/+$/, '');
  const url = `${base}/v2/identity-verifications/${encodeURIComponent(identityVerificationId)}`;

  const r = await axios.get(url, {
    headers: {
      Authorization: `PortOne ${secret}`,
    },
    timeout: 10000,
    validateStatus: () => true, // axios가 4xx/5xx에서도 throw 안 하게
  });

  return { status: r.status, data: r.data };
}

function pickBirthYear(iv) {
  // ⚠️ Node에서 ?? 와 || 를 섞어 쓰면 괄호 없을 때 SyntaxError가 날 수 있어서
  //     연도 추출은 if/return 방식으로 안전하게 처리합니다.
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

    // 숫자면 그대로
    if (typeof c === 'number') {
      if (Number.isFinite(c) && c > 1900) return c;
      continue;
    }

    // 문자열이면 앞 4자리로 연도 시도
    const s = safeString(c).trim();
    if (!s) continue;

    const y = Number(s.slice(0, 4));
    if (Number.isFinite(y) && y > 1900) return y;
  }

  return null;
}

router.get('/complete', async (req, res) => {
  try {
    const identityVerificationId = safeString(req.query.identityVerificationId || '');
    if (!identityVerificationId) {
      return json(res, 400, { ok: false, code: 'NO_IDENTITY_VERIFICATION_ID' });
    }

    // 1) PortOne V2 API로 조회
    const { status, data } = await fetchIdentityVerification(identityVerificationId);

    if (status === 401 || status === 403) {
      // 인증키 문제(대부분)
      return json(res, 500, {
        ok: false,
        code: 'PORTONE_UNAUTHORIZED',
        message: `PortOne 인증 실패(HTTP ${status}) - V2 API Secret 확인`,
        detail: data,
      });
    }

    if (status < 200 || status >= 300) {
      return json(res, 502, {
        ok: false,
        code: 'PORTONE_API_ERROR',
        message: `PortOne API error: HTTP ${status}`,
        detail: data,
      });
    }

    // 2) 응답 형태 흡수(혹시 data.identityVerification 형태 대비)
    const iv = data?.identityVerification || data || {};
    const ivStatus = safeString(iv?.status || data?.status || '');

    // 3) 성공 판정(상태 문자열 다양성 대비)
    // - PortOne 문서 상 VERIFIED 인 경우가 많지만, 확장 대비
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

      // 들어오면 저장, 없으면 빈 문자열
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

    // ✅ 프론트 finalizeByIdentityVerificationId가 ok=true일 때만 proceed 하므로,
    //    성공일 때만 ok:true를 반환합니다.
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
