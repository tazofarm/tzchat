// backend/routes/pass/portoneCallbackRouter.js
// base: /api/auth/pass/portone
// - GET /complete?identityVerificationId=...

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const { PassResult, PassIdentity } = require('@/models');
const { getIdentityVerification } = require('@/lib/pass/portoneClient');

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

function safeOneLine(v) {
  try {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.replace(/\s+/g, ' ').slice(0, 300);
  } catch {
    return '';
  }
}

const sha256Hex = (s = '') =>
  crypto.createHash('sha256').update(String(s)).digest('hex');

const maskName = (name = '') => {
  const n = String(name || '');
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

function normalizeGender(raw = '') {
  const g = String(raw || '').trim().toUpperCase();
  if (g === 'M' || g === 'MALE' || g === 'MAN') return 'man';
  if (g === 'F' || g === 'FEMALE' || g === 'WOMAN') return 'woman';
  if (g.includes('MALE')) return 'man';
  if (g.includes('FEMALE')) return 'woman';
  return '';
}

function mapCarrier(code) {
  if (!code) return '';
  const up = String(code).trim().toUpperCase();
  if (up.includes('SKT')) return up.includes('MVNO') ? 'SKT(MVNO)' : 'SKT';
  if (up === 'KT' || up.includes('KT')) return up.includes('MVNO') ? 'KT(MVNO)' : 'KT';
  if (up.includes('LG') || up.includes('LGU')) return up.includes('MVNO') ? 'LGU+(MVNO)' : 'LGU+';
  if (up.includes('MVNO')) return 'MVNO';
  return up;
}

/**
 * raw 마스킹(운영 안전)
 * - CI/DI 원문 및 해시 원문 같은 민감 필드 제거
 * - name/phone은 최소 마스킹/정규화
 */
function maskRaw(iv) {
  try {
    if (!iv || typeof iv !== 'object') return { raw: iv };

    const out = { ...iv };

    delete out.ci;
    delete out.di;
    delete out.ciHash;
    delete out.diHash;

    if (out.customer && typeof out.customer === 'object') {
      out.customer = { ...out.customer };
      delete out.customer.ci;
      delete out.customer.di;
      delete out.customer.ciHash;
      delete out.customer.diHash;
      if (out.customer.phoneNumber) out.customer.phoneNumber = normalizePhoneKR(out.customer.phoneNumber);
      if (out.customer.name) out.customer.name = maskName(out.customer.name);
    }

    if (out.verifiedCustomer && typeof out.verifiedCustomer === 'object') {
      out.verifiedCustomer = { ...out.verifiedCustomer };
      delete out.verifiedCustomer.ci;
      delete out.verifiedCustomer.di;
      delete out.verifiedCustomer.ciHash;
      delete out.verifiedCustomer.diHash;
      if (out.verifiedCustomer.phoneNumber) out.verifiedCustomer.phoneNumber = normalizePhoneKR(out.verifiedCustomer.phoneNumber);
      if (out.verifiedCustomer.name) out.verifiedCustomer.name = maskName(out.verifiedCustomer.name);
    }

    if (out.phoneNumber) out.phoneNumber = normalizePhoneKR(out.phoneNumber);
    if (out.name) out.name = maskName(out.name);

    return out;
  } catch {
    return { raw: iv };
  }
}

/**
 * PortOne 조회 retry
 * - 404: 생성 직후 조회 타이밍/PG 지연으로 간헐 발생 가능
 * - 429, 5xx: 일시 오류
 */
async function fetchIdentityVerificationWithRetry(identityVerificationId) {
  const maxTries = Number(process.env.PORTONE_IV_FETCH_TRIES || 8);
  const delayMs = Number(process.env.PORTONE_IV_FETCH_DELAY_MS || 450);
  const storeId = safeString(process.env.PORTONE_STORE_ID).trim();

  let last = { status: 0, data: null };

  for (let i = 0; i < maxTries; i++) {
    const r = await getIdentityVerification(
      identityVerificationId,
      storeId ? { storeId } : undefined
    );

    last = { status: r.status, data: r.data };

    if (r.status >= 200 && r.status < 300) return last;

    const retryable =
      r.status === 404 ||
      r.status === 429 ||
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

function pickName(iv) {
  return safeString(
    iv?.name ||
      safeGet(iv, 'customer.name', '') ||
      safeGet(iv, 'verifiedCustomer.name', '')
  ).trim();
}

function pickPhone(iv) {
  const raw = safeString(
    iv?.phoneNumber ||
      safeGet(iv, 'customer.phoneNumber', '') ||
      safeGet(iv, 'verifiedCustomer.phoneNumber', '')
  ).trim();
  return raw ? normalizePhoneKR(raw) : '';
}

function pickCarrier(iv) {
  const raw = safeString(
    iv?.carrier ||
      safeGet(iv, 'customer.carrier', '') ||
      safeGet(iv, 'verifiedCustomer.carrier', '')
  ).trim();
  return mapCarrier(raw);
}

function pickCiDiRaw(iv) {
  // PortOne이 어떤 키로 주든 최대한 흡수
  const ci = safeString(
    iv?.ci ||
      iv?.ciValue ||
      safeGet(iv, 'customer.ci', '') ||
      safeGet(iv, 'verifiedCustomer.ci', '') ||
      ''
  ).trim();

  const di = safeString(
    iv?.di ||
      iv?.diValue ||
      safeGet(iv, 'customer.di', '') ||
      safeGet(iv, 'verifiedCustomer.di', '') ||
      ''
  ).trim();

  // 혹시 ciHash/diHash 라는 이름으로 "원문"이 오기도 하는 케이스 대비
  const ci2 = safeString(iv?.ciHash || '').trim();
  const di2 = safeString(iv?.diHash || '').trim();

  return {
    ciRaw: ci || ci2 || '',
    diRaw: di || di2 || '',
  };
}

/* ===================== ROUTE ====================== */

router.get('/complete', async (req, res) => {
  try {
    const identityVerificationId = safeString(req.query.identityVerificationId || '').trim();
    if (!identityVerificationId) {
      return json(res, 400, { ok: false, code: 'NO_IDENTITY_VERIFICATION_ID' });
    }

    console.log(
      `[PASS][portone][complete][hit] id=${identityVerificationId} ua=${safeString(req.headers['user-agent']).slice(0, 80)}`
    );

    // 1) PortOne 조회 + retry
    const { status, data } = await fetchIdentityVerificationWithRetry(identityVerificationId);

    console.log(
      `[PASS][portone][complete][resp] id=${identityVerificationId} portoneStatus=${status} body=${safeOneLine(data)}`
    );

    if (status === 401 || status === 403) {
      return json(res, 500, {
        ok: false,
        code: 'PORTONE_UNAUTHORIZED',
        message: `PortOne 인증 실패(HTTP ${status}) - V2 API Secret/StoreId 확인`,
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

    // 2) 응답 형태 흡수
    const iv = data?.identityVerification || data || {};
    const ivStatus = safeString(iv?.status || data?.status || '').trim();

    // 3) 성공 판정 (VERIFIED 포함)
    const isVerified = /verified|success|completed|succeeded/i.test(ivStatus);

    // ✅ txId는 identityVerificationId로 통일 (프론트도 그렇게 씀)
    const txId = identityVerificationId;

    // 4) 정규화 필드
    const rawName = pickName(iv);
    const nameMasked = maskName(rawName);

    const phone = pickPhone(iv);                 // E.164(+82...) 정규화
    const phoneHash = phone ? sha256Hex(phone) : ''; // PassIdentity용 해시
    const carrier = pickCarrier(iv);
    const birthyear = pickBirthYear(iv);
    const gender = normalizeGender(
      safeString(
        iv?.gender ||
          safeGet(iv, 'customer.gender', '') ||
          safeGet(iv, 'verifiedCustomer.gender', '')
      ).trim()
    );

    // ✅ CI/DI 원문 → sha256 해시
    const { ciRaw, diRaw } = pickCiDiRaw(iv);
    const ciHash = ciRaw ? sha256Hex(ciRaw) : '';
    const diHash = diRaw ? sha256Hex(diRaw) : '';

    // 5) PassResult upsert (이력/토큰)
    const update = {
      txId,
      provider: 'portone',
      intent: 'unified',
      status: isVerified ? 'success' : 'fail',
      consumed: false,

      name: nameMasked,
      birthyear: birthyear ?? null,
      gender: gender || '',
      phone: phone || '',
      carrier: carrier || '',

      ciHash: ciHash || undefined,
      diHash: diHash || undefined,

      rawMasked: maskRaw(iv),
      sensitiveFieldsRedacted: true,

      failCode: null,
      failMessage: null,

      updatedAt: new Date(),
    };

    if (!isVerified) {
      update.failCode = safeString(
        safeGet(iv, 'failure.code', '') || iv?.code || ivStatus || 'NOT_VERIFIED'
      ) || 'NOT_VERIFIED';
      update.failMessage = safeString(
        safeGet(iv, 'failure.message', '') || iv?.message || `status=${ivStatus}`
      ) || `status=${ivStatus}`;
    }

    const saved = await PassResult.findOneAndUpdate(
      { txId },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    ).lean();

    // 6) ✅ 핵심: VERIFIED면 PassIdentity도 upsert (소유권 테이블)
    // - 가입 전 상태: userId 없이도 유지됨
    // - 가입 완료 시: Signup 플로우에서 linkUserIfVacant / upsertByCI에 userId 넣어 연결
    if (isVerified && ciHash) {
      try {
        await PassIdentity.upsertByCI({
          ciHash,
          ...(diHash ? { diHash } : {}),
          ...(phoneHash ? { phoneHash } : {}),
          ...(carrier ? { carrier } : {}),
          // userId: 여기서는 넣지 않음(가입 전 가능)
        });

        console.log('[PASS][portone][complete][identity-upsert]', {
          txId,
          ciHash: ciHash.slice(0, 10) + '...',
          hasDiHash: !!diHash,
          hasPhoneHash: !!phoneHash,
          carrier,
        });
      } catch (e) {
        // PassIdentity 실패해도 complete 자체는 성공 처리(프론트가 진행 가능해야 함)
        console.warn('[PASS][portone][complete][identity-upsert][warn]', e?.message || e);
      }
    }

    console.log('[PASS][portone][complete][upsert]', {
      txId,
      isVerified,
      ivStatus,
      hasCiHash: !!saved?.ciHash,
      hasPhone: !!saved?.phone,
      carrier: saved?.carrier || '',
    });

    // 7) 응답
    if (!isVerified) {
      return json(res, 200, {
        ok: false,
        code: 'NOT_VERIFIED',
        txId,
        identityVerificationId,
        ivStatus,
        httpStatus: status,
      });
    }

    return json(res, 200, {
      ok: true,
      txId,
      identityVerificationId,
      status: 'success',
      ivStatus,
    });
  } catch (e) {
    console.error('[PASS/portone/complete] error:', e?.stack || e?.message || e);
    return json(res, 500, {
      ok: false,
      code: e?.code || 'PORTONE_COMPLETE_ERROR',
      message: e?.message || 'complete failed',
    });
  }
});

module.exports = router;
