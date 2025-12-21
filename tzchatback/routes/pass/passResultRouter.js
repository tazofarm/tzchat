// backend/routes/pass/passResultRouter.js
// base: /api/auth/pass
// - GET  /status
// - GET  /result/:txId
// - GET  /route
//
// ✅ Fix (PortOne 호환 / 멈춤 방지):
// - PortOne txId(identityVerificationId)가 app_iv_... 형태일 때
//   PassResult가 아직 없거나 생성 지연/누락될 수 있음.
// - 이때 /route에서 PASS_TX_NOT_FOUND 로 떨어지면 프론트가 "인증중"에 고착될 수 있으니
//   app_iv_... 인 경우 "signup"으로 안전 폴백(운영 안전).
//
// ⚠️ 주의:
// - 이 폴백은 "멈춤 방지" 목적.
// - PortOne에서도 "기존회원 판별(CI 기반)"을 하려면
//   PortOne complete 처리에서 ciHash/diHash 저장 + PassIdentity upsert가 필요함.

const express = require('express');
const router = express.Router();

const { PassResult, User, PassIdentity } = require('@/models');

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

function isPortOneTxId(txId = '') {
  // PortOne에서 identityVerificationId를 app_iv_... 형태로 쓰고 있음(프론트 makeIdentityVerificationId)
  return /^app_iv_/i.test(String(txId || ''));
}

function providerHintByTxId(txId = '') {
  return isPortOneTxId(txId) ? 'portone' : 'danal';
}

/* ===================== 1) STATUS ====================== */
/**
 * GET /api/auth/pass/status?txId=...
 *
 * - PASS 진행 상태만 간단히 확인
 * - status: 'pending' | 'success' | 'fail'
 * - consumed 는 boolean 플래그로만 전달 (에러 아님)
 */
router.get('/status', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId) {
      return json(res, 400, {
        ok: false,
        code: 'NO_TXID',
        message: 'txId required',
      });
    }

    const doc = await PassResult.findOne({ txId }).lean();

    // ✅ PortOne txId는 PassResult가 없을 수 있으니 pending으로 처리
    if (!doc) {
      return json(res, 200, {
        ok: true,
        status: 'pending',
        consumed: false,
        providerHint: providerHintByTxId(txId),
      });
    }

    const baseResult = {
      txId: doc.txId,
      status: doc.status,
      consumed: !!doc.consumed,

      failCode: doc.status === 'fail' ? doc.failCode || 'UNKNOWN' : null,
      failMessage:
        doc.status === 'fail'
          ? doc.failMessage ||
            (doc.rawMasked && (doc.rawMasked.RETURNMSG || doc.rawMasked.returnMsg)) ||
            null
          : null,

      ciHash: doc.ciHash || null,
      diHash: doc.diHash || null,

      name: doc.name || '',
      birthyear: doc.birthyear ?? null,
      gender: doc.gender || '',
      phone: doc.phone || '',
      carrier: doc.carrier || '',

      debugPhoneVia: doc.rawMasked?.__debug_phone_via || null,
      debugKeys: doc.rawMasked?.__debug_keys || null,
      provider: doc.provider || null,
    };

    if (doc.status === 'success') {
      return json(res, 200, {
        ok: true,
        status: 'success',
        consumed: !!doc.consumed,
        result: baseResult,
      });
    }

    if (doc.status === 'fail') {
      return json(res, 200, {
        ok: true,
        status: 'fail',
        consumed: !!doc.consumed,
        result: baseResult,
      });
    }

    // status 가 정의되어 있지 않으면 pending 취급
    return json(res, 200, {
      ok: true,
      status: 'pending',
      consumed: !!doc.consumed,
      result: baseResult,
    });
  } catch (e) {
    console.error('[PASS/status] error:', e);
    return json(res, 500, {
      ok: false,
      code: 'STATUS_ERROR',
      message: '상태 조회 실패',
    });
  }
});

/* ===================== 2) RESULT ====================== */
/**
 * GET /api/auth/pass/result/:txId
 *
 * - PASS 결과 전체(마스킹 버전)를 항상 돌려줌
 * - consumed 가 true 여도 에러가 아니라 그냥 플래그만 표시
 */
router.get('/result/:txId', async (req, res) => {
  try {
    const { txId } = req.params || {};
    if (!txId) {
      return json(res, 400, { ok: false, code: 'NO_TXID' });
    }

    const doc = await PassResult.findOne({ txId }).lean();

    // ✅ PortOne txId는 PassResult가 없을 수 있으니 404 대신 pending 응답(멈춤 방지)
    if (!doc) {
      return json(res, 200, {
        ok: true,
        status: 'pending',
        consumed: false,
        providerHint: providerHintByTxId(txId),
        result: {
          txId: String(txId),
          status: 'pending',
          consumed: false,
        },
      });
    }

    return json(res, 200, {
      ok: true,
      status: doc.status,
      consumed: !!doc.consumed,
      providerHint: doc.provider || providerHintByTxId(txId),
      result: {
        txId: doc.txId,
        status: doc.status,
        consumed: !!doc.consumed,

        failCode: doc.status === 'fail' ? doc.failCode || 'UNKNOWN' : null,
        failMessage:
          doc.status === 'fail'
            ? doc.failMessage ||
              (doc.rawMasked && (doc.rawMasked.RETURNMSG || doc.rawMasked.returnMsg)) ||
              null
            : null,

        ciHash: doc.ciHash || null,
        diHash: doc.diHash || null,

        name: doc.name || '',
        birthyear: doc.birthyear ?? null,
        gender: doc.gender || '',
        phone: doc.phone || '',
        carrier: doc.carrier || '',

        rawMasked: doc.rawMasked || null,
      },
    });
  } catch (e) {
    console.error('[PASS/result] error:', e);
    return json(res, 500, {
      ok: false,
      code: 'RESULT_ERROR',
      message: 'RESULT_ERROR',
    });
  }
});

