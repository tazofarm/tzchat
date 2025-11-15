// backend/routes/pass/passResultRouter.js
// base: /api/auth/pass
// - GET  /status
// - GET  /result/:txId
// - GET  /route

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

/* ===================== 2) STATUS ====================== */

router.get('/status', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId)
      return json(res, 400, {
        ok: false,
        code: 'NO_TXID',
        message: 'txId required',
      });

    const doc = await PassResult.findOne({ txId }).lean();
    if (!doc) return json(res, 200, { ok: true, status: 'pending' });

    const baseResult = {
      txId: doc.txId,
      status: doc.status,
      consumed: !!doc.consumed,
      failCode:
        doc.status === 'fail' ? doc.failCode || 'UNKNOWN' : null,
      failMessage:
        doc.status === 'fail'
          ? doc.failMessage ||
            (doc.rawMasked && doc.rawMasked.RETURNMSG) ||
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

    return json(res, 200, { ok: true, status: 'pending' });
  } catch (e) {
    console.error('[PASS/status] error:', e);
    return json(res, 500, {
      ok: false,
      code: 'STATUS_ERROR',
      message: '상태 조회 실패',
    });
  }
});

/* ===================== 3) RESULT ====================== */

router.get('/result/:txId', async (req, res) => {
  try {
    const { txId } = req.params || {};
    if (!txId) return json(res, 400, { ok: false, code: 'NO_TXID' });

    const doc = await PassResult.findOne({ txId }).lean();
    if (!doc) return json(res, 404, { ok: false, code: 'NOT_FOUND' });

    // consumed 와 상관없이 항상 PassResult 전체를 돌려줌
    return json(res, 200, {
      ok: true,
      status: doc.status,
      consumed: !!doc.consumed,
      result: {
        txId: doc.txId,
        status: doc.status,
        consumed: !!doc.consumed,
        failCode:
          doc.status === 'fail' ? doc.failCode || 'UNKNOWN' : null,
        failMessage:
          doc.status === 'fail'
            ? doc.failMessage ||
              (doc.rawMasked && doc.rawMasked.RETURNMSG) ||
              null
            : null,
        ciHash: doc.ciHash || null,
        diHash: doc.diHash || null,
        name: doc.name || '',
        birthyear: doc.birthyear ?? null,
        gender: doc.gender || '',
        phone: doc.phone || '',
        carrier: doc.carrier || '',
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

/* ===================== 4) ROUTE (CI-only & real user check) ====================== */

router.get('/route', async (req, res) => {
  try {
    const { txId } = req.query;
    if (!txId)
      return json(res, 400, { ok: false, code: 'NO_TXID' });

    const pr = await PassResult.findOne({ txId }).lean();
    if (!pr) return json(res, 404, { ok: false, code: 'PASS_TX_NOT_FOUND' });

    // consumed 여부와 상관없이 status가 success 이면 분기 로직 수행
    if (pr.status === 'fail')
      return json(res, 200, {
        ok: false,
        code: pr.failCode || 'FAIL',
        message: pr.failMessage || 'pass failed',
      });
    if (pr.status !== 'success')
      return json(res, 200, {
        ok: false,
        code: 'PASS_NOT_SUCCESS',
        status: pr.status,
      });

    // PASS 성공 상태: CI 기준으로 회원 존재 여부 확인
    if (!pr.ciHash) {
      return json(res, 200, {
        ok: true,
        route: 'signup',
        txId,
        userExists: false,
        consumed: !!pr.consumed,
      });
    }

    let userExists = false;

    const ident = await PassIdentity.findOne({
      ciHash: pr.ciHash,
    })
      .select('userId')
      .lean()
      .catch(() => null);
    if (ident?.userId) {
      const linked = await User.findOne({ _id: ident.userId })
        .select('_id')
        .lean();
      if (linked?._id) userExists = true;
    }

    if (!userExists) {
      const found = await User.findOne({
        $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
      })
        .select('_id')
        .lean();
      if (found?._id) userExists = true;
    }

    const routeName = userExists ? 'templogin' : 'signup';
    return json(res, 200, {
      ok: true,
      route: routeName,
      txId,
      userExists,
      consumed: !!pr.consumed,
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
