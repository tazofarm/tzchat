// routes/user/userRouter.js
// base: /api
// -------------------------------------------------------------
// 👤 사용자 프로필/설정 라우터 (등급 가드 제거 버전)
// - index.js 에서 app.use('/api', ...)로 마운트됨 → 내부 경로에 /api 금지
// - 모달 입력값을 최소 검증 후 그대로 반영 (등급 무관)
// -------------------------------------------------------------
const express = require('express');
const { User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();

// 전역 인증/차단 미들웨어
router.use(requireLogin, blockIfPendingDeletion);

// 공통: 내 사용자 ID
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  if (jwtId) return String(jwtId);
  if (sessId) return String(sessId);
  return null;
}

/* -----------------------------------------------------------
 * 라우터 전용 로깅
 * ---------------------------------------------------------*/
router.use((req, res, next) => {
  const started = Date.now();
  console.log('[API][REQ]', {
    path: req.baseUrl + req.path,
    method: req.method,
    params: req.params,
    query: req.query,
    userId: getMyId(req),
  });

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const ms = Date.now() - started;
    const status = res.statusCode;
    const size = typeof body === 'string' ? body.length : Buffer.byteLength(JSON.stringify(body || {}));
    console.log('[API][RES]', { path: req.baseUrl + req.path, status, ms, size });
    return originalJson(body);
  };
  next();
});

/**
 * 🔧 닉네임 업데이트 (등급 가드 제거)
 * PUT /update-nickname
 * body: { nickname }
 */
router.put('/update-nickname', async (req, res) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    const { nickname } = req.body || {};
    const trimmedNickname = String(nickname || '').trim();
    if (!trimmedNickname) return res.status(400).json({ success: false, message: '닉네임이 비어있습니다.' });

    // 중복 닉네임 검사 (본인 제외)
    const existing = await User.findOne({ nickname: trimmedNickname }).select('_id').lean();
    if (existing && String(existing._id) !== String(userId)) {
      return res.status(409).json({ success: false, message: '중복된 닉네임입니다.' });
    }

    await User.findByIdAndUpdate(userId, { nickname: trimmedNickname });
    return res.json({ success: true });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
});

/**
 * 🔧 지역 정보 업데이트 (등급 가드 제거)
 * PATCH /user/region
 * body: { region1, region2 }
 */
router.patch('/user/region', async (req, res) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    const { region1, region2 } = req.body || {};
    if (!region1 || !region2) {
      return res.status(400).json({ success: false, message: '잘못된 요청: region1, region2가 필요합니다.' });
    }

    await User.findByIdAndUpdate(userId, { region1, region2 });
    return res.json({ success: true, region1, region2 });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
});

/**
 * 🔧 자기소개 업데이트 (등급/길이 가드 제거 — 최소 검증만)
 * PUT /update-selfintro
 * body: { selfintro }
 */
router.put('/update-selfintro', async (req, res) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    const raw = (req.body || {}).selfintro ?? '';
    const selfintro = String(raw).trim();

    if (!selfintro) {
      return res.status(400).json({ success: false, message: '소개가 비어있습니다.' });
    }

    const user = await User.findByIdAndUpdate(userId, { selfintro }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: '사용자 없음' });

    return res.json({ success: true, selfintro: user.selfintro });
  } catch (error) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: error?.message, name: error?.name });
    return res.status(500).json({ success: false, message: '서버 에러' });
  }
});

/**
 * 🔧 특징(선호/성향) 업데이트 (등급 가드 제거)
 * PATCH /user/preference
 * body: { preference }
 *
 * ※ 기존 동기화 규칙 유지:
 *   - '이성친구'로 시작하면 search_preference = '이성친구 - 전체'
 *   - '동성친구'로 시작하면 search_preference = '동성친구 - 전체'
 */
router.patch('/user/preference', async (req, res) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });

    const prefStr = String((req.body || {}).preference ?? '').trim();
    if (!prefStr) return res.status(400).json({ success: false, message: '값이 부족합니다.' });

    const updateDoc = { preference: prefStr };
    if (prefStr.startsWith('이성친구')) {
      updateDoc.search_preference = '이성친구 - 전체';
    } else if (prefStr.startsWith('동성친구')) {
      updateDoc.search_preference = '동성친구 - 전체';
    }

    const user = await User.findByIdAndUpdate(userId, updateDoc, { new: true });
    if (!user) return res.status(404).json({ success: false, message: '사용자 없음' });

    return res.json({
      success: true,
      preference: user.preference,
      search_preference: user.search_preference,
    });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    return res.status(500).json({ success: false, message: '서버 에러' });
  }
});

/**
 * 🔧 결혼유무 변경 (등급 가드 제거)
 * PATCH /user/marriage
 * body: { marriage }  // 허용 범위 내 최소 검증
 */
router.patch('/user/marriage', async (req, res) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

    const raw = (req.body?.marriage || '').toString().trim();
    const ALLOWED = ['미혼', '기혼', '돌싱'];
    if (!ALLOWED.includes(raw)) {
      return res.status(400).json({ success: false, error: 'marriage must be one of 미혼/기혼/돌싱' });
    }

    const updated = await User.findByIdAndUpdate(userId, { marriage: raw }, { new: true })
      .select('marriage updatedAt')
      .lean();

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, marriage: updated.marriage, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('[API][ERR] /user/marriage', { message: err?.message });
    return res.status(500).json({ success: false, error: '결혼유무 업데이트 실패' });
  }
});

module.exports = router;
