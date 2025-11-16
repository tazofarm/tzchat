// routes/search/contactsRouter.js
// base: /api
// -------------------------------------------------------------
// 📞 연락처 해시 관리 라우터
// - POST   /api/contacts/hashes   : 내 연락처 해시 업로드/덮어쓰기
// - DELETE /api/contacts/hashes   : 내 연락처 해시 삭제 + 스위치 OFF (보조)
// -------------------------------------------------------------

const express = require('express');
const { User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

/* 공통 유틸 */
function getMyId(req) {
  const jwtId = req?.user?._id || req?.user?.sub;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}
const s = (v) => (typeof v === 'string' ? v.trim() : v ?? '');

/** 라우터 로깅 (요약) */
router.use((req, res, next) => {
  const started = Date.now();
  const path = req.baseUrl + req.path;
  console.log('[API][REQ]', { path, method: req.method, userId: getMyId(req) });

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const ms = Date.now() - started;
    const status = res.statusCode;
    const size = typeof body === 'string' ? body.length : Buffer.byteLength(JSON.stringify(body || {}));
    console.log('[API][RES]', { path, status, ms, size });
    return originalJson(body);
  };
  next();
});

/* =========================
   POST /contacts/hashes
   body: { hashes: string[] }
   - 앱에서 읽어온 연락처 전화번호를 클라이언트에서 SHA-256 후 전송
   - 서버에서는 그대로 저장(중복 제거만)
========================= */
router.post('/contacts/hashes', async (req, res, next) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });

    const hashesRaw = Array.isArray(req.body?.hashes) ? req.body.hashes : [];
    if (!hashesRaw.length) {
      return res.status(400).json({ ok: false, error: 'hashes 배열이 비어 있습니다.' });
    }

    // 문자열로 변환 + 공백 제거 + 간단 필터링
    let hashes = hashesRaw
      .map((h) => s(h))
      .filter((h) => h.length > 0);

    // 선택: 64자 hex 형태만 허용하고 싶으면 아래 주석 해제
    // hashes = hashes.filter((h) => /^[0-9a-f]{64}$/i.test(h));

    // 중복 제거
    hashes = Array.from(new Set(hashes));

    if (!hashes.length) {
      return res.status(400).json({ ok: false, error: '유효한 해시가 없습니다.' });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { localContactHashes: hashes } },
      { new: true }
    ).select('_id localContactHashes');

    if (!updated) {
      return res.status(404).json({ ok: false, error: '사용자 없음' });
    }

    return res.json({
      ok: true,
      count: updated.localContactHashes?.length || 0,
    });
  } catch (err) {
    next(err);
  }
});

/* =========================
   DELETE /contacts/hashes
   - 내 연락처 해시 전체 삭제
   - search_disconnectLocalContacts 를 OFF 로 돌려주는 보조 역할 포함
========================= */
router.delete('/contacts/hashes', async (req, res, next) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          localContactHashes: [],
          search_disconnectLocalContacts: 'OFF', // 보조: 스위치도 함께 OFF
        }
      },
      { new: true }
    ).select('_id localContactHashes search_disconnectLocalContacts');

    if (!updated) {
      return res.status(404).json({ ok: false, error: '사용자 없음' });
    }

    return res.json({
      ok: true,
      count: updated.localContactHashes?.length || 0,
      disconnectLocalContacts: updated.search_disconnectLocalContacts,
    });
  } catch (err) {
    next(err);
  }
});

/* 파일 전용 에러 핸들러 */
router.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const msg = err.message || 'Internal Server Error';
  console.error('[contactsRouter]', status, msg, err.stack);
  res.status(status).json({ ok: false, error: msg });
});

module.exports = router;
