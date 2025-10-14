// routes/user/userRouter.js
// base: /api
// -------------------------------------------------------------
// 👤 사용자 프로필/설정 라우터  (등급 규칙 가드 적용)
// - index.js 에서 app.use('/api', ...)로 마운트됨 → 내부 경로에 /api 금지
// -------------------------------------------------------------
const express = require('express');
const { User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

// 🔹 등급 규칙 헬퍼
const { SELF_EDIT, canEditSelf } = require('@/shared/levelRules');
const { sanitizeProfileUpdate, isAllowedPreference } = require('@/middlewares/levelGuard');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion); // 전역 차단

// 공통: 내 사용자 ID
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  if (jwtId) return String(jwtId);
  if (sessId) return String(sessId);
  return null;
}
// 공통: 내 등급
function getMyLevel(req) {
  return req?.user?.user_level || req?.session?.user?.user_level || '일반회원';
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
 * 🔧 닉네임 업데이트 (등급 가드)
 */
router.put('/update-nickname', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);

  try {
    if (!userId) return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    if (!canEditSelf('nickname', level)) return res.status(403).json({ success: false, message: '해당 등급에서 닉네임 변경 불가' });

    const { nickname } = req.body || {};
    const trimmedNickname = String(nickname || '').trim();
    if (!trimmedNickname) return res.status(400).json({ success: false, message: '닉네임이 비어있습니다.' });

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
 * 🔧 지역 정보 업데이트 (등급 가드)
 */
router.patch('/user/region', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);

  try {
    if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!canEditSelf('region', level)) return res.status(403).json({ message: '해당 등급에서 지역 변경 불가' });

    const { region1, region2 } = req.body || {};
    if (!region1 || !region2) return res.status(400).json({ message: '잘못된 요청: region1, region2가 필요합니다.' });

    await User.findByIdAndUpdate(userId, { region1, region2 });
    res.json({ message: '지역 정보가 업데이트되었습니다.' });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🔧 자기소개 업데이트 (등급/길이 제한 가드)
 */
router.put('/update-selfintro', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);

  try {
    if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!canEditSelf('selfintro', level)) return res.status(403).json({ message: '해당 등급에서 소개 변경 불가' });

    const safe = sanitizeProfileUpdate(level, { selfintro: (req.body || {}).selfintro ?? '' });
    if (!('selfintro' in safe)) return res.status(400).json({ message: '입력값이 허용되지 않습니다.' });

    const user = await User.findByIdAndUpdate(userId, { selfintro: safe.selfintro }, { new: true });
    if (!user) return res.status(404).json({ message: '사용자 없음' });

    res.json({ success: true, selfintro: user.selfintro });
  } catch (error) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: error?.message, name: error?.name });
    res.status(500).json({ message: '서버 에러' });
  }
});

/**
 * 🔧 특징(내 정보) 업데이트 (등급 가드 + 동기화 규칙 유지)
 */
router.patch('/user/preference', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);

  try {
    if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const prefStr = String((req.body || {}).preference ?? '').trim();
    if (!prefStr) return res.status(400).json({ message: '값이 부족합니다.' });
    if (!canEditSelf('preference', level)) return res.status(403).json({ message: '해당 등급에서 특징 변경 불가' });
    if (!isAllowedPreference(level, prefStr)) return res.status(403).json({ message: '해당 등급에서 허용되지 않은 특징 값' });

    const updateDoc = { preference: prefStr };
    // 기존 동기화 규칙 유지
    if (prefStr.startsWith('이성친구')) {
      updateDoc.search_preference = '이성친구 - 전체';
    } else if (prefStr.startsWith('동성친구')) {
      updateDoc.search_preference = '동성친구 - 전체';
    }

    const user = await User.findByIdAndUpdate(userId, updateDoc, { new: true });
    if (!user) return res.status(404).json({ message: '사용자 없음' });

    res.json({
      success: true,
      preference: user.preference,
      search_preference: user.search_preference,
    });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    res.status(500).json({ message: '서버 에러' });
  }
});

/**
 * 🔧 결혼유무 변경 (등급 가드)
 */
router.patch('/user/marriage', async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
  if (!canEditSelf('marriage', level)) return res.status(403).json({ success: false, error: '해당 등급에서 결혼유무 변경 불가' });

  const raw = (req.body?.marriage || '').toString().trim();
  const ALLOWED = ['미혼', '기혼', '돌싱'];
  if (!ALLOWED.includes(raw)) {
    return res.status(400).json({ success: false, error: 'marriage must be one of 미혼/기혼/돌싱' });
  }

  try {
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
