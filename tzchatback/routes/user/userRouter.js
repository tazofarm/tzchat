// routes/user/userRouter.js
// base: /api
// -------------------------------------------------------------
// 👤 사용자 프로필/설정 라우터
// - index.js 에서 app.use('/api', ...)로 마운트됨 → 내부 경로에 /api 금지
// - 공통 로깅: req.baseUrl + req.path 로 실제 호출 경로 출력
// - 미사용 의존성 제거
// -------------------------------------------------------------
const express = require('express');

// models/index.js 가 모든 모델을 export 한다는 가정
const { User } = require('@/models');

// ✅ 공통 인증 미들웨어(OPTIONS 통과 + Bearer/X-Auth-Token/쿠키/쿼리 지원)
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion); // 전역 차단

/* -----------------------------------------------------------
 * 공통: 내 사용자 ID 추출 (JWT 우선, 세션 백업)
 *  - authMiddleware가 req.user / req.session.user 를 맞춰줍니다.
 * ---------------------------------------------------------*/
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  if (jwtId) return String(jwtId);
  if (sessId) return String(sessId);
  return null;
}

/* -----------------------------------------------------------
 * ✅ 공통 요청/응답 로깅 미들웨어 (이 라우터 전용)
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
    console.log('[API][RES]', {
      path: req.baseUrl + req.path,
      status,
      ms,
      size,
    });
    return originalJson(body);
  };
  next();
});

/**
 * 🔧 닉네임 업데이트 API (로그인 필요)
 */
router.put('/update-nickname', requireLogin, async (req, res) => {
  const userId = getMyId(req);

  try {
    if (!userId) {
      console.warn('[AUTH][ERR]', { path: req.baseUrl + req.path, message: 'Unauthorized' });
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { nickname } = req.body || {};
    const trimmedNickname = String(nickname || '').trim();

    if (!trimmedNickname) {
      console.warn('[API][ERR]', { path: req.baseUrl + req.path, message: '닉네임이 비어있습니다.' });
      return res.status(400).json({ success: false, message: '닉네임이 비어있습니다.' });
    }

    // (선택) 길이/문자 규칙 적용 가능
    // if (trimmedNickname.length < 2) ...

    // ✅ 본인 제외 중복 검사
    const existing = await User.findOne({ nickname: trimmedNickname }).select('_id').lean();
    if (existing && String(existing._id) !== String(userId)) {
      console.warn('[API][ERR]', { path: req.baseUrl + req.path, message: '중복된 닉네임입니다.' });
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
 * 🔧 지역 정보 업데이트 API (로그인 필요)
 */
router.patch('/user/region', requireLogin, async (req, res) => {
  const userId = getMyId(req);

  try {
    if (!userId) {
      console.warn('[AUTH][ERR]', { path: req.baseUrl + req.path, message: 'Unauthorized' });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const { region1, region2 } = req.body || {};
    if (!region1 || !region2) {
      console.warn('[API][ERR]', { path: req.baseUrl + req.path, message: '잘못된 요청: region1, region2가 필요합니다.' });
      return res.status(400).json({ message: '잘못된 요청: region1, region2가 필요합니다.' });
    }

    await User.findByIdAndUpdate(userId, { region1, region2 });
    res.json({ message: '지역 정보가 업데이트되었습니다.' });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🔧 자기소개 업데이트 (로그인 필요)
 */
router.put('/update-selfintro', requireLogin, async (req, res) => {
  const userId = getMyId(req);

  try {
    if (!userId) {
      console.warn('[AUTH][ERR]', { path: req.baseUrl + req.path, message: 'Unauthorized' });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const newIntro = (req.body || {}).selfintro ?? '';
    const user = await User.findByIdAndUpdate(userId, { selfintro: newIntro }, { new: true });

    if (!user) {
      console.warn('[API][ERR]', { path: req.baseUrl + req.path, message: '사용자 없음', userId });
      return res.status(404).json({ message: '사용자 없음' });
    }

    res.json({ success: true, selfintro: user.selfintro });
  } catch (error) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: error?.message, name: error?.name });
    res.status(500).json({ message: '서버 에러' });
  }
});

/**
 * 🔧 특징(내 정보) 업데이트 (로그인 필요)
 */
router.patch('/user/preference', requireLogin, async (req, res) => {
  const userId = getMyId(req);

  try {
    if (!userId) {
      console.warn('[AUTH][ERR]', { path: req.baseUrl + req.path, message: 'Unauthorized' });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const { preference } = req.body || {};
    if (typeof preference === 'undefined' || preference === null) {
      console.warn('[API][ERR]', { path: req.baseUrl + req.path, message: '값이 부족합니다.' });
      return res.status(400).json({ message: '값이 부족합니다.' });
    }

    const user = await User.findByIdAndUpdate(userId, { preference }, { new: true });

    if (!user) {
      console.warn('[API][ERR]', { path: req.baseUrl + req.path, message: '사용자 없음', userId });
      return res.status(404).json({ message: '사용자 없음' });
    }

    res.json({ success: true, preference: user.preference });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    res.status(500).json({ message: '서버 에러' });
  }
});

module.exports = router;