/* ===================== 3) ROUTE (CI-only & real user check) ====================== */
/**
 * GET /api/auth/pass/route?txId=...
 *
 * - PASS 성공 후, CI 기준으로
 *   · 동일 CI 유저가 없으면 → { ok:true, route:'signup', userExists:false }
 *   · 동일 CI 유저가 있으면 → { ok:true, route:'templogin', userExists:true }
 *
 * ✅ PortOne 호환(멈춤 방지):
 * - txId가 app_iv_... 인데 PassResult가 없으면
 *   404/에러 대신 signup으로 폴백.
 *
 * - debug=1 또는 true 로 호출하면 debugUser 반환(검토용)
 */
router.get('/route', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId) {
      return json(res, 400, { ok: false, code: 'NO_TXID' });
    }

    const wantDebugUser = ['1', 'true', 'yes'].includes(
      String(req.query.debug || '').toLowerCase()
    );

    const pr = await PassResult.findOne({ txId }).lean();

    // ✅ 핵심: PortOne txId인데 PassResult가 없으면 "멈춤 방지" signup 폴백
    if (!pr) {
      if (isPortOneTxId(txId)) {
        return json(res, 200, {
          ok: true,
          route: 'signup',
          txId: String(txId),
          userExists: false,
          consumed: false,
          providerHint: 'portone',
          note:
            'PassResult 문서가 없어 PortOne(identityVerificationId) 건은 signup으로 폴백 처리했습니다.',
        });
      }
      return json(res, 404, { ok: false, code: 'PASS_TX_NOT_FOUND' });
    }

    // PASS 자체가 실패한 경우만 에러 처리
    if (pr.status === 'fail') {
      return json(res, 200, {
        ok: false,
        code: pr.failCode || 'FAIL',
        message: pr.failMessage || 'pass failed',
      });
    }

    // 아직 success 상태가 아니면 대기(프론트가 계속 폴링/재시도하도록 ok:false 유지)
    if (pr.status !== 'success') {
      return json(res, 200, {
        ok: false,
        code: 'PASS_NOT_SUCCESS',
        status: pr.status,
        providerHint: pr.provider || providerHintByTxId(txId),
      });
    }

    // 여기부터는 PASS "성공" 상태
    // CI가 없으면 신규 가입으로만 처리
    if (!pr.ciHash) {
      return json(res, 200, {
        ok: true,
        route: 'signup',
        txId: String(txId),
        userExists: false,
        consumed: !!pr.consumed,
        providerHint: pr.provider || providerHintByTxId(txId),
        note: 'PASS 성공 상태지만 ciHash가 없어 signup으로 처리합니다.',
      });
    }

    let userExists = false;
    let debugUser = null;

    // 1차: PassIdentity 컬렉션 매핑 확인
    const ident = await PassIdentity.findOne({
      ciHash: pr.ciHash,
    })
      .select('userId')
      .lean()
      .catch((e) => {
        console.warn('[PASS/route] identity lookup error:', e?.message || e);
        return null;
      });

    if (ident?.userId) {
      const linked = await User.findOne({ _id: ident.userId })
        .select('_id nickname phone carrier gender birthyear level createdAt')
        .lean()
        .catch((e) => {
          console.warn('[PASS/route] linked user lookup error:', e?.message || e);
          return null;
        });

      if (linked?._id) {
        userExists = true;
        debugUser = linked;
      }
    }

    // 2차: User 본문에 ciHash / pass.ciHash 로 직접 매칭(레거시/마이그레이션 호환)
    if (!userExists) {
      const found = await User.findOne({
        $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
      })
        .select('_id nickname phone carrier gender birthyear level createdAt')
        .lean()
        .catch((e) => {
          console.warn('[PASS/route] direct user lookup error:', e?.message || e);
          return null;
        });

      if (found?._id) {
        userExists = true;
        debugUser = found;
      }
    }

    const routeName = userExists ? 'templogin' : 'signup';

    // 디버그용 유저 정보 (옵션)
    let debugUserPayload = undefined;
    if (wantDebugUser && debugUser) {
      debugUserPayload = {
        _id: String(debugUser._id),
        nickname: debugUser.nickname || null,
        phone: debugUser.phone || null,
        carrier: debugUser.carrier || null,
        gender: debugUser.gender || null,
        birthyear: debugUser.birthyear ?? null,
        level: debugUser.level ?? null,
        createdAt: debugUser.createdAt || null,
      };
    }

    return json(res, 200, {
      ok: true,
      route: routeName,
      txId: String(txId),
      userExists,
      consumed: !!pr.consumed,
      providerHint: pr.provider || providerHintByTxId(txId),
      ...(debugUserPayload ? { debugUser: debugUserPayload } : {}),
    });
  } catch (e) {
    console.error('[PASS/route] error:', e);
    return json(res, 500, {
      ok: false,
      code: 'ROUTE_UNHANDLED',
      message: e?.message || '분기 결정 실패',
    });
  }
});

module.exports = router;
