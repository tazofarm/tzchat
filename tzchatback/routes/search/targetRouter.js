// routes/search/targetRouter.js
// base: /api
// -------------------------------------------------------------
// 🔎 검색/타겟팅 라우터 (로그인 가드 적용 / 등급 가드 제거: 값 그대로 저장)
// - 프론트 6_profile.vue가 호출하는 엔드포인트 일괄 처리
//   PATCH /api/search/settings
//   PATCH /api/search/year
//   PATCH /api/search/regions
//   PATCH /api/search/preference
//   PATCH /api/search/marriage
//   POST  /api/search/users
//   GET   /api/search/targets   ← 신규: 추천 후보(원천 리스트) 제공
// -------------------------------------------------------------
const express = require('express')
const mongoose = require('mongoose')
const { User } = require('@/models')
const requireLogin = require('@/middlewares/authMiddleware')
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion')

const router = express.Router()
router.use(requireLogin, blockIfPendingDeletion)

/* =========================
   공통 유틸
========================= */
function getMyId(req) {
  const jwtId = req?.user?._id || req?.user?.sub
  const sessId = req?.session?.user?._id
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || ''
}
const s = (v) => (typeof v === 'string' ? v.trim() : v ?? '')
const toNullOrInt = (v) => {
  const str = String(v ?? '').trim()
  if (str === '' || str === '전체') return null
  const n = parseInt(str, 10)
  return Number.isFinite(n) ? n : null
}
const isOnOff = (v) => typeof v === 'string' && ['ON', 'OFF'].includes(String(v).toUpperCase())
const normOnOff = (v, fallback = 'OFF') => {
  const up = String(v || '').toUpperCase()
  if (up === 'ON' || up === 'OFF') return up
  return fallback
}
const parseCommaIds = (sval) =>
  String(sval ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

/** 라우터 로깅 (요약) */
router.use((req, res, next) => {
  const started = Date.now()
  const path = req.baseUrl + req.path
  // 요청 로그
  // eslint-disable-next-line no-console
  console.log('[API][REQ]', { path, method: req.method, userId: getMyId(req) })

  const originalJson = res.json.bind(res)
  res.json = (body) => {
    const ms = Date.now() - started
    const status = res.statusCode
    const size =
      typeof body === 'string'
        ? body.length
        : Buffer.byteLength(JSON.stringify(body || {}))
    // 응답 로그
    // eslint-disable-next-line no-console
    console.log('[API][RES]', { path, status, ms, size })
    return originalJson(body)
  }
  next()
})

/* =========================
   1) 검색 나이(출생년도 범위) 저장
   payload: { year1, year2 }  // 숫자 또는 '전체'
========================= */
router.patch('/search/year', async (req, res, next) => {
  try {
    const userId = getMyId(req)
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' })

    let { year1, year2 } = req.body || {}
    const parsedYear1 = toNullOrInt(year1)
    const parsedYear2 = toNullOrInt(year2)

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { search_birthyear1: parsedYear1, search_birthyear2: parsedYear2 } },
      { new: true }
    ).select('search_birthyear1 search_birthyear2')

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' })
    return res.json({ success: true, user: updated })
  } catch (err) {
    next(err)
  }
})

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
      .filter((r) => r.region1 !== '' && r.region2 !== '')
    // "전체 전체" 포함 시 단일값으로 축약
    if (arr.some((r) => r.region1 === '전체' && r.region2 === '전체')) {
      return [{ region1: '전체', region2: '전체' }]
    }
    return arr
  }
  if (body && typeof body === 'object' && (body.region1 || body.region2)) {
    const r1 = s(body.region1) || ''
    const r2 = s(body.region2) || ''
    if (r1 && r2) return [{ region1: r1, region2: r2 }]
  }
  return []
}

async function upsertRegions(req, res, next) {
  try {
    const userId = getMyId(req)
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' })

    const normalized = normalizeRegions(req.body || {})
    const first = normalized[0] || { region1: '', region2: '' }

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
    ).select('search_regions search_region1 search_region2')

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' })
    return res.json({ success: true, count: normalized.length, user: updated })
  } catch (err) {
    next(err)
  }
}
router.patch('/search/regions', upsertRegions)
router.put('/search/regions', upsertRegions)

