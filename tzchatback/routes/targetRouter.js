const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용
// const bcrypt = require('bcrypt'); // ❌ 미사용 제거
// const jwt = require('jsonwebtoken'); // ❌ 미사용 제거
const User = require('../models/User');
// const FriendRequest = require('../models/FriendRequest'); // ❌ 미사용 제거
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const requireLogin = require('../middlewares/authMiddleware'); // ✅ 공통 인증 미들웨어
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');

const router = express.Router();

// ────────────────────────────────────────────────────────────
// 공통: 내 사용자 ID 추출 (JWT 우선, 세션 백업)
// ────────────────────────────────────────────────────────────
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}

// 공통 유틸
const s = (v) => (typeof v === 'string' ? v.trim() : v ?? '');

// ────────────────────────────────────────────────────────────
// 1) 검색 나이 (year1/year2)
// ────────────────────────────────────────────────────────────
router.patch('/search/year', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  let { year1, year2 } = req.body || {};

  console.log('[API][REQ] PATCH /search/year', { userId, year1, year2 });

  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const parsedYear1 = (year1 === '' || year1 === '전체') ? null : s(year1);
  const parsedYear2 = (year2 === '' || year2 === '전체') ? null : s(year2);

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_birthyear1: parsedYear1, search_birthyear2: parsedYear2 },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    console.log('[API][RES] /search/year OK', { parsedYear1, parsedYear2 });
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('[API][ERR] /search/year', err);
    return res.status(500).json({ success: false, error: '검색 나이 업데이트 실패' });
  }
});

// ────────────────────────────────────────────────────────────
/** 2) 검색 지역 (다중)
// - 요청 바디 정규화 후 배열 저장
*/
// ────────────────────────────────────────────────────────────
const normalizeRegions = (body) => {
  // 1) 권장 케이스: regions 배열
  if (Array.isArray(body?.regions)) {
    return body.regions
      .filter((r) => r && typeof r === 'object')
      .map((r) => ({ region1: s(r.region1) || '', region2: s(r.region2) || '' }))
      .filter((r) => r.region1 !== '' && r.region2 !== '');
  }
  // 2) 단일 호환: {region1, region2}
  if (body && typeof body === 'object' && (body.region1 || body.region2)) {
    const r1 = s(body.region1) || '';
    const r2 = s(body.region2) || '';
    return r1 && r2 ? [{ region1: r1, region2: r2 }] : [];
  }
  // 3) 그 외는 빈 배열
  return [];
};

async function upsertRegions(req, res) {
  const userId = getMyId(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const normalized = normalizeRegions(req.body || {});
  const first = normalized[0] || { region1: '', region2: '' };

  console.log('[API][REQ] REGIONS', req.method, req.path, {
    userId,
    count: normalized.length,
    first,
  });

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        search_regions: normalized,
        // 구버전 호환을 위해 대표값 동기화(원치 않으면 제거 가능)
        search_region1: first.region1,
        search_region2: first.region2,
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    console.log('[API][RES] REGIONS OK', { count: normalized.length });
    return res.json({ success: true, count: normalized.length, user: updated });
  } catch (err) {
    console.error('[API][ERR] REGIONS SAVE', err);
    return res.status(500).json({ success: false, error: '검색 지역 저장 실패' });
  }
}

router.patch('/search/regions', requireLogin, upsertRegions);
router.put('/search/regions', requireLogin, upsertRegions);

// ────────────────────────────────────────────────────────────
// 3) 검색 특징
// ────────────────────────────────────────────────────────────
router.patch('/search/preference', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  const { preference } = req.body || {};

  console.log('[API][REQ] PATCH /search/preference', { userId, preference });

  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_preference: s(preference) || '' },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    console.log('[API][RES] /search/preference OK');
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('[API][ERR] /search/preference', err);
    return res.status(500).json({ success: false, error: '검색 특징 업데이트 실패' });
  }
});

// ────────────────────────────────────────────────────────────
// 4) 다중 지역 조건으로 사용자 검색
//    (현재는 인증 필요하도록 유지)
// ────────────────────────────────────────────────────────────
router.post('/search/users', requireLogin, async (req, res) => {
  try {
    const { regions } = req.body;
    console.log('[API][REQ] POST /search/users - 검색 조건:', regions);

    // 전체/빈 조건
    if (
      !regions ||
      regions.length === 0 ||
      regions.some((r) => r.region1 === '전체')
    ) {
      const allUsers = await User.find({});
      console.log(`[API][RES] /search/users 전체 조회: ${allUsers.length}명`);
      return res.json(allUsers);
    }

    const orConditions = regions.map(({ region1, region2 }) => {
      if (region2 === '전체') return { region1 };
      return { region1, region2 };
    });

    const users = await User.find({ $or: orConditions });
    console.log(`[API][RES] /search/users 조건 일치: ${users.length}명`);
    return res.json(users);
  } catch (err) {
    console.error('[API][ERR] /search/users', err);
    return res.status(500).json({ success: false, error: '사용자 검색 실패' });
  }
});

module.exports = router;
