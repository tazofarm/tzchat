// routes/search/targetRouter.js
// base: /api
// -------------------------------------------------------------
// 🔎 검색/타겟팅 라우터
// -------------------------------------------------------------
const express = require('express');

// models/index.js 가 모든 모델을 export 한다는 가정
const { User } = require('@/models');

const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();

// 로그인 + 탈퇴유예 전역 차단
router.use(requireLogin, blockIfPendingDeletion);

// ────────────────────────────────────────────────────────────
// 공통: 내 사용자 ID 추출 (JWT 우선, 세션 백업)
// ────────────────────────────────────────────────────────────
function getMyId(req) {
  const jwtId = req?.user?._id || req?.user?.sub;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}

// 공통 유틸
const s = (v) => (typeof v === 'string' ? v.trim() : v ?? '');
// 연령 입력을 Number 또는 null로 강제
const toNullOrInt = (v) => {
  const str = String(v ?? '').trim();
  if (str === '' || str === '전체') return null;
  const n = parseInt(str, 10);
  return Number.isFinite(n) ? n : null;
};

// ────────────────────────────────────────────────────────────
/** ✅ 라우터 전용 요청/응답 로깅 */
// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
// 1) 검색 나이 (year1/year2)
// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
// 2) 검색 지역 (다중) - 요청 바디 정규화 후 배열 저장
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
    return res.json({ success: true, count: normalized.length, user: updated });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ success: false, error: '검색 지역 저장 실패' });
  }
}

router.patch('/search/regions', upsertRegions);
router.put('/search/regions', upsertRegions);

// ────────────────────────────────────────────────────────────
// 3) 검색 특징
// ────────────────────────────────────────────────────────────
router.patch('/search/preference', async (req, res) => {
  const userId = getMyId(req);
  const { preference } = req.body || {};

  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_preference: s(preference) || '' },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ success: false, error: '검색 특징 업데이트 실패' });
  }
});

// ────────────────────────────────────────────────────────────
// 4) 다중 지역 조건으로 사용자 검색 (+ 자기/연락처 제외)
// ────────────────────────────────────────────────────────────
const USER_FIELDS =
  'username nickname birthyear gender region1 region2 preference selfintro last_login updatedAt createdAt';

// 서버에서 응답 직전에 selfintro 표준화(둘 중 하나라도 채워서 내려줌)
function shapeUsers(list) {
  return list.map((u) => ({
    ...u,
    selfintro: u.selfintro ?? u.selfIntro ?? '',
  }));
}

router.post('/search/users', async (req, res) => {
  try {
    const myId = getMyId(req);
    // me: 필터링에 필요한 최소 필드
    const me = await User.findById(myId)
      .select('phoneHash localContactHashes search_disconnectLocalContacts')
      .lean();

    // 안전 정규화 (지역)
    const raw = Array.isArray(req.body?.regions) ? req.body.regions : [];
    const regions = raw
      .filter((r) => r && (r.region1 || r.region2))
      .map((r) => ({ region1: s(r.region1), region2: s(r.region2) }));

    const isAll =
      regions.length === 0 ||
      regions.some((r) => r.region1 === '전체') ||
      regions.some((r) => r.region2 === '전체');

    // ── 기본 제외 조건: 항상 '나' 제외 + 내 번호 제외
    const andFilters = [{ _id: { $ne: myId } }];
    if (me?.phoneHash) {
      andFilters.push({ phoneHash: { $ne: me.phoneHash } });
    }

    // 스위치가 ON일 때만: 내 연락처 해시 제외
    const disconnectOn = String(me?.search_disconnectLocalContacts || '').toUpperCase() === 'ON';
    const contactHashes = Array.isArray(me?.localContactHashes) ? me.localContactHashes : [];
    if (disconnectOn && contactHashes.length) {
      andFilters.push({ phoneHash: { $nin: contactHashes } });
    }

    // 지역 조건 결합
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

// ────────────────────────────────────────────────────────────
/** 5) ✅ 스위치 일괄 저장 — "ON"/"OFF" 문자열로 DB 반영 */
// ────────────────────────────────────────────────────────────
const isOnOff = (v) => typeof v === 'string' && ['ON', 'OFF'].includes(String(v).toUpperCase());
const normOnOff = (v) => (String(v || '').toUpperCase() === 'ON' ? 'ON' : 'OFF');

router.patch('/search/settings', async (req, res) => {
  const userId = getMyId(req);
  if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const {
    disconnectLocalContacts,
    allowFriendRequests,
    allowNotifications,
    onlyWithPhoto,
    matchPremiumOnly,
  } = req.body || {};

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

// ────────────────────────────────────────────────────────────
/** 6) ✅ 결혼유무 변경 (내 프로필)
 *    Body: { marriage: "미혼"|"기혼"|"돌싱" }
 */
router.patch('/user/marriage', async (req, res) => {
  const userId = getMyId(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const raw = s(req.body?.marriage);
  const ALLOWED = ['미혼', '기혼', '돌싱'];
  if (!ALLOWED.includes(raw)) {
    return res.status(400).json({ success: false, error: 'marriage must be one of 미혼/기혼/돌싱' });
  }

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { marriage: raw },
      { new: true }
    )
      .select('marriage updatedAt')
      .lean();

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });

    return res.json({ success: true, marriage: updated.marriage, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('[API][ERR] /user/marriage', { message: err?.message });
    return res.status(500).json({ success: false, error: '결혼유무 업데이트 실패' });
  }
});

// ────────────────────────────────────────────────────────────
/** 7) ✅ 검색 결혼유무 변경 (상대 조건)
 *    Body: { marriage: "전체"|"미혼"|"기혼"|"돌싱" }
 */
router.patch('/search/marriage', async (req, res) => {
  const userId = getMyId(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const raw = s(req.body?.marriage);
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

// ────────────────────────────────────────────────────────────
// 8) ✅ 연락처 해시 저장/삭제 (OFF→ON 업로드, ON→OFF 삭제)
//    - POST /api/contacts/hashes  { hashes: string[] }
//    - DELETE /api/contacts/hashes
// ────────────────────────────────────────────────────────────
router.post('/contacts/hashes', async (req, res) => {
  const userId = getMyId(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  const hashes = Array.isArray(req.body?.hashes) ? req.body.hashes.filter(Boolean) : [];
  // 문자열만 허용
  const cleaned = Array.from(new Set(hashes.map(String)));

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { localContactHashes: cleaned } }, // 교체 저장
      { new: true }
    ).select('localContactHashes updatedAt');

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, count: updated.localContactHashes.length, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('[API][ERR] /contacts/hashes (POST)', { message: err?.message });
    return res.status(500).json({ success: false, error: '연락처 저장 실패' });
  }
});

router.delete('/contacts/hashes', async (req, res) => {
  const userId = getMyId(req);
  if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { localContactHashes: [] } },
      { new: true }
    ).select('updatedAt');

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' });
    return res.json({ success: true, deleted: true, updatedAt: updated.updatedAt });
  } catch (err) {
    console.error('[API][ERR] /contacts/hashes (DELETE)', { message: err?.message });
    return res.status(500).json({ success: false, error: '연락처 삭제 실패' });
  }
});

module.exports = router;
