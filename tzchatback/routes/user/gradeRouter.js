// routes/user/gradeRouter.js
// base: /api
// -------------------------------------------------------------
// 👤 회원 등급 수동 변경 (TEST)
//  - DB 변경 없음: 기존 User 스키마의 user_level 필드만 갱신
//  - 허용 등급: "일반회원" | "여성회원" | "프리미엄"
// -------------------------------------------------------------

const express = require('express');
const { User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();

// 전역 미들웨어
router.use(requireLogin, blockIfPendingDeletion);

// 공통: 내 사용자 ID 추출 (JWT 우선, 세션 백업)
function getMyId(req) {
  const jwtId = req?.user?._id || req?.user?.sub;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}

/**
 * PATCH /api/user/grade
 * body: { grade: "일반회원" | "여성회원" | "프리미엄" }
 * 효과: 현재 로그인 사용자의 user_level 값을 grade로 업데이트
 */
router.patch('/user/grade', async (req, res) => {
  const myId = getMyId(req);
  const grade = (req.body?.grade || '').trim();
  const ALLOWED = ['일반회원', '여성회원', '프리미엄'];

  try {
    if (!myId) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    if (!ALLOWED.includes(grade)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 등급입니다. (일반회원/여성회원/프리미엄)',
      });
    }

    const result = await User.updateOne(
      { _id: myId },
      { $set: { user_level: grade } },
      { strict: false } // DB는 그대로, 존재하는 필드만 갱신
    );

    // 간단 로깅
    try {
      console.log(`[Grade] ${myId} -> ${grade}`, {
        matched: result?.matchedCount ?? result?.n,
        modified: result?.modifiedCount ?? result?.nModified,
      });
    } catch (_) {}

    return res.json({
      success: true,
      message: '회원 등급이 변경되었습니다.',
      data: { user_level: grade },
    });
  } catch (err) {
    console.error('[Grade] 변경 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
