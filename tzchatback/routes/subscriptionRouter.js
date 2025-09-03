// routes/subscriptionRouter.js
// -------------------------------------------------------------
// 💳 구독/결제 라우터 (JWT 전환)
// - 구독 시작/재구매
// - 구독 취소(다음 결제주기 종료 시)
// - 환불 요청(7일 이내 즉시 종료 + 환불)
// -------------------------------------------------------------
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const requireLogin = require('../middlewares/authMiddleware'); // ✅ JWT 미들웨어 (req.user 설정 가정)

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PaymentTransaction = require('../models/PaymentTransaction');
const RefundRequest = require('../models/RefundRequest');

// 기간 계산 유틸 (month/year 에 따라 종료 시점 산정)
// - 기존 프로젝트의 helper가 있다면 동일 시그니처로 import 하세요.
function addMonthOrYear(fromDate, interval) {
  const d = new Date(fromDate);
  if (interval === 'year') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    // default: month
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// 공통: 내 사용자 ID (JWT 우선, 세션은 백업)
function getMyId(req) {
  return req?.user?._id || req?.session?.user?._id || null;
}

/* ============================================================
 * 1) 구독 시작(또는 재구매)
 * POST /api/subscriptions/start
 * ============================================================ */
router.post('/api/subscriptions/start', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/subscriptions/start', method: 'POST', userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const { planId, planName, interval, price, provider, orderId, purchaseToken } = req.body;
    const now = new Date();
    const periodEnd = addMonthOrYear(now, interval); // month/year에 따라 계산

    console.log('[DB][QRY]', { model: 'Subscription', op: 'create' });
    const sub = await Subscription.create({
      userId: new mongoose.Types.ObjectId(String(myId)),
      planId,
      planName,
      interval,
      price,
      provider,
      orderId,
      purchaseToken,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd
    });
    console.log('[SUB][OK] started', String(sub._id));

    // 거래 기록
    console.log('[DB][QRY]', { model: 'PaymentTransaction', op: 'create', type: 'purchase', amount: price });
    await PaymentTransaction.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      type: 'purchase',
      status: 'succeeded',
      provider,
      orderId,
      amount: price
    });

    console.log('[API][RES]', { path: '/api/subscriptions/start', status: 200 });
    return res.json(sub);
  } catch (e) {
    console.error('[SUB.start][ERR]', { message: e?.message, stack: e?.stack?.split('\n')[0] });
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================================================
 * 2) 취소 신청(다음달부터 해지)
 * POST /api/subscriptions/:id/cancel
 * ============================================================ */
router.post('/api/subscriptions/:id/cancel', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/subscriptions/:id/cancel', method: 'POST', params: req.params, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    console.log('[DB][QRY]', {
      model: 'Subscription',
      op: 'findOne',
      criteria: { _id: req.params.id, userId: String(myId) }
    });
    const sub = await Subscription.findOne({ _id: req.params.id, userId: String(myId) });
    if (!sub) return res.status(404).json({ message: 'Not found' });

    sub.cancelAtPeriodEnd = true;
    sub.canceledAt = new Date();
    console.log('[DB][QRY]', { model: 'Subscription', op: 'save', id: String(sub._id) });
    await sub.save();
    console.log('[SUB][OK] cancel at period end', String(sub._id));

    console.log('[API][RES]', { path: '/api/subscriptions/:id/cancel', status: 200 });
    return res.json(sub);
  } catch (e) {
    console.error('[SUB.cancel][ERR]', { message: e?.message, stack: e?.stack?.split('\n')[0] });
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ============================================================
 * 3) 환불 요청(구독 1주일 이내면 즉시 종료 + 환불)
 * POST /api/refunds/request
 * ============================================================ */
router.post('/api/refunds/request', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/refunds/request', method: 'POST', userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const { subscriptionId, reason } = req.body;

    console.log('[DB][QRY]', {
      model: 'Subscription',
      op: 'findOne',
      criteria: { _id: subscriptionId, userId: String(myId) }
    });
    const sub = await Subscription.findOne({ _id: subscriptionId, userId: String(myId) });
    if (!sub) return res.status(404).json({ message: 'Not found' });

    // “구독 시작 7일 이내” 정책 체크
    const DIFF = Date.now() - new Date(sub.currentPeriodStart).getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (DIFF > SEVEN_DAYS) {
      return res.status(400).json({ message: '환불 가능 기간이 지났습니다.' });
    }

    // 환불 신청 문서 생성
    console.log('[DB][QRY]', { model: 'RefundRequest', op: 'create' });
    const rr = await RefundRequest.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      status: 'requested',
      reason,
      purchaseAt: sub.currentPeriodStart
    });
    console.log('[Refund][OK] requested', String(rr._id));

    // 즉시 처리(운영자 승인 단계를 넣으려면 approved → processed 순서로)
    // 거래 기록
    console.log('[DB][QRY]', { model: 'PaymentTransaction', op: 'create', type: 'refund', amount: -sub.price });
    await PaymentTransaction.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      type: 'refund',
      status: 'succeeded',
      provider: sub.provider,
      orderId: sub.orderId,
      amount: -sub.price,
      reason
    });

    // 구독 즉시 종료
    sub.status = 'canceled';
    sub.cancelAtPeriodEnd = false;
    sub.nextBillingAt = null;
    console.log('[DB][QRY]', { model: 'Subscription', op: 'save', id: String(sub._id) });
    await sub.save();

    // 사용자 환불 누적 증가
    console.log('[DB][QRY]', { model: 'User', op: 'updateOne', criteria: { _id: sub.userId }, update: { $inc: { refundCountTotal: 1 } } });
    await User.updateOne({ _id: sub.userId }, { $inc: { refundCountTotal: 1 } });

    // 환불요청 상태 갱신
    rr.status = 'processed';
    rr.handledAt = new Date();
    console.log('[DB][QRY]', { model: 'RefundRequest', op: 'save', id: String(rr._id) });
    await rr.save();

    console.log('[API][RES]', { path: '/api/refunds/request', status: 200 });
    return res.json({ ok: true, refundRequestId: rr._id });
  } catch (e) {
    console.error('[Refund.request][ERR]', { message: e?.message, stack: e?.stack?.split('\n')[0] });
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
