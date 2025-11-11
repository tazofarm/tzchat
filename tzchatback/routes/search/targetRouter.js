// routes/search/targetRouter.js
// base: /api
// -------------------------------------------------------------
// 🔎 검색/추천 질의 전용 라우터 (로그인 가드)
// - POST /api/search/users     : 조건 검색
// - GET  /api/search/targets   : 추천 후보(원천 리스트)
// -------------------------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
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
const parseCommaIds = (sval) =>
  String(sval ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

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
   1) 사용자 검색 (간단 필터)
   payload: {
     regions: [{region1, region2}, ...]   // 선택적
   }
========================= */
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

router.post('/search/users', async (req, res, next) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

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
    next(err);
  }
});

/* =========================
   2) 추천 후보(원천 리스트)
   GET /api/search/targets?limit=50&exclude=comma,ids&seedDay=YYYY-MM-DD
========================= */
router.get('/search/targets', async (req, res, next) => {
  try {
    const viewerId = getMyId(req);
    if (!viewerId) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const excludeSet = new Set(parseCommaIds(req.query.exclude));

    const dayjs = require('dayjs');
    const tz = require('dayjs/plugin/timezone');
    const utc = require('dayjs/plugin/utc');
    dayjs.extend(utc); dayjs.extend(tz);

    const ymd = s(req.query.seedDay) || dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');

    // 모델은 글로벌로 등록되어 있어야 함(models/index.js)
    const UserDailyScore = mongoose.model('UserDailyScore');

    const scoreDocs = await UserDailyScore.find({ ymd })
      .sort({ exposureScore: -1, updatedAt: -1 })
      .limit(limit * 3)
      .lean();

    const candidateIds = [];
    for (const d of scoreDocs) {
      const uid = String(d.user);
      if (uid === viewerId) continue;
      if (excludeSet.has(uid)) continue;
      candidateIds.push(d.user);
      if (candidateIds.length >= limit * 2) break;
    }

    const users = await User.find(
      { _id: { $in: candidateIds }, isDeleted: { $ne: true }, isPrivate: { $ne: true } }
    )
      .select(
        '_id username nickname birthyear gender level region1 region2 ' +
        'profileMain profileImages profileImage avatar photo ' +
        'createdAt updatedAt'
      )
      .lean();

    return res.json({ ok: true, ymd, total: users.length, users });
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
  console.error('[search/queryRouter]', status, msg, err.stack);
  res.status(status).json({ ok: false, error: msg });
});

module.exports = router;
