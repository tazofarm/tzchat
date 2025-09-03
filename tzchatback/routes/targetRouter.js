const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용
const bcrypt = require('bcrypt'); // ✅ [추가] 비밀번호 해시/검증용 (아래에서 사용함)
const jwt = require('jsonwebtoken'); // ✅ JWT 하이브리드 인증용
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ✅ 누락된 import 추가
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const requireLogin = require('../middlewares/authMiddleware'); // (하위호환 import 유지, 미사용)
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');
const router = express.Router();

// ────────────────────────────────────────────────────────────
// 인증 유틸(세션 → JWT 순서) — Web(App)/쿠키/Bearer 병행 지원
// ────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

function log(...args) {
  try { console.log('[targetRouter]', ...args); } catch (_) {}
}
function logErr(...args) {
  try { console.error('[targetRouter][ERR]', ...args); } catch (_) {}
}

function extractJwtFromReq(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);

  // 2) Cookie
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader.includes(`${JWT_COOKIE_NAME}=`)) {
    try {
      const target = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith(`${JWT_COOKIE_NAME}=`));
      if (target) return decodeURIComponent(target.split('=')[1]);
    } catch (e) {
      logErr('쿠키 파싱 실패', e?.message);
    }
  }
  return null;
}

function getUserIdFromSession(req) {
  return req.session?.user?._id ? String(req.session.user._id) : '';
}

function getUserIdFromJwt(req) {
  const token = extractJwtFromReq(req);
  if (!token) return '';
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.sub ? String(decoded.sub) : '';
  } catch (e) {
    logErr('JWT 검증 실패', e?.message);
    return '';
  }
}

function requireAuth(req, res, next) {
  const sid = getUserIdFromSession(req);
  if (sid) {
    req._uid = sid;
    log('[AUTH] 세션 인증', { userId: sid, path: req.method + ' ' + req.path });
    return next();
  }
  const jid = getUserIdFromJwt(req);
  if (jid) {
    req._uid = jid;
    log('[AUTH] JWT 인증', { userId: jid, path: req.method + ' ' + req.path });
    return next();
  }
  logErr('인증 실패', { path: req.method + ' ' + req.path });
  return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
}

// 공통 유틸
const s = v => (typeof v === 'string' ? v.trim() : v ?? '');

// ────────────────────────────────────────────────────────────
// 1) 검색 나이 (year1/year2) : 그대로 유지 + 인증 전환
// ────────────────────────────────────────────────────────────
router.patch('/search/year', requireAuth, async (req, res) => {
  const userId = req._uid;
  let { year1, year2 } = req.body || {};

  console.log('[API][REQ] PATCH /search/year', { userId, year1, year2 });

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
/** 2) 검색 지역 (다중만 유지)
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
  const userId = req._uid;
  const normalized = normalizeRegions(req.body || {});
  const first = normalized[0] || { region1: '', region2: '' };

  console.log('[API][REQ] REGIONS', req.method, req.path, { userId, count: normalized.length, first });

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

    console.log('[API][RES] REGIONS OK', { count: normalized.length });
    return res.json({ success: true, count: normalized.length, user: updated });
  } catch (err) {
    console.error('[API][ERR] REGIONS SAVE', err);
    return res.status(500).json({ success: false, error: '검색 지역 저장 실패' });
  }
}

router.patch('/search/regions', requireAuth, upsertRegions);
// 원하면 PUT도 허용
router.put('/search/regions', requireAuth, upsertRegions);

// ────────────────────────────────────────────────────────────
// 3) 검색 특징: 그대로 유지 + 인증 전환
// ────────────────────────────────────────────────────────────
router.patch('/search/preference', requireAuth, async (req, res) => {
  const userId = req._uid;
  const { preference } = req.body || {};

  console.log('[API][REQ] PATCH /search/preference', { userId, preference });

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
// 4) 다중 지역 조건으로 사용자 검색: 그대로 유지 (공개/비공개 정책에 따라 보호 필요 시 requireAuth로 변경 가능)
// ────────────────────────────────────────────────────────────
router.post('/search/users', requireAuth, async (req, res) => {
  try {
    const { regions } = req.body;
    console.log('[API][REQ] POST /search/users - 검색 조건:', regions);

    // 전체/빈 조건
    if (!regions || regions.length === 0 || regions.some(r => r.region1 === '전체')) {
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
