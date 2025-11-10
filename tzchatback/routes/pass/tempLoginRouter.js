// backend/routes/pass/tempLoginRouter.js
// base mount: /api/auth/pass
// POST /temp-login  → PASS txId로 임시 로그인(JWT+세션 발급)

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const { PassResult, PassIdentity, User } = require('@/models');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';
const COOKIE_SAME_SITE = (process.env.JWT_COOKIE_SAMESITE || 'none').toLowerCase();
const COOKIE_SECURE = ['1','true','yes','on'].includes(String(process.env.JWT_COOKIE_SECURE || 'true').toLowerCase());

const AUTO_UPDATE_FROM_ENV = ['1','true','yes','on'].includes(
  String(process.env.PASS_TEMPLOGIN_UPDATE_PHONE || '').toLowerCase()
);

const sha256Hex = (s = '') => crypto.createHash('sha256').update(String(s)).digest('hex');

function normalizePhoneKR(raw = '') {
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+0')) clean = '+' + clean.slice(2);
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  if (clean.startsWith('82')) return '+' + clean;
  return '+82' + clean;
}

function signToken(user) {
  return jwt.sign({ sub: String(user._id), nickname: user.nickname || '' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function setJwtCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: 7*24*60*60*1000,
  });
}

router.post('/temp-login', async (req, res) => {
  const { txId, updateProfile } = req.body || {};
  const tx = (txId || '').toString().trim();
  if (!tx) return res.status(400).json({ ok: false, code: 'NO_TXID', message: 'txId required' });

  try {
    const pr = await PassResult.findOne({ txId: tx }).lean();
    if (!pr) return res.status(400).json({ ok: false, code: 'NO_TX' });
    if (pr.consumed === true || pr.consumedAt) return res.status(410).json({ ok: false, code: 'CONSUMED' });
    if (pr.status !== 'success') return res.status(400).json({ ok: false, code: 'NOT_SUCCESS' });
    if (!pr.ciHash) return res.status(400).json({ ok: false, code: 'NO_CI' });

    // ① identityId → userId 우선 매핑 + 실제 User 검증
    let user = null;
    if (pr.identityId) {
      const ident = await PassIdentity.findOne({ _id: pr.identityId }).select('userId ciHash').lean().catch(() => null);
      if (ident?.userId) {
        user = await User.findOne({ _id: ident.userId }).select('_id username nickname phone phoneHash carrier ciHash pass').lean();
      }
    }

    // ② CI로 직접 조회(구/신 호환)
    if (!user) {
      user = await User.findOne({
        $or: [{ ciHash: pr.ciHash }, { 'pass.ciHash': pr.ciHash }],
      }).select('_id username nickname phone phoneHash carrier ciHash pass').lean();
    }

    if (!user) return res.status(404).json({ ok: false, code: 'NO_USER', message: 'User not found for CI' });

    // 프로필 업데이트 옵션
    const prPhoneNorm = pr.phone ? normalizePhoneKR(pr.phone) : '';
    const diffs = {};
    if (prPhoneNorm && prPhoneNorm !== (user.phone || '')) diffs.phone = { old: user.phone || null, new: prPhoneNorm };
    if (pr.carrier && pr.carrier !== (user.carrier || '')) diffs.carrier = { old: user.carrier || null, new: pr.carrier };

    const clientWantsUpdate = (updateProfile === true || String(updateProfile).toLowerCase() === 'true');
    const shouldApply = AUTO_UPDATE_FROM_ENV || clientWantsUpdate;

    const willUpdate = {};
    if (shouldApply) {
      if (diffs.phone)   { willUpdate.phone   = diffs.phone.new; willUpdate.phoneHash = sha256Hex(diffs.phone.new); }
      if (diffs.carrier) { willUpdate.carrier = diffs.carrier.new; }
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
      await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
      req.session.userId = String(user._id);
      req.session.user = { _id: String(user._id), nickname: user.nickname || '' };
      await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    }

    // 소모 처리
    await PassResult.updateOne(
      { _id: pr._id },
      { $set: { consumed: true, consumedAt: new Date(), consumedBy: 'temp-login', consumedUser: user._id } }
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      user: { _id: user._id, username: user.username, nickname: user.nickname },
      token,
      profileUpdate: {
        applied: shouldApply && Object.keys(willUpdate).length > 0,
        updatedFields: shouldApply ? Object.keys(willUpdate) : [],
        diffs,
      },
    });
  } catch (e) {
    console.error('[PASS][TEMP-LOGIN][ERR]', e);
    return res.status(500).json({ ok: false, code: 'SERVER_ERROR', message: 'temp-login failed' });
  }
});

module.exports = router;
