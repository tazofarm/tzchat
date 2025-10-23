/**
 * 결제 라우터 (임시 / 인앱결제 도입 전용)
 * ------------------------------------------------------------
 * - POST /api/purchase
 *   { userId, planCode, gender } → MembershipOrder 생성
 * - 결제 성공 후 user.user_level 갱신 (mock)
 * - 실제 결제 없음. 임시 구매 페이지 전용 API
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = mongoose.model('User');
const { MembershipOrder } = require('@/models'); // module-alias(@) 사용 시
const { LEVEL, GENDER, PRICE_KRW } = require('@/config/membership');

// ────────────────────────────────────────────────────────────
// 유틸: KRW 표시
// ────────────────────────────────────────────────────────────
function krw(n) {
  if (typeof n !== 'number' || isNaN(n)) return '';
  if (n === 0) return '무료';
  return `₩${n.toLocaleString('ko-KR')}`;
}

// ────────────────────────────────────────────────────────────
// POST /api/purchase (임시 결제)
// ────────────────────────────────────────────────────────────
router.post('/purchase', async (req, res) => {
  try {
    const { userId, planCode, gender } = req.body || {};

    if (!userId || !planCode) {
      return res.status(400).json({ ok: false, error: 'MISSING_PARAMS' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
    }

    // planCode → 등급명 변환
    const planMap = {
      BASIC: LEVEL.BASIC,
      LIGHT: LEVEL.LIGHT,
      PREMIUM: LEVEL.PREMIUM,
    };
    const planName = planMap[planCode.toUpperCase()];
    if (!planName) {
      return res.status(400).json({ ok: false, error: 'INVALID_PLAN' });
    }

    const price = PRICE_KRW[planName] ?? 0;

    // ───────────────────────────────────────────────
    // 1) 임시 주문 생성
    // ───────────────────────────────────────────────
    const order = await MembershipOrder.create({
      user: user._id,
      gender: gender || user.gender || GENDER.MALE,
      planCode,
      planName,
      price,
      status: 'mock_paid',
      paidAt: new Date(),
      note: '임시 결제 성공 (인앱결제 미적용)',
    });

    // ───────────────────────────────────────────────
    // 2) 사용자 등급 갱신 (mock)
    // ───────────────────────────────────────────────
    user.user_level = planName;
    await user.save();

    return res.json({
      ok: true,
      message: '임시 결제가 완료되었습니다.',
      order: {
        id: order._id,
        planCode,
        planName,
        price,
        priceDisplay: krw(price),
        status: order.status,
        paidAt: order.paidAt,
      },
      user: {
        id: user._id,
        nickname: user.nickname,
        user_level: user.user_level,
      },
    });
  } catch (err) {
    console.error('[payment/purchase] error:', err);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/purchase/history?userId=
// ────────────────────────────────────────────────────────────
router.get('/purchase/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'MISSING_USER_ID' });
    }

    const orders = await MembershipOrder.find({ user: userId })
      .sort({ paidAt: -1 })
      .lean();

    return res.json({
      ok: true,
      count: orders.length,
      orders: orders.map((o) => ({
        id: o._id,
        planName: o.planName,
        price: o.price,
        priceDisplay: krw(o.price),
        status: o.status,
        paidAt: o.paidAt,
        note: o.note,
      })),
    });
  } catch (err) {
    console.error('[payment/history] error:', err);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// ────────────────────────────────────────────────────────────
// 헬스체크
// ────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'payment', ts: Date.now() });
});

module.exports = router;
