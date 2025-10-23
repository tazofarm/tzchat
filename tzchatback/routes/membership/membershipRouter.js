// /routes/membership/membershipRouter.js

/**
 * 
 * 
 * 멤버십 플랜 조회 라우터 (임시 구매 페이지용)
 * - GET /api/membership/plans?gender=male|female
 * - 성별별 혜택 문구/가격/정렬을 반환
 * - 베타 종료 여부 / 현재 기본 등급도 함께 제공
 *
 * 마운트: routes/index.js 에서 app.use('/api/membership', membershipRouter)
 */

const express = require('express');
const router = express.Router();

const {
  LEVEL,
  PRICE_KRW,
  GENDER,
  getPlansByGender,
  isBetaEnded,
  getCurrentDefaultLevel,
  BETA_END_AT_KST_STR,
} = require('@/config/membership');

// ────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────
function krw(n) {
  // 9,900 → "₩9,900"; 0 → "무료"
  if (typeof n !== 'number' || isNaN(n)) return '';
  if (n === 0) return '무료';
  return `₩${n.toLocaleString('ko-KR')}`;
}

function normalizeGender(input, fallback = GENDER.MALE) {
  const v = String(input || '').trim().toLowerCase();
  if (v === 'female' || v === 'f' || v === '여' || v === '여자') return GENDER.FEMALE;
  if (v === 'male' || v === 'm' || v === '남' || v === '남자') return GENDER.MALE;
  // req.user?.gender 가 '여성'/'남성' 같은 케이스도 처리
  if (v.startsWith('여')) return GENDER.FEMALE;
  if (v.startsWith('남')) return GENDER.MALE;
  return fallback;
}

// ────────────────────────────────────────────────────────────
// 라우트: 플랜 조회
// ────────────────────────────────────────────────────────────
router.get('/plans', async (req, res) => {
  try {
    // 캐시 방지(임시 페이지 정책/문구 변경 시 즉시 반영 목적)
    res.setHeader('Cache-Control', 'no-store');

    // 1) 성별 결정: ?gender=male|female → 없으면 req.user.gender → 기본 male
    const genderParam = req.query.gender || (req.user && req.user.gender) || '';
    const gender = normalizeGender(genderParam);

    // 2) 플랜 목록 생성(성별별 혜택 문구 포함)
    const plans = getPlansByGender(gender).map((p) => ({
      code: p.code,                  // 'BASIC' | 'LIGHT' | 'PREMIUM'
      name: p.name,                  // '일반회원' | '라이트회원' | '프리미엄회원'
      price: p.price,                // number (원)
      priceDisplay: krw(p.price),    // "무료" | "₩9,900" | "₩19,900"
      benefitText: p.benefitText,    // 성별에 따른 임시 혜택 문구
      order: p.order,
    }));

    // 3) 베타 종료/기본 등급 정보
    const betaEnded = isBetaEnded();
    const defaultLevel = getCurrentDefaultLevel();

    // 4) 응답
    return res.json({
      ok: true,
      beta: {
        ended: betaEnded,
        endAtKst: BETA_END_AT_KST_STR, // "2026-12-31T23:59:00+09:00"
      },
      defaultLevel, // '베타회원' | '일반회원'
      currency: 'KRW',
      levels: {
        BETA: LEVEL.BETA,
        BASIC: LEVEL.BASIC,
        LIGHT: LEVEL.LIGHT,
        PREMIUM: LEVEL.PREMIUM,
      },
      priceKRW: {
        [LEVEL.BASIC]: PRICE_KRW[LEVEL.BASIC],
        [LEVEL.LIGHT]: PRICE_KRW[LEVEL.LIGHT],
        [LEVEL.PREMIUM]: PRICE_KRW[LEVEL.PREMIUM],
      },
      gender, // 'male' | 'female'
      plans,  // 위에서 구성한 카드 리스트
    });
  } catch (err) {
    console.error('[membership/plans] error:', err);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// ────────────────────────────────────────────────────────────
// 헬스체크(선택): /api/membership/health
// ────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, service: 'membership', ts: Date.now() });
});

module.exports = router;