/* =========================
   3) 검색 특징 저장
   payload: { preference: string }
   - 등급 가드 제거: 값 그대로 저장
========================= */
router.patch('/search/preference', async (req, res, next) => {
  try {
    const userId = getMyId(req)
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' })

    const value = s(req.body?.preference) || ''
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { search_preference: value } },
      { new: true }
    ).select('search_preference')

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' })
    return res.json({ success: true, user: updated })
  } catch (err) {
    next(err)
  }
})

/* =========================
   4) 사용자 검색 (간단 필터)
   payload: {
     regions: [{region1, region2}, ...]   // 선택적
   }
   - 내 계정/내 연락처(옵션) 제외 로직 유지
========================= */
const USER_FIELDS =
  'username nickname birthyear gender marriage search_marriage region1 region2 ' +
  'preference search_preference selfintro ' +
  'last_login updatedAt createdAt ' +
  'profileMain profileImages profileImage avatar photo ' +
  'search_onlyWithPhoto search_allowFriendRequests search_matchPremiumOnly'

function shapeUsers(list) {
  const toOnOff = (v) => (String(v ?? 'OFF').toUpperCase() === 'ON' ? 'ON' : 'OFF')
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
  }))
}

router.post('/search/users', async (req, res, next) => {
  try {
    const myId = getMyId(req)
    if (!myId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' })

    const me = await User.findById(myId)
      .select('phoneHash localContactHashes search_disconnectLocalContacts')
      .lean()

    const raw = Array.isArray(req.body?.regions) ? req.body.regions : []
    const regions = raw
      .filter((r) => r && (r.region1 || r.region2))
      .map((r) => ({ region1: s(r.region1), region2: s(r.region2) }))

    const isAll =
      regions.length === 0 ||
      regions.some((r) => r.region1 === '전체') ||
      regions.some((r) => r.region2 === '전체')

    const andFilters = [{ _id: { $ne: myId } }]
    if (me?.phoneHash) andFilters.push({ phoneHash: { $ne: me.phoneHash } })

    const disconnectOn = String(me?.search_disconnectLocalContacts || '').toUpperCase() === 'ON'
    const contactHashes = Array.isArray(me?.localContactHashes) ? me.localContactHashes : []
    if (disconnectOn && contactHashes.length) {
      andFilters.push({ phoneHash: { $nin: contactHashes } })
    }

    if (!isAll) {
      const orConditions = regions.map(({ region1, region2 }) =>
        !region2 || region2 === '전체' ? { region1 } : { region1, region2 }
      )
      andFilters.push({ $or: orConditions })
    }

    const finalQuery = andFilters.length ? { $and: andFilters } : {}
    const users = await User.find(finalQuery).select(USER_FIELDS).lean()

    return res.json(shapeUsers(users))
  } catch (err) {
    next(err)
  }
})

/* =========================
   5) 스위치 일괄 저장
   payload: {
     disconnectLocalContacts: 'ON'|'OFF',
     allowFriendRequests:     'ON'|'OFF', // 프론트에서 "받지 않기"를 ON으로 넘김
     allowNotifications:      'ON'|'OFF', // 프론트에서 "받지 않기"를 ON으로 넘김
     onlyWithPhoto:           'ON'|'OFF',
     matchPremiumOnly:        'ON'|'OFF',
   }
   - 등급 가드 제거: 값 그대로 저장
========================= */
router.patch('/search/settings', async (req, res, next) => {
  try {
    const userId = getMyId(req)
    if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' })

    let {
      disconnectLocalContacts,
      allowFriendRequests,
      allowNotifications,
      onlyWithPhoto,
      matchPremiumOnly,
    } = req.body || {}

    // 유효성 (ON/OFF) 강제 보정
    const update = {}
    if (disconnectLocalContacts !== undefined) {
      if (!isOnOff(disconnectLocalContacts)) return res.status(400).json({ error: 'disconnectLocalContacts must be ON/OFF' })
      update.search_disconnectLocalContacts = normOnOff(disconnectLocalContacts)
    }
    if (allowFriendRequests !== undefined) {
      if (!isOnOff(allowFriendRequests)) return res.status(400).json({ error: 'allowFriendRequests must be ON/OFF' })
      update.search_allowFriendRequests = normOnOff(allowFriendRequests)
    }
    if (allowNotifications !== undefined) {
      if (!isOnOff(allowNotifications)) return res.status(400).json({ error: 'allowNotifications must be ON/OFF' })
      update.search_allowNotifications = normOnOff(allowNotifications)
    }
    if (onlyWithPhoto !== undefined) {
      if (!isOnOff(onlyWithPhoto)) return res.status(400).json({ error: 'onlyWithPhoto must be ON/OFF' })
      update.search_onlyWithPhoto = normOnOff(onlyWithPhoto)
    }
    if (matchPremiumOnly !== undefined) {
      if (!isOnOff(matchPremiumOnly)) return res.status(400).json({ error: 'matchPremiumOnly must be ON/OFF' })
      update.search_matchPremiumOnly = normOnOff(matchPremiumOnly)
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true }
    )
      .select(
        'search_disconnectLocalContacts search_allowFriendRequests search_allowNotifications search_onlyWithPhoto search_matchPremiumOnly'
      )
      .lean()

    if (!updated) return res.status(404).json({ error: '사용자 없음' })
    return res.json({ ok: true, user: updated })
  } catch (err) {
    next(err)
  }
})

