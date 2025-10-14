// routes/search/targetRouter.js
// base: /api
// -------------------------------------------------------------
// 🔎 검색/타겟팅 라우터 (등급 규칙 가드 적용)
// -------------------------------------------------------------
const express = require('express');
const { User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

// 🔹 등급 규칙 가드
const { sanitizeSearchSettings } = require('@/middlewares/levelGuard');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

// 공통: 내 사용자 ID/레벨
function getMyId(req) {
  const jwtId = req?.user?._id || req?.user?.sub;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}
function getMyLevel(req) {
  return req?.user?.user_level || req?.session?.user?.user_level || '일반회원';
}

// 공통 유틸
const s = (v) => (typeof v === 'string' ? v.trim() : v ?? '');
const toNullOrInt = (v) => {
  const str = String(v ?? '').trim();
  if (str === '' || str === '전체') return null;
  const n = parseInt(str, 10);
  return Number.isFinite(n) ? n : null;
};

/** 라우터 로깅 */
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
    const size =
      typeof body === 'string' ? body.length : Buffer.byteLength(JSON.stringify(body || {}));
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

// 1) 검색 나이
router.patch('/search/year', async (req, res) => {
  const userId = getMyId(req);
  let { year1, year2 } = req.body || {};
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const parsedYear1 = toNullOrInt(year1);
  const parsedYear2 = toNullOrInt(year2);

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_birthyear1: parsedYear1, search_birthyear2: parsedYear2 },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ success: false, error: '검색 나이 업데이트 실패' });
  }
});

// 2) 검색 지역 (다중)
const normalizeRegions = (body) => {
  if (Array.isArray(body?.regions)) {
    return body.regions
      .filter((r) => r && typeof r === 'object')
      .map((r) => ({ region1: s(r.region1) || '', region2: s(r.region2) || '' }))
      .filter((r) => r.region1 !== '' && r.region2 !== '');
  }
  if (body && typeof body === 'object' && (body.region1 || body.region2)) {
    const r1 = s(body.region1) || '';
    const r2 = s(body.region2) || '';
    return r1 && r2 ? [{ region1: r1, region2: r2 }] : [];
  }
  return [];
};

async function upsertRegions(req, res) {
  const userId = getMyId(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const normalized = normalizeRegions(req.body || {});
  const first = normalized[0] || { region1: '', region2: '' };

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        search_regions: normalized,
        search_region1: first.region1,
        search_region2: first.region2,
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, count: normalized.length, user: updated });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ success: false, error: '검색 지역 저장 실패' });
  }
}
router.patch('/search/regions', upsertRegions);
router.put('/search/regions', upsertRegions);

// 3) 검색 특징 (등급에 따라 allOnly 보정)
router.patch('/search/preference', async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  try {
    // 등급 규칙에 따라 보정
    const safe = sanitizeSearchSettings(level, { search_preference: s(req.body?.preference) || '' });
    const value = safe.search_preference ?? '이성친구 - 전체';

    const updated = await User.findByIdAndUpdate(
      userId,
      { search_preference: value },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ success: false, error: '검색 특징 업데이트 실패' });
  }
});

// 4) 사용자 검색 (기존 로직 유지)  — 생략: 그대로 둠
const USER_FIELDS =
  'username nickname birthyear gender marriage search_marriage region1 region2 ' +
  'preference search_preference selfintro ' +
  'last_login updatedAt createdAt ' +
  'profileMain profileImages profileImage avatar photo ' +
  'search_onlyWithPhoto search_allowFriendRequests search_matchPremiumOnly';

function shapeUsers(list) {
  const toOnOff = (v) => (String(v ?? 'OFF').toUpperCase() === 'ON' ? 'ON' : 'OFF');
  return list.map((u) => ({
    ...u,
    selfintro: u.selfintro ?? u.selfIntro ?? '',
    search_allowFriendRequests: toOnOff(u.search_allowFriendRequests),
    search_onlyWithPhoto: toOnOff(u.search_onlyWithPhoto),
    search_matchPremiumOnly: toOnOff(u.search_matchPremiumOnly),
    preference: u.preference ?? '',
    search_preference: u.search_preference ?? '',
    marriage: u.marriage ?? '',
    search_marriage: u.search_marriage ?? '전체',
  }));
}

