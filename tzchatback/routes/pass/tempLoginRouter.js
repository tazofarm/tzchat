// backend/routes/pass/tempLoginRouter.js
// base mount: /api/auth/pass
// POST /temp-login  → PASS txId로 임시 로그인(JWT + 세션 쿠키 발급)

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { PassResult, PassIdentity, User } = require('@/models');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// 공통 에러 응답 유틸
function jsonError(res, status, body) {
  return res.status(status).json(body);
}

/**
 * PASS 임시 로그인
 * body: { txId: string, updateProfile?: boolean }
 *
 * 동작 요약:
 * 1) PassResult(txId)를 조회해서 PASS 성공 결과인지 확인
 * 2) CI 기준으로 User 찾기 (PassIdentity → User, 없으면 User.ciHash/pass.ciHash 로 탐색)
 * 3) JWT 발급 + httpOnly 쿠키 세팅
 * 4) PassResult.consumed = true 로 마킹 (로그용)  ← 하지만 **더 이상 이걸로 에러를 내지 않음**
 */
router.post('/temp-login', async (req, res) => {
  try {
    const { txId } = req.body || {};

    if (!txId) {
      return jsonError(res, 400, {
        ok: false,
        code: 'NO_TXID',
        message: 'txId is required',
      });
    }

    // 1) PASS 결과 조회
    const pr = await PassResult.findOne({ txId });
    if (!pr) {
      return jsonError(res, 404, {
        ok: false,
        code: 'PASS_TX_NOT_FOUND',
        message: 'PASS 결과를 찾을 수 없습니다.',
      });
    }

    if (pr.status !== 'success') {
      return jsonError(res, 400, {
        ok: false,
        code: 'PASS_NOT_SUCCESS',
        status: pr.status,
        message: 'PASS 인증이 성공 상태가 아닙니다.',
      });
    }

    if (!pr.ciHash) {
      return jsonError(res, 400, {
        ok: false,
        code: 'NO_CI',
        message: 'PASS 결과에 CI 정보가 없습니다.',
      });
    }

    // 2) CI 기준으로 회원 찾기 (route 로직과 동일한 기준)
    let user = null;

    // 2-1) PassIdentity 에 연결된 userId 우선
    const ident = await PassIdentity.findOne({ ciHash: pr.ciHash })
      .select('userId')
      .lean()
      .catch(() => null);

    if (ident?.userId) {
      user = await User.findById(ident.userId).exec();
    }

    // 2-2) 없으면 User.ciHash / User.pass.ciHash 로 직접 탐색
    if (!user) {
      user = await User.findOne({
        $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
      }).exec();
    }

    if (!user) {
      // 이 상황은 보통 /route 에서 templogin 으로 오지 않도록 막지만,
      // 혹시 모를 불일치를 위해 방어적으로 에러 반환
      return jsonError(res, 404, {
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'CI 에 해당하는 회원이 없습니다.',
      });
    }

    // 2-3) PassIdentity 가 없으면 생성 (다음부터는 바로 매핑)
    if (!ident || String(ident.userId) !== String(user._id)) {
      try {
        await PassIdentity.updateOne(
          { ciHash: pr.ciHash },
          {
            $setOnInsert: {
              userId: user._id,
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );
      } catch (e) {
        console.warn('[PASS][TEMP-LOGIN] PassIdentity upsert warn:', e?.message || e);
      }
    }

    // 3) PassResult 에 consumed 플래그만 표시 (로그용)
    //    👉 더 이상 consumed 때문에 에러를 내지 않는다.
    if (!pr.consumed) {
      pr.consumed = true;
      pr.consumedAt = new Date();
      try {
        await pr.save();
      } catch (e) {
        console.warn('[PASS][TEMP-LOGIN] PassResult save warn:', e?.message || e);
      }
    }

    // 4) JWT 발급 + 세션 쿠키
    const payload = {
      uid: String(user._id),
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7일

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });

    // 마지막 로그인 시간 정도만 갱신 (실패해도 로그인 자체는 성공)
    try {
      await User.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date() } }
      );
    } catch (e) {
      console.warn('[PASS][TEMP-LOGIN] lastLoginAt update warn:', e?.message || e);
    }

    return res.json({
      ok: true,
      userId: String(user._id),
      consumed: !!pr.consumed,
    });
  } catch (e) {
    console.error('[PASS][TEMP-LOGIN][ERR]', e);
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'temp-login failed',
    });
  }
});

module.exports = router;
