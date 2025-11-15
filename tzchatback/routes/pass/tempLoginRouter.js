// backend/routes/pass/tempLoginRouter.js
// base: /api/auth/pass
// - POST /temp-login

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const { PassResult, User, PassIdentity } = require('@/models');
const { issueSessionForUser } = require('@/lib/auth/session');

/* ──────────────── 공통 유틸 ──────────────── */

const sha256Hex = (s = '') =>
  crypto.createHash('sha256').update(String(s)).digest('hex');

function json(res, status, body) {
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(status).json(body);
}

/* ===================== 1) KR 전화번호 정규화 ====================== */

function normalizePhoneKR(raw = '') {
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+0')) clean = '+' + clean.slice(2);
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  if (clean.startsWith('82')) return '+' + clean;
  return '+82' + clean;
}

/* ===================== 2) PassResult 기반 임시 로그인 ====================== */

router.post('/temp-login', async (req, res) => {
  try {
    const { txId, updateProfile } = req.body || {};
    if (!txId) {
      return json(res, 400, { ok: false, code: 'NO_TXID' });
    }

    const pr = await PassResult.findOne({ txId }).lean();
    if (!pr) {
      return json(res, 404, { ok: false, code: 'PASS_TX_NOT_FOUND' });
    }

    if (pr.status !== 'success') {
      return json(res, 400, { ok: false, code: 'NOT_SUCCESS' });
    }

    // ❗ 여기서 더 이상 consumed 를 에러로 취급하지 않는다.
    // 동일 txId 로 temp-login 을 여러 번 호출해도 허용.
    // consumed 플래그는 "사용 기록" 정도로만 남겨둔다.
    //
    // if (pr.consumed === true || pr.consumedAt) {
    //   return json(res, 410, { ok: false, code: 'CONSUMED' });
    // }

    if (!pr.ciHash) {
      return json(res, 400, { ok: false, code: 'NO_CI' });
    }

    // 1) CI 기준으로 유저 찾기
    let user = null;

    // 1-1) PassIdentity 연결 우선
    const ident = await PassIdentity.findOne({ ciHash: pr.ciHash })
      .select('userId')
      .lean()
      .catch(() => null);

    if (ident?.userId) {
      user = await User.findOne({ _id: ident.userId }).lean();
    }

    // 1-2) 과거에 User 에 ciHash 직접 저장한 경우도 검색
    if (!user) {
      user = await User.findOne({
        $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
      }).lean();
    }

    if (!user) {
      return json(res, 404, { ok: false, code: 'USER_NOT_FOUND' });
    }

    // 2) 필요한 경우 프로필 정보 업데이트 (전화번호 / 통신사 등)
    const updates = {};
    if (updateProfile) {
      if (pr.phone) {
        updates.phone = normalizePhoneKR(pr.phone);
        updates.phoneHash = sha256Hex(updates.phone);
      }
      if (pr.carrier) {
        updates.carrier = pr.carrier;
      }
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updates });
      }
    }

    // 3) 세션 발급
    await issueSessionForUser(res, user);

    // 4) PassResult 에 consumed 플래그만 기록 (재호출은 허용)
    if (!pr.consumed) {
      await PassResult.updateOne(
        { txId },
        { $set: { consumed: true, consumedAt: new Date() } }
      );
    }

    return json(res, 200, {
      ok: true,
      code: 'TEMP_LOGIN_OK',
      userId: String(user._id),
    });
  } catch (e) {
    console.error('[PASS/temp-login] error:', e);
    return json(res, 500, {
      ok: false,
      code: 'TEMPLOGIN_ERROR',
      message: 'temp-login failed',
    });
  }
});

module.exports = router;
