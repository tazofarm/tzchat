// backend/routes/pass/tempLoginRouter.js
// base mount: /api/auth/pass
// POST /temp-login  → PASS txId로 임시 로그인(JWT+세션 발급)
//  - 전화번호/통신사 최신화는 "옵션": 서버 ENV 또는 요청 플래그로 제어
//
// 제어 방법:
// - 서버 환경변수 PASS_TEMPLOGIN_UPDATE_PHONE=true  → 자동 반영
// - 요청 바디 { updateProfile:true }                → 호출별로 강제 반영
//
// 응답 예시:
// {
//   ok: true,
//   user: { _id, username, nickname },
//   token: "...", // 선택
//   profileUpdate: {
//     applied: false,
//     updatedFields: [],
//     diffs: { phone: { old, new }, carrier: { old, new } }
//   }
// }

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const { PassResult, User } = require('@/models');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

const COOKIE_SAME_SITE = (process.env.JWT_COOKIE_SAMESITE || 'none').toLowerCase(); // 'lax' | 'strict' | 'none'
const COOKIE_SECURE = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.JWT_COOKIE_SECURE || 'true').toLowerCase()
);

// 서버 전역 기본 동작(기본 false)
const AUTO_UPDATE_FROM_ENV = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.PASS_TEMPLOGIN_UPDATE_PHONE || '').toLowerCase()
);

const sha256Hex = (s = '') => crypto.createHash('sha256').update(String(s)).digest('hex');

// KR E.164(+82) 정규화
function normalizePhoneKR(raw = '') {
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+0')) clean = '+' + clean.slice(2);
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1); // 010 → +8210
  if (clean.startsWith('82')) return '+' + clean;
  return '+82' + clean;
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), nickname: user.nickname || '' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function setJwtCookie(res, token) {
  // 프론트는 fetch(credentials:'include') 사용
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/temp-login', async (req, res) => {
  const { txId, updateProfile } = req.body || {};
  const tx = (txId || '').toString().trim();

  if (!tx) {
    return res.status(400).json({ ok: false, code: 'NO_TXID', message: 'txId required' });
  }

  try {
    // 소모형 PassResult: 재사용 방지
    const pr = await PassResult.findOne({ txId: tx }).lean();
    if (!pr) return res.status(400).json({ ok: false, code: 'NO_TX', message: 'PassResult not found' });

    // consumed 플래그/타임스탬프 두 종류 모두 존중
    if (pr.consumed === true || pr.consumedAt) {
      return res.status(410).json({ ok: false, code: 'CONSUMED', message: 'PassResult already consumed' });
    }
    if (pr.status !== 'success') {
      return res.status(400).json({ ok: false, code: 'NOT_SUCCESS', message: 'PassResult not success' });
    }
    if (!pr.ciHash) {
      return res.status(400).json({ ok: false, code: 'NO_CI', message: 'ciHash missing' });
    }

    // 동일 CI 사용자 찾기 (구버전 호환: User.ciHash 또는 pass.ciHash)
    const user = await User.findOne({
      $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
    })
      .select('_id username nickname phone phoneHash carrier ciHash pass')
      .lean();

    if (!user) {
      // 이 엔드포인트 자체는 "기존 유저 로그인" 전용 → 유저 없으면 404
      return res.status(404).json({ ok: false, code: 'NO_USER', message: 'User not found for ciHash' });
    }

    // 변경 후보(diffs) 계산 (전화번호는 정규화 후 비교)
    const prPhoneNorm = pr.phone ? normalizePhoneKR(pr.phone) : '';
    const diffs = {};
    if (prPhoneNorm && prPhoneNorm !== (user.phone || '')) {
      diffs.phone = { old: user.phone || null, new: prPhoneNorm };
    }
    if (pr.carrier && pr.carrier !== (user.carrier || '')) {
      diffs.carrier = { old: user.carrier || null, new: pr.carrier };
    }

    // 적용 여부 결정: ENV 또는 요청 플래그(updateProfile)
    const clientWantsUpdate =
      updateProfile === true || String(updateProfile).toLowerCase() === 'true';
    const shouldApply = AUTO_UPDATE_FROM_ENV || clientWantsUpdate;

    // 실제 업데이트
    const willUpdate = {};
    if (shouldApply) {
      if (diffs.phone) {
        willUpdate.phone = diffs.phone.new;
        willUpdate.phoneHash = sha256Hex(diffs.phone.new);
      }
      if (diffs.carrier) {
        willUpdate.carrier = diffs.carrier.new;
      }

      if (Object.keys(willUpdate).length > 0) {
        willUpdate.phoneVerifiedAt = new Date();
        willUpdate.phoneVerifiedBy = 'PASS';
        await User.updateOne({ _id: user._id }, { $set: willUpdate });
      }
    }

    // 로그인 처리 (JWT + 세션)
    const token = signToken(user);
    setJwtCookie(res, token);

    if (req.session) {
      // 세션 재발급 및 저장 (쿠키 발행 보장)
      await new Promise((resolve, reject) =>
        req.session.regenerate((err) => (err ? reject(err) : resolve()))
      );
      req.session.userId = String(user._id);
      req.session.user = { _id: String(user._id), nickname: user.nickname || '' };
      await new Promise((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );
    }

    // PassResult 소모 처리(재사용 방지) — boolean/시간 둘 다 기록
    await PassResult.updateOne(
      { _id: pr._id },
      {
        $set: {
          consumed: true,
          consumedAt: new Date(),
          consumedBy: 'temp-login',
          consumedUser: user._id,
        },
      }
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      user: { _id: user._id, username: user.username, nickname: user.nickname },
      token, // 선택 저장용
      profileUpdate: {
        applied: shouldApply && Object.keys(willUpdate).length > 0,
        updatedFields: shouldApply ? Object.keys(willUpdate) : [],
        diffs, // 적용 안 했을 때 프론트에서 후속 안내 가능
      },
    });
  } catch (e) {
    console.error('[PASS][TEMP-LOGIN][ERR]', e);
    return res.status(500).json({ ok: false, code: 'SERVER_ERROR', message: 'temp-login failed' });
  }
});

module.exports = router;