router.post('/search/users', async (req, res) => {
  try {
    const myId = getMyId(req);
    const me = await User.findById(myId)
      .select('phoneHash localContactHashes search_disconnectLocalContacts')
      .lean();

    const raw = Array.isArray(req.body?.regions) ? req.body.regions : [];
    const regions = raw
      .filter((r) => r && (r.region1 || r.region2))
      .map((r) => ({ region1: s(r.region1), region2: s(r.region2) }));

    const isAll =
      regions.length === 0 ||
      regions.some((r) => r.region1 === '전체') ||
      regions.some((r) => r.region2 === '전체');

    const andFilters = [{ _id: { $ne: myId } }];
    if (me?.phoneHash) andFilters.push({ phoneHash: { $ne: me.phoneHash } });

    const disconnectOn = String(me?.search_disconnectLocalContacts || '').toUpperCase() === 'ON';
    const contactHashes = Array.isArray(me?.localContactHashes) ? me.localContactHashes : [];
    if (disconnectOn && contactHashes.length) {
      andFilters.push({ phoneHash: { $nin: contactHashes } });
    }

    if (!isAll) {
      const orConditions = regions.map(({ region1, region2 }) =>
        !region2 || region2 === '전체' ? { region1 } : { region1, region2 }
      );
      andFilters.push({ $or: orConditions });
    }

    const finalQuery = andFilters.length ? { $and: andFilters } : {};
    const users = await User.find(finalQuery).select(USER_FIELDS).lean();

    return res.json(shapeUsers(users));
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ success: false, error: '사용자 검색 실패' });
  }
});

// 5) 스위치 일괄 저장 (등급 보정: offOnly 항목 강제 OFF)
const isOnOff = (v) => typeof v === 'string' && ['ON', 'OFF'].includes(String(v).toUpperCase());
const normOnOff = (v) => (String(v || '').toUpperCase() === 'ON' ? 'ON' : 'OFF');

router.patch('/search/settings', async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);
  if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

  let {
    disconnectLocalContacts,
    allowFriendRequests,
    allowNotifications,
    onlyWithPhoto,
    matchPremiumOnly,
  } = req.body || {};

  // 등급 규칙으로 보정 (offOnly → 강제 OFF)
  const safe = sanitizeSearchSettings(level, {
    search_onlyWithPhoto: onlyWithPhoto,
    search_matchPremiumOnly: matchPremiumOnly,
  });
  if ('search_onlyWithPhoto' in safe)    onlyWithPhoto    = safe.search_onlyWithPhoto;
  if ('search_matchPremiumOnly' in safe) matchPremiumOnly = safe.search_matchPremiumOnly;

  const update = {};
  if (disconnectLocalContacts !== undefined) {
    if (!isOnOff(disconnectLocalContacts))
      return res.status(400).json({ error: 'disconnectLocalContacts must be ON/OFF' });
    update.search_disconnectLocalContacts = normOnOff(disconnectLocalContacts);
  }
  if (allowFriendRequests !== undefined) {
    if (!isOnOff(allowFriendRequests))
      return res.status(400).json({ error: 'allowFriendRequests must be ON/OFF' });
    update.search_allowFriendRequests = normOnOff(allowFriendRequests);
  }
  if (allowNotifications !== undefined) {
    if (!isOnOff(allowNotifications))
      return res.status(400).json({ error: 'allowNotifications must be ON/OFF' });
    update.search_allowNotifications = normOnOff(allowNotifications);
  }
  if (onlyWithPhoto !== undefined) {
    if (!isOnOff(onlyWithPhoto))
      return res.status(400).json({ error: 'onlyWithPhoto must be ON/OFF' });
    update.search_onlyWithPhoto = normOnOff(onlyWithPhoto);
  }
  if (matchPremiumOnly !== undefined) {
    if (!isOnOff(matchPremiumOnly))
      return res.status(400).json({ error: 'matchPremiumOnly must be ON/OFF' });
    update.search_matchPremiumOnly = normOnOff(matchPremiumOnly);
  }

  try {
    const updated = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select(
        'search_disconnectLocalContacts search_allowFriendRequests search_allowNotifications search_onlyWithPhoto search_matchPremiumOnly'
      )
      .lean();

    if (!updated) return res.status(404).json({ error: '사용자 없음' });
    return res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('[PATCH /search/settings] error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// 6) 검색 결혼유무 (등급에 따라 allOnly 보정)
router.patch('/search/marriage', async (req, res) => {
  const userId = getMyId(req);
  const level  = getMyLevel(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  let raw = s(req.body?.marriage);
  // 등급 보정: 일반/여성은 '전체'로 강제
  const safe = sanitizeSearchSettings(level, { search_marriage: raw });
  raw = safe.search_marriage || '전체';

  const ALLOWED = ['전체', '미혼', '기혼', '돌싱'];
  if (!ALLOWED.includes(raw)) {
    return res.status(400).json({ success: false, error: 'marriage must be one of 전체/미혼/기혼/돌싱' });
  }

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_marriage: raw },
      { new: true }
    )
      .select('search_marriage updatedAt')
      .lean();

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    return res.json({ success: true, search_marriage: updated.search_marriage, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('[API][ERR] /search/marriage', { message: err?.message });
    return res.status(500).json({ success: false, error: '검색 결혼유무 업데이트 실패' });
  }
});

module.exports = router;
