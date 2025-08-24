// routes/subscriptionRouter.js (발췌)



//1) 구독 시작(또는 재구매)
router.post('/api/subscriptions/start', requireLogin, async (req, res) => {
  try {
    const { planId, planName, interval, price, provider, orderId, purchaseToken } = req.body;
    const now = new Date();
    const periodEnd = addMonthOrYear(now, interval); // month/year에 따라 계산 함수

    const sub = await Subscription.create({
      userId: req.session.user._id,
      planId, planName, interval, price, provider, orderId, purchaseToken,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd
    });
    console.log('[SUB] started', sub._id);

    // 거래 기록
    await PaymentTransaction.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      type: 'purchase',
      status: 'succeeded',
      provider, orderId,
      amount: price
    });

    return res.json(sub);
  } catch (e) {
    console.error('[SUB.start] error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});




// /2) 취소 신청(다음달부터 해지)

router.post('/api/subscriptions/:id/cancel', requireLogin, async (req, res) => {
  try {
    const sub = await Subscription.findOne({ _id: req.params.id, userId: req.session.user._id });
    if (!sub) return res.status(404).json({ message: 'Not found' });

    sub.cancelAtPeriodEnd = true;
    sub.canceledAt = new Date();
    await sub.save();
    console.log('[SUB] cancel at period end', sub._id);

    return res.json(sub);
  } catch (e) {
    console.error('[SUB.cancel] error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

//3) 환불 요청(구독 1주일 이내면 즉시 종료 + 환불)

router.post('/api/refunds/request', requireLogin, async (req, res) => {
  try {
    const { subscriptionId, reason } = req.body;
    const sub = await Subscription.findOne({ _id: subscriptionId, userId: req.session.user._id });
    if (!sub) return res.status(404).json({ message: 'Not found' });

    // “구독 시작 7일 이내” 정책 체크
    const DIFF = Date.now() - new Date(sub.currentPeriodStart).getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (DIFF > SEVEN_DAYS) {
      return res.status(400).json({ message: '환불 가능 기간이 지났습니다.' });
    }

    // 환불 신청 문서 생성
    const rr = await RefundRequest.create({
      userId: sub.userId, subscriptionId: sub._id, status: 'requested',
      reason, purchaseAt: sub.currentPeriodStart
    });
    console.log('[Refund] requested', rr._id);

    // 즉시 처리(운영자 승인 단계를 넣으려면 approved → processed 순서로)
    // 거래 기록
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
    await sub.save();

    // 사용자 환불 누적 증가
    await User.updateOne({ _id: sub.userId }, { $inc: { refundCountTotal: 1 } });

    // 환불요청 상태 갱신
    rr.status = 'processed';
    rr.handledAt = new Date();
    await rr.save();

    return res.json({ ok: true, refundRequestId: rr._id });
  } catch (e) {
    console.error('[Refund.request] error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});
