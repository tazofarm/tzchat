// base mount: /api/user/pass-phone   ← 인증 필요 (화이트리스트 제외)
// POST /start        -> PASS 시작 (intent: 'phone_update')  ※ 앱 방식: { ok, txId, startUrl } 반환
// GET  /start/html/:txId -> 캐시된 PASS 시작 HTML 서빙(외부 브라우저 열기용)
// POST /commit       -> txId 검증 후 현재 로그인 사용자에 phone/carrier 반영

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

// 퍼블릭 오리진(외부 브라우저에서 접근 가능해야 함)
function getPublicOrigin(req) {
  const env = (process.env.API_ORIGIN || process.env.PUBLIC_API_ORIGIN || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
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

// ===================== 메모리 HTML 캐시 =====================
const htmlCache = new Map(); // txId -> { html, expireAt }
const HTML_TTL_MS = 5 * 60 * 1000;
function saveHtml(txId, html) {
  htmlCache.set(txId, { html, expireAt: Date.now() + HTML_TTL_MS });
  setTimeout(() => {
    const v = htmlCache.get(txId);
    if (v && v.expireAt <= Date.now()) htmlCache.delete(txId);
  }, HTML_TTL_MS + 5000);
}
function loadHtml(txId) {
  const v = htmlCache.get(txId);
  if (!v) return null;
  if (v.expireAt <= Date.now()) { htmlCache.delete(txId); return null; }
  return v.html;
}

// ===== START: PASS 시작 (전화번호 변경) — 앱 방식(A) 대응
router.post('/start', requireAuth, async (req, res) => {
  const userId = req.__uid;
  const intent = 'phone_update';
  const clientTx = (req.body && req.body.txId) ? String(req.body.txId) : null; // 선택적 사전할당

  try {
    // 다날 세션 생성
    let out;
    try {
      out = await danal.buildStart({ intent, mode: 'json', txId: clientTx || undefined });
    } catch (e) {
      console.error('[PHONE-UPDATE][start][DANAL_ERR]', { message: e?.message, code: e?.code, stage: e?.stage });
      return res.status(502).json({ ok: false, code: 'DANAL_START_ERROR', message: 'phone update start failed' });
    }

    // 필수 산출물 확보
    const txId = out?.tid || clientTx || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const html = out?.body || out?.formHtml;
    if (!html) {
      return res.status(502).json({ ok: false, code: 'START_NO_FORM', message: 'formHtml not generated' });
    }

    // 사전 pending 문서(누구의 변경 트랜잭션인지 바인딩)
    try {
      await PassResult.updateOne(
        { txId },
        { $setOnInsert: {
            txId,
            status: 'pending',
            provider: 'Danal',
            rawMasked: { intent, userId }
          }
        },
        { upsert: true }
      );
    } catch (e) {
      console.warn('[PHONE-UPDATE][start][PR_UPSERT_WARN]', e?.message || e);
    }

    // 앱(외부 브라우저)용: HTML을 캐시하고 URL만 반환
    saveHtml(txId, html);
    const startUrl = `${getPublicOrigin(req)}/api/user/pass-phone/start/html/${encodeURIComponent(txId)}`;

    return res.json({
      ok: true,
      txId,
      startUrl
    });
  } catch (e) {
    console.error('[PHONE-UPDATE][start][ERR]', {
      userId, message: e?.message, name: e?.name, code: e?.code,
    });
    return res.status(500).json({ ok: false, code: 'START_ERROR', message: 'phone update start failed' });
  }
});

// 외부 브라우저에서 여는 실제 시작 HTML 반환
router.get('/start/html/:txId', requireAuth, (req, res) => {
  const { txId } = req.params || {};
  const html = txId && loadHtml(txId);
  if (!html) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send('<!doctype html><html><body>Invalid or expired PASS session.</body></html>');
  }
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  return res.status(200).send(html);
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
