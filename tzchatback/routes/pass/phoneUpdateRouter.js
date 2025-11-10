// base mount: /api/user/pass-phone   ← 인증 필요 (화이트리스트 제외)
// POST /start   -> PASS 시작 (intent: 'phone_update')
// POST /commit  -> txId 검증 후 현재 로그인 사용자에 phone/carrier 반영

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { PassResult, User } = require('@/models');
const danal = require('@/lib/pass/danalClient');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

// ===== 공통 유틸: 사용자 추출(세션 → Authorization → 쿠키)
function extractUserId(req) {
  if (req?.session?.user?._id) return String(req.session.user._id);

  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
      if (decoded?.sub) return String(decoded.sub);
    } catch (e) {}
  }

  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader.includes(`${COOKIE_NAME}=`)) {
    try {
      const token = decodeURIComponent(
        cookieHeader
          .split(';')
          .map(v => v.trim())
          .find(v => v.startsWith(`${COOKIE_NAME}=`))
          .split('=')[1]
      );
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.sub) return String(decoded.sub);
    } catch (e) {}
  }
  return null;
}

function requireAuth(req, res, next) {
  const uid = extractUserId(req);
  if (!uid) {
    return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'login required' });
  }
  req.__uid = uid;
  next();
}

// ✅ 전화번호 정규화(커밋 방어용)
function normalizePhoneKR(raw = '') {
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+0')) clean = '+' + clean.slice(2); // +082.. → +82..
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  return '+82' + clean;
}

// ===== START: PASS 시작 (전화번호 변경)
router.post('/start', requireAuth, async (req, res) => {
  const userId = req.__uid;
  const intent = 'phone_update';
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await PassResult.create({
      txId,
      status: 'pending',
      provider: 'Danal',
      rawMasked: { intent, userId }, // 이 트랜잭션이 누구의 변경용인지 바인딩
    });

    let out;
    try {
      // 통일: passRouter와 같은 엔진 사용
      out = await danal.buildStart({ intent, mode: 'json', txId });
    } catch (e) {
      console.error('[PHONE-UPDATE][start][DANAL_ERR]', { message: e?.message, code: e?.code, stage: e?.stage });
      return res.status(502).json({ ok: false, code: 'DANAL_START_ERROR', message: 'phone update start failed' });
    }

    if (!out || !out.formHtml) {
      return res.status(502).json({ ok: false, code: 'START_NO_FORM', message: 'formHtml not generated' });
    }

    // formHtml(팝업 주입용) + redirectUrl(지원 시) 모두 제공
    return res.json({
      ok: true,
      txId,
      formHtml: out.formHtml,
      redirectUrl: out.redirectUrl || null
    });
    
  } catch (e) {
    console.error('[PHONE-UPDATE][start][ERR]', {
      userId, txId, message: e?.message, name: e?.name, code: e?.code,
    });
    return res.status(500).json({ ok: false, code: 'START_ERROR', message: 'phone update start failed' });
  }
});

// ===== COMMIT: PASS 성공 결과를 내 계정에 반영
router.post('/commit', requireAuth, async (req, res) => {
  const userId = req.__uid;
  const { txId } = req.body || {};
  const safeTx = (txId || '').toString().trim();

  if (!safeTx) {
    return res.status(400).json({ ok: false, code: 'NO_TXID', message: 'txId required' });
  }

  try {
    const pr = await PassResult.findOne({ txId: safeTx }).lean();
    if (!pr)      return res.status(404).json({ ok: false, code: 'NO_TX', message: 'PassResult not found' });
    if (pr.status !== 'success')
      return res.status(400).json({ ok: false, code: 'NOT_SUCCESS', message: 'PassResult not success' });
    if (!pr.ciHash)
      return res.status(400).json({ ok: false, code: 'NO_CI_IN_RESULT', message: 'ciHash missing in PassResult' });

    // (있다면) txId 바인딩 사용자 검증
    const boundUserId = pr?.rawMasked?.userId;
    if (boundUserId && String(boundUserId) !== String(userId)) {
      return res.status(403).json({ ok: false, code: 'TX_BINDING_MISMATCH', message: 'txId is not bound to this user' });
    }

    // 내 계정 로드
    const me = await User.findById(userId).select('_id phone carrier ciHash').lean();
    if (!me) return res.status(404).json({ ok: false, code: 'NO_ME', message: 'current user not found' });

    // CI 일치 검증
    if (!me.ciHash || String(me.ciHash) !== String(pr.ciHash)) {
      return res.status(403).json({ ok: false, code: 'CI_MISMATCH', message: 'CI not matched with current user' });
    }

    // ✅ 커밋 직전 안전 정규화(과거 저장된 비정상 포맷 대비)
    const nextPhone = pr.phone ? normalizePhoneKR(pr.phone) : '';
    const nextCarrier = pr.carrier || '';

    const willUpdate = {};
    if (nextPhone && nextPhone !== me.phone) willUpdate.phone = nextPhone;
    if (nextCarrier && nextCarrier !== me.carrier) willUpdate.carrier = nextCarrier;

    if (Object.keys(willUpdate).length === 0) {
      return res.json({ ok: true, updatedFields: [] });
    }

    willUpdate.phoneVerifiedAt = new Date();
    willUpdate.phoneVerifiedBy = 'PASS';

    try {
      await User.updateOne({ _id: me._id }, { $set: willUpdate });
    } catch (e) {
      // 유니크 충돌 등 상세 코드 매핑
      if (e && e.code === 11000) {
        return res.status(409).json({ ok: false, code: 'PHONE_DUPLICATE', message: '이미 등록된 전화번호입니다.' });
      }
      const code = e?.name === 'ValidationError' ? 'VALIDATION_ERROR'
                  : e?.name === 'CastError'     ? 'CAST_ERROR'
                  : 'DB_ERROR';
      console.error('[PHONE-UPDATE][commit][DB_ERR]', {
        userId, txId: safeTx, willUpdate, message: e?.message, name: e?.name, code: e?.code
      });
      return res.status(400).json({ ok: false, code, message: e?.message || 'DB update error' });
    }

    return res.json({ ok: true, updatedFields: Object.keys(willUpdate) });
  } catch (e) {
    console.error('[PHONE-UPDATE][commit][ERR]', {
      userId, txId: safeTx, message: e?.message, name: e?.name, code: e?.code, stack: e?.stack
    });
    return res.status(500).json({ ok: false, code: 'COMMIT_ERROR', message: 'phone update commit failed' });
  }
});

module.exports = router;
  