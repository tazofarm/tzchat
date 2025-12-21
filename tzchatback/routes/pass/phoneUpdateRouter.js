// backend/routes/user/passPhoneRouter.js
// base mount: /api/user/pass-phone   ← 인증 필요
// ------------------------------------------------------
// POST /commit  -> txId(=PassResult.txId) 검증 후 현재 로그인 사용자에 phone/carrier 반영
//
// ✅ 최신 PortOne 파이프라인 호환
// - PASS 결과는 /api/auth/pass/relay + /api/auth/pass/portone/complete 에서 PassResult로 저장됨
// - CI 정본은 PassIdentity가 관리 (User.ciHash는 참조용일 수 있음)
// ------------------------------------------------------

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
const { PassResult, PassIdentity, User } = require('@/models');

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
    } catch (_) {}
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
    } catch (_) {}
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
  if (clean.startsWith('82')) return '+' + clean;
  return '+82' + clean;
}

function sha256Hex(text = '') {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

/**
 * ✅ “내 CI”를 최신 정책으로 가져오기
 * 1) PassIdentity(userId 기준)에서 ciHash가 있으면 그게 정본
 * 2) 없으면 User.ciHash(참조용) 폴백
 */
async function getMyCiHash(userId) {
  try {
    const pid = await PassIdentity.findOne({ userId }).select('ciHash').lean();
    if (pid?.ciHash) return String(pid.ciHash);
  } catch (_) {}

  const me = await User.findById(userId).select('ciHash').lean();
  return me?.ciHash ? String(me.ciHash) : '';
}

// ======================================================
// COMMIT: PASS 성공 결과를 내 계정에 반영
// ======================================================
router.post('/commit', requireAuth, async (req, res) => {
  const userId = req.__uid;
  const { txId } = req.body || {};
  const safeTx = (txId || '').toString().trim();

  if (!safeTx) {
    return res.status(400).json({ ok: false, code: 'NO_TXID', message: 'txId required' });
  }

  try {
    const pr = await PassResult.findOne({ txId: safeTx }).lean();
    if (!pr) return res.status(404).json({ ok: false, code: 'NO_TX', message: 'PassResult not found' });
    if (pr.status !== 'success') {
      return res.status(400).json({ ok: false, code: 'NOT_SUCCESS', message: 'PassResult not success' });
    }
    if (!pr.ciHash) {
      return res.status(400).json({ ok: false, code: 'NO_CI_IN_RESULT', message: 'ciHash missing in PassResult' });
    }

    // (선택) txId 바인딩 사용자 검증: PortOne 쪽에서 rawMasked.userId를 안 넣을 수도 있으니 "있을 때만" 체크
    const boundUserId = pr?.rawMasked?.userId;
    if (boundUserId && String(boundUserId) !== String(userId)) {
      return res.status(403).json({ ok: false, code: 'TX_BINDING_MISMATCH', message: 'txId is not bound to this user' });
    }

    // 내 계정 로드
    const me = await User.findById(userId).select('_id phone carrier status isDeleted deletedAt ciHash').lean();
    if (!me) return res.status(404).json({ ok: false, code: 'NO_ME', message: 'current user not found' });

    // ✅ CI 일치 검증(정본은 PassIdentity)
    const myCi = await getMyCiHash(userId);
    if (!myCi || String(myCi) !== String(pr.ciHash)) {
      return res.status(403).json({ ok: false, code: 'CI_MISMATCH', message: 'CI not matched with current user' });
    }

    // ✅ 커밋 직전 안전 정규화
    const nextPhone = pr.phone ? normalizePhoneKR(pr.phone) : '';
    const nextCarrier = pr.carrier ? String(pr.carrier) : '';

    if (!nextPhone) {
      return res.status(400).json({ ok: false, code: 'NO_PHONE_IN_RESULT', message: 'phone missing in PassResult' });
    }

    const willUpdate = {};
    if (nextPhone && nextPhone !== (me.phone || '')) willUpdate.phone = nextPhone;
    if (nextCarrier && nextCarrier !== (me.carrier || '')) willUpdate.carrier = nextCarrier;

    // 전화/통신사 모두 동일하면 "변경 없음"
    if (Object.keys(willUpdate).length === 0) {
      return res.status(400).json({
        ok: false,
        code: 'PHONE_NOT_CHANGED',
        message: '기존의 전화번호와 같습니다.',
      });
    }

    willUpdate.phoneVerifiedAt = new Date();
    willUpdate.phoneVerifiedBy = 'PASS';

    // 업데이트(중복 정책 포함)
    const tryUpdate = async () => {
      await User.updateOne({ _id: me._id }, { $set: willUpdate });
    };

    try {
      await tryUpdate();
    } catch (e) {
      // ✅ 전화번호 중복(유니크) 처리
      if (e && e.code === 11000) {
        // 누가 갖고 있는지 확인
        const holder = await User.findOne({ phone: nextPhone })
          .select('_id status isDeleted deletedAt')
          .lean();

        // 내가 나 자신이면 무시(이론상 거의 없음)
        if (holder && String(holder._id) === String(me._id)) {
          // 이미 내 번호인데 여기까지 왔다는 건 carrier만 바뀐 케이스 등
          // phone은 제거하고 carrier만 업데이트 재시도
          if (willUpdate.phone) delete willUpdate.phone;
          if (Object.keys(willUpdate).length === 0) {
            return res.status(400).json({ ok: false, code: 'PHONE_NOT_CHANGED', message: '기존의 전화번호와 같습니다.' });
          }
          await tryUpdate();
        } else {
          // ✅ 번호 재사용 정책:
          // 다른 계정이 deleted/탈퇴상태면 그 계정의 phone을 비우고 내 업데이트를 재시도
          const holderDeleted =
            holder &&
            (holder.status === 'deleted' || holder.isDeleted === true);

          if (holderDeleted) {
            await User.updateOne({ _id: holder._id }, { $unset: { phone: 1, phoneHash: 1, phoneVerifiedAt: 1, phoneVerifiedBy: 1 } });
            // 재시도
            await tryUpdate();
          } else {
            return res.status(409).json({ ok: false, code: 'PHONE_DUPLICATE', message: '이미 등록된 전화번호입니다.' });
          }
        }
      } else {
        const code =
          e?.name === 'ValidationError' ? 'VALIDATION_ERROR'
          : e?.name === 'CastError' ? 'CAST_ERROR'
          : 'DB_ERROR';

        console.error('[PHONE-UPDATE][commit][DB_ERR]', {
          userId, txId: safeTx, willUpdate, message: e?.message, name: e?.name, code: e?.code
        });

        return res.status(400).json({ ok: false, code, message: e?.message || 'DB update error' });
      }
    }

    // ✅ PassIdentity에도 최신 전화/통신사 반영(정본)
    try {
      const phoneHash = sha256Hex(nextPhone);
      await PassIdentity.updateOne(
        { ciHash: myCi },
        { $set: { userId: me._id, phoneHash, carrier: nextCarrier, lastVerifiedAt: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.warn('[PHONE-UPDATE][commit][PassIdentity sync warn]', e?.message || e);
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
