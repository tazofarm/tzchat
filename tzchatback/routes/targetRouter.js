const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용
const bcrypt = require('bcrypt'); // ✅ [추가] 비밀번호 해시/검증용 (아래에서 사용함)
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ✅ 누락된 import 추가
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const requireLogin = require('../middlewares/authMiddleware');
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');
const router = express.Router();


// 공통 유틸
const s = v => (typeof v === 'string' ? v.trim() : v ?? '');

// ────────────────────────────────────────────────────────────
// 1) 검색 나이 (year1/year2) : 그대로 유지
// ────────────────────────────────────────────────────────────
router.patch('/search/year', requireLogin, async (req, res) => {
  const userId = req.session.user?._id;
  let { year1, year2 } = req.body || {};

  console.log('📥 [PATCH] /search/year', { userId, year1, year2 });

  const parsedYear1 = (year1 === '' || year1 === '전체') ? null : s(year1);
  const parsedYear2 = (year2 === '' || year2 === '전체') ? null : s(year2);

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_birthyear1: parsedYear1, search_birthyear2: parsedYear2 },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    console.log('✅ 검색 나이 업데이트 완료:', { parsedYear1, parsedYear2 });
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('❌ 검색 나이 업데이트 실패:', err);
    return res.status(500).json({ success: false, error: '검색 나이 업데이트 실패' });
  }
});

// ────────────────────────────────────────────────────────────
/** 2) 검색 지역 (다중만 유지)
/*
 * POST/PATCH 모두 허용 가능하지만 보통 PATCH 권장
 * 요청 바디를 유연하게 받아서 배열로 정규화:
 *  - 권장: { regions: [{region1, region2}, ...] }
 *  - 단일 호환: { region1, region2 }
 *  - 빈/전체: [] 로 저장
 * 저장 대상:
 *  - search_regions: [{region1, region2}, ...]
 *  - (선택) 첫 항목을 search_region1/2에 동기화(구 UI/쿼리 호환)
 */
// ────────────────────────────────────────────────────────────
const normalizeRegions = (body) => {
  // 1) 권장 케이스: regions 배열
  if (Array.isArray(body?.regions)) {
    return body.regions
      .filter(r => r && typeof r === 'object')
      .map(r => ({ region1: s(r.region1) || '', region2: s(r.region2) || '' }))
      .filter(r => r.region1 !== '' && r.region2 !== '');
  }
  // 2) 단일 호환: {region1, region2}
  if (body && typeof body === 'object' && (body.region1 || body.region2)) {
    const r1 = s(body.region1) || '';
    const r2 = s(body.region2) || '';
    return (r1 && r2) ? [{ region1: r1, region2: r2 }] : [];
  }
  // 3) 그 외는 빈 배열
  return [];
};

async function upsertRegions(req, res) {
  const userId = req.session.user?._id;
  const normalized = normalizeRegions(req.body || {});
  const first = normalized[0] || { region1: '', region2: '' };

  console.log('📥 [REGIONS]', req.method, req.path, { userId, count: normalized.length, first });

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        search_regions: normalized,
        // ↙︎ 단일 필드는 선택: 구 버전이 아직 보이면 동기화 유지(원치 않으면 제거 가능)
        search_region1: first.region1,
        search_region2: first.region2,
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    console.log('✅ 검색 지역 저장 완료:', { count: normalized.length });
    return res.json({ success: true, count: normalized.length, user: updated });
  } catch (err) {
    console.error('❌ 검색 지역 저장 실패:', err);
    return res.status(500).json({ success: false, error: '검색 지역 저장 실패' });
  }
}

router.patch('/search/regions', requireLogin, upsertRegions);
// 원하면 PUT도 허용
router.put('/search/regions', requireLogin, upsertRegions);

// ────────────────────────────────────────────────────────────
// 3) 검색 특징: 그대로 유지
// ────────────────────────────────────────────────────────────
router.patch('/search/preference', requireLogin, async (req, res) => {
  const userId = req.session.user?._id;
  const { preference } = req.body || {};

  console.log('📥 [PATCH] /search/preference', { userId, preference });

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_preference: s(preference) || '' },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    console.log('✅ 검색 특징 업데이트 완료');
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('❌ 검색 특징 업데이트 실패:', err);
    return res.status(500).json({ success: false, error: '검색 특징 업데이트 실패' });
  }
});

// ────────────────────────────────────────────────────────────
// 4) 다중 지역 조건으로 사용자 검색: 그대로 유지
// ────────────────────────────────────────────────────────────
router.post('/search/users', requireLogin, async (req, res) => {
  try {
    const { regions } = req.body;
    console.log('📥 [POST] /search/users - 검색 조건:', regions);

    // 전체/빈 조건
    if (!regions || regions.length === 0 || regions.some(r => r.region1 === '전체')) {
      const allUsers = await User.find({});
      console.log(`🔍 전체 사용자 조회: ${allUsers.length}명`);
      return res.json(allUsers);
    }

    const orConditions = regions.map(({ region1, region2 }) => {
      if (region2 === '전체') return { region1 };
      return { region1, region2 };
    });

    const users = await User.find({ $or: orConditions });
    console.log(`🔍 조건 일치 사용자 수: ${users.length}명`);
    return res.json(users);
  } catch (err) {
    console.error('❌ [검색 사용자 조회 오류]', err);
    return res.status(500).json({ success: false, error: '사용자 검색 실패' });
  }
});


module.exports = router;