/* =========================
   6) 검색 결혼유무 저장
   payload: { marriage: '전체'|'미혼'|'기혼'|'돌싱' }
   - 등급 가드 제거: 값 그대로 저장
========================= */
router.patch('/search/marriage', async (req, res, next) => {
  try {
    const userId = getMyId(req)
    if (!userId) return res.status(401).json({ success: false, error: '로그인이 필요합니다.' })

    let raw = s(req.body?.marriage)
    const ALLOWED = ['전체', '미혼', '기혼', '돌싱']
    if (!ALLOWED.includes(raw)) {
      return res.status(400).json({ success: false, error: 'marriage must be one of 전체/미혼/기혼/돌싱' })
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { search_marriage: raw } },
      { new: true }
    ).select('search_marriage updatedAt').lean()

    if (!updated) return res.status(404).json({ success: false, error: '사용자 없음' })
    return res.json({ success: true, search_marriage: updated.search_marriage, updatedAt: updated.updatedAt })
  } catch (err) {
    next(err)
  }
})

/* =========================
   7) 추천 후보(원천 리스트) 제공  ← 신규
   GET /api/search/targets?limit=50&exclude=comma,ids&seedDay=YYYY-MM-DD
   - 프론트 분배(distribution.js)용 원천 후보를 당일 점수순으로 반환
   - UserDailyScore 모델 필요(모델 등록 선행)
========================= */
router.get('/search/targets', async (req, res, next) => {
  try {
    const viewerId = getMyId(req)
    if (!viewerId) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' })

    const limit = Math.min(Number(req.query.limit || 50), 200)
    const excludeSet = new Set(parseCommaIds(req.query.exclude))
    const dayjs = require('dayjs')
    const tz = require('dayjs/plugin/timezone')
    const utc = require('dayjs/plugin/utc')
    dayjs.extend(utc); dayjs.extend(tz);

const ymd = s(req.query.seedDay) || dayjs().tz('Asia/Seoul').format('YYYY-MM-DD')


    // 모델은 글로벌로 등록되어 있어야 함(models/index.js)
    const UserDailyScore = mongoose.model('UserDailyScore')

    const scoreDocs = await UserDailyScore.find({ ymd })
      .sort({ exposureScore: -1, updatedAt: -1 })
      .limit(limit * 3)
      .lean()

    const candidateIds = []
    for (const d of scoreDocs) {
      const uid = String(d.user)
      if (uid === viewerId) continue
      if (excludeSet.has(uid)) continue
      candidateIds.push(d.user)
      if (candidateIds.length >= limit * 2) break
    }

    const users = await User.find(
      { _id: { $in: candidateIds }, isDeleted: { $ne: true }, isPrivate: { $ne: true } }
    )
      .select(
        '_id username nickname birthyear gender level region1 region2 ' +
        'profileMain profileImages profileImage avatar photo ' +
        'createdAt updatedAt'
      )
      .lean()

    return res.json({ ok: true, ymd, total: users.length, users })
  } catch (err) {
    next(err)
  }
})

/* =========================
   파일 전용 에러 핸들러
========================= */
router.use((err, req, res, next) => {
  const status = err.status || 500
  const msg = err.message || 'Internal Server Error'
  // eslint-disable-next-line no-console
  console.error('[search/targetRouter]', status, msg, err.stack)
  res.status(status).json({ ok: false, error: msg })
})

module.exports = router
