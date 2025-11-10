// backend/routes/pass/passManualRouter.js
// base: /api/auth/passmanual  (✅ 공개 라우터: 인증 미들웨어 우회 대상)
// - POST /complete : 로컬 수동 입력 "성공" 저장 → PassResult(status: success)
// - POST /manual   : (호환용 별칭) /complete과 동일하게 처리
// - POST /fail     : 사용자가 취소/실패 의도 전달 → 선택적으로 기록(status: fail)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PassResult } = require('@/models');

const sha256Hex = (s = '') => crypto.createHash('sha256').update(String(s)).digest('hex');

const maskName = (name = '') => {
  const n = String(name || '');
  if (n.length <= 1) return n;
  return n[0] + '*'.repeat(n.length - 1);
};

// KR 기본 E.164 정규화 (+국제번호면 그대로)
function normalizePhoneKR(raw = '') {
  const clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  return '+82' + clean;
}

// 내부 구현: 성공 처리 공통 핸들러
async function handleComplete(req, res) {
  try {
    // 공급사 포맷 호환 입력
    const {
      name,
      birthdate,   // YYYYMMDD
      birthyear,   // (백워드 호환) 4자리
      gender,      // man|woman (백워드 호환)
      genderCode,  // 'M' | 'F'
      phone,
      carrier,
      ci,
      di,
    } = req.body || {};

    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 표준화: birthyear
    const by =
      (birthdate && /^\d{8}$/.test(birthdate)) ? Number(birthdate.slice(0, 4))
      : Number(birthyear) || null;

    // 표준화: gender → man|woman
    const gcode = (genderCode || gender || '').toString().toUpperCase();
    const gnorm =
      gcode === 'M' || gcode === 'MAN' ? 'man'
      : gcode === 'F' || gcode === 'WOMAN' ? 'woman'
      : '';

    // 표준화: phone → 항상 E.164(+82…)
    const normalizedPhone = normalizePhoneKR(phone || '');

    // 민감 원문은 저장하지 않고 해시만 저장
    const ciHash = ci ? sha256Hex(ci) : '';
    const diHash = di ? sha256Hex(di) : '';

    await PassResult.create({
      txId,
      provider: 'Manual',
      status: 'success',
      name: maskName(name || ''),
      birthyear: by,
      gender: gnorm,
      phone: normalizedPhone,
      carrier: carrier || '',
      ciHash: ciHash || undefined,
      diHash: diHash || undefined,
      rawMasked: {
        name: maskName(name || ''),
        phone: normalizedPhone,
        birthdate: (birthdate && /^\d{8}$/.test(birthdate)) ? birthdate : undefined,
        birthyear: by,
        gender: gnorm,
        carrier,
        // 원문 ci/di는 저장하지 않습니다.
      },
    });

    return res.json({ ok: true, txId });
  } catch (e) {
    console.error('[PASS-MANUAL/complete] error:', e);
    // 500을 주더라도 인증 리디렉트가 발생하지는 않습니다(401만 피하면 됨)
    return res.status(500).json({ ok: false, message: '수동 입력 완료 처리 실패' });
  }
}

// ✅ 완료(성공) — 실제 PASS 성공처럼 저장
router.post('/complete', handleComplete);

// ✅ 호환용 별칭: 과거 프런트가 /manual 로 호출해도 동일 동작
router.post('/manual', handleComplete);

// (옵션) 실패 기록 — postMessage로도 처리되지만, 서버 로그/통계를 원하면 사용
router.post('/fail', async (req, res) => {
  try {
    const { reason = 'USER_CANCEL' } = req.body || {};
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await PassResult.create({
      txId,
      provider: 'Manual',
      status: 'fail',
      failCode: String(reason || 'USER_CANCEL'),
      rawMasked: { reason: String(reason || 'USER_CANCEL') },
    });

    return res.json({ ok: true, txId, reason: String(reason) });
  } catch (e) {
    console.error('[PASS-MANUAL/fail] error:', e);
    return res.status(500).json({ ok: false, message: '수동 실패 처리 실패' });
  }
});

module.exports = router;
