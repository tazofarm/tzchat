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
//     applied: false,                // 적용 여부
//     updatedFields: [],             // 적용된 필드 목록
//     diffs: {                      // 적용 필요시 변경 전/후 안내
//       phone:   { old: "+82101234...", new: "+82105555..." },
//       carrier: { old: "KT",           new: "SKT" }
//     }
//   }
// }

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { PassResult, User } = require('@/models');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

// 서버 전역 기본 동작(기본 false)
const AUTO_UPDATE_FROM_ENV = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.PASS_TEMPLOGIN_UPDATE_PHONE || '').toLowerCase()
);

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
    sameSite: 'none',
    secure: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/temp-login', async (req, res) => {
  const { txId } = req.body || {};
  const tx = (txId || '').toString().trim();

  if (!tx) {
    return res.status(400).json({ ok: false, code: 'NO_TXID', message: 'txId required' });
  }

  try {
    const pr = await PassResult.findOne({ txId: tx }).lean();
    if (!pr) return res.status(400).json({ ok: false, code: 'NO_TX', message: 'PassResult not found' });
    if (pr.status !== 'success') return res.status(400).json({ ok: false, code: 'NOT_SUCCESS', message: 'PassResult not success' });
    if (!pr.ciHash) return res.status(400).json({ ok: false, code: 'NO_CI', message: 'ciHash missing' });

    const user = await User.findOne({ ciHash: pr.ciHash })
      .select('_id username nickname phone carrier ciHash')
      .lean();
    if (!user) return res.status(404).json({ ok: false, code: 'NO_USER', message: 'User not found for ciHash' });

    // 변경 후보(diffs) 계산
    const diffs = {};
    if (pr.phone && pr.phone !== user.phone) {
      diffs.phone = { old: user.phone || null, new: pr.phone };
    }
    if (pr.carrier && pr.carrier !== user.carrier) {
      diffs.carrier = { old: user.carrier || null, new: pr.carrier };
    }

    // 적용 여부 결정: ENV 또는 요청 플래그(updateProfile)
    const clientWantsUpdate = !!(req.body && (req.body.updateProfile === true || req.body.updateProfile === 'true'));
    const shouldApply = AUTO_UPDATE_FROM_ENV || clientWantsUpdate;

    // 실제 업데이트
    const willUpdate = {};
    if (shouldApply) {
      if (diffs.phone)   willUpdate.phone   = diffs.phone.new;
      if (diffs.carrier) willUpdate.carrier = diffs.carrier.new;

      if (Object.keys(willUpdate).length > 0) {
        willUpdate.phoneVerifiedAt = new Date();
        willUpdate.phoneVerifiedBy = 'PASS'; // 추적용
        await User.updateOne({ _id: user._id }, { $set: willUpdate });
      }
    }

    // 로그인 처리 (JWT + 세션)
    const token = signToken(user);
    setJwtCookie(res, token);

    if (req.session) {
      await new Promise((resolve, reject) => req.session.regenerate(err => (err ? reject(err) : resolve())));
      req.session.user = { _id: user._id, nickname: user.nickname };
      await new Promise((resolve, reject) => req.session.save(err => (err ? reject(err) : resolve())));
    }

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
