// routes/search/searchingRouter.js
// base: /api
// -------------------------------------------------------------
// 🔧 검색 설정 전용 라우터 (로그인 가드 / 등급 가드 제거: 값 그대로 저장)
// - PATCH /api/search/year
// - PATCH /api/search/regions
// - PATCH /api/search/preference
// - PATCH /api/search/settings
// - PATCH /api/search/marriage
// -------------------------------------------------------------
const express = require('express');
const { User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

/* =========================
   공통 유틸
========================= */
function getMyId(req) {
  const jwtId = req?.user?._id || req?.user?.sub;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}
const s = (v) => (typeof v === 'string' ? v.trim() : v ?? '');
const toNullOrInt = (v) => {
  const str = String(v ?? '').trim();
  if (str === '' || str === '전체') return null;
  const n = parseInt(str, 10);
  return Number.isFinite(n) ? n : null;
};
const isOnOff = (v) => typeof v === 'string' && ['ON', 'OFF'].includes(String(v).toUpperCase());
const normOnOff = (v, fallback = 'OFF') => {
  const up = String(v || '').toUpperCase();
  if (up === 'ON' || up === 'OFF') return up;
  return fallback;
};

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
   1) 검색 나이(출생년도 범위) 저장
   payload: { year1, year2 }  // 숫자 또는 '전체'
========================= */
router.patch('/search/year', async (req, res, next) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

    let { year1, year2 } = req.body || {};
    const parsedYear1 = toNullOrInt(year1);
    const parsedYear2 = toNullOrInt(year2);

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { search_birthyear1: parsedYear1, search_birthyear2: parsedYear2 } },
      { new: true }
    ).select('search_birthyear1 search_birthyear2');

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
});

/* =========================
   2) 검색 지역 저장 (다중)
   payload:
     { regions: [{region1, region2}, ...] }
   - 대표 1개는 search_region1/2 에도 세팅
   - snake/camel 둘 다 유지: search_regions, searchRegions
========================= */
function normalizeRegions(body) {
  if (Array.isArray(body?.regions)) {
    const arr = body.regions
      .filter((r) => r && typeof r === 'object')
      .map((r) => ({ region1: s(r.region1) || '', region2: s(r.region2) || '' }))
      .filter((r) => r.region1 !== '' && r.region2 !== '');
    if (arr.some((r) => r.region1 === '전체' && r.region2 === '전체')) {
      return [{ region1: '전체', region2: '전체' }];
    }
    return arr;
  }
  if (body && typeof body === 'object' && (body.region1 || body.region2)) {
    const r1 = s(body.region1) || '';
    const r2 = s(body.region2) || '';
    if (r1 && r2) return [{ region1: r1, region2: r2 }];
  }
  return [];
}

async function upsertRegions(req, res, next) {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

    const normalized = normalizeRegions(req.body || {});
    const first = normalized[0] || { region1: '', region2: '' };

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          search_regions: normalized,
          searchRegions: normalized,
          search_region1: first.region1,
          search_region2: first.region2,
        }
      },
      { new: true }
    ).select('search_regions search_region1 search_region2');

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, count: normalized.length, user: updated });
  } catch (err) {
    next(err);
  }
}
router.patch('/search/regions', upsertRegions);
router.put('/search/regions', upsertRegions);

/* =========================
   3) 검색 특징 저장
   payload: { preference: string }
========================= */
router.patch('/search/preference', async (req, res, next) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

    const value = s(req.body?.preference) || '';
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { search_preference: value } },
      { new: true }
    ).select('search_preference');

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
});

/* =========================
   4) 스위치 일괄 저장
   payload: {
     disconnectLocalContacts: 'ON'|'OFF',
     allowFriendRequests:     'ON'|'OFF',
     allowNotifications:      'ON'|'OFF',
     onlyWithPhoto:           'ON'|'OFF',
     matchPremiumOnly:        'ON'|'OFF',
   }
========================= */
router.patch('/search/settings', async (req, res, next) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

    let {
      disconnectLocalContacts,
      allowFriendRequests,
      allowNotifications,
      onlyWithPhoto,
      matchPremiumOnly,
    } = req.body || {};

    const update = {};
    if (disconnectLocalContacts !== undefined) {
      if (!isOnOff(disconnectLocalContacts)) return res.status(400).json({ error: 'disconnectLocalContacts must be ON/OFF' });
      update.search_disconnectLocalContacts = normOnOff(disconnectLocalContacts);
    }
    if (allowFriendRequests !== undefined) {
      if (!isOnOff(allowFriendRequests)) return res.status(400).json({ error: 'allowFriendRequests must be ON/OFF' });
      update.search_allowFriendRequests = normOnOff(allowFriendRequests);
    }
    if (allowNotifications !== undefined) {
      if (!isOnOff(allowNotifications)) return res.status(400).json({ error: 'allowNotifications must be ON/OFF' });
      update.search_allowNotifications = normOnOff(allowNotifications);
    }
    if (onlyWithPhoto !== undefined) {
      if (!isOnOff(onlyWithPhoto)) return res.status(400).json({ error: 'onlyWithPhoto must be ON/OFF' });
      update.search_onlyWithPhoto = normOnOff(onlyWithPhoto);
    }
    if (matchPremiumOnly !== undefined) {
      if (!isOnOff(matchPremiumOnly)) return res.status(400).json({ error: 'matchPremiumOnly must be ON/OFF' });
      update.search_matchPremiumOnly = normOnOff(matchPremiumOnly);
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true }
    )
      .select(
        'search_disconnectLocalContacts search_allowFriendRequests search_allowNotifications search_onlyWithPhoto search_matchPremiumOnly'
      )
      .lean();

    if (!updated) return res.status(404).json({ error: '사용자 없음' });
    return res.json({ ok: true, user: updated });
  } catch (err) {
    next(err);
  }
});

/* =========================
   5) 검색 결혼유무 저장
   payload: { marriage: '전체'|'미혼'|'기혼'|'돌싱' }
========================= */
router.patch('/search/marriage', async (req, res, next) => {
  try {
    const userId = getMyId(req);
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

    let raw = s(req.body?.marriage);
    const ALLOWED = ['전체', '미혼', '기혼', '돌싱'];
    if (!ALLOWED.includes(raw)) {
      return res.status(400).json({ success: false, error: 'marriage must be one of 전체/미혼/기혼/돌싱' });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { search_marriage: raw } },
      { new: true }
    ).select('search_marriage updatedAt').lean();

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, search_marriage: updated.search_marriage, updatedAt: updated.updatedAt });
  } catch (err) {
    next(err);
  }
});

/* =========================
   파일 전용 에러 핸들러
========================= */
router.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const msg = err.message || 'Internal Server Error';
  console.error('[search/settingsRouter]', status, msg, err.stack);
  res.status(status).json({ ok: false, error: msg });
});

module.exports = router;
