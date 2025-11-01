// config/points.js
// ────────────────────────────────────────────────────────────
/**
 * Dating 앱 포인트 규칙 (하트·스타·루비)
 * - 통화:
 *    · 하트(무료/매일 11:00 KST 지급) / 스타(보상·출석) / 루비(유료·구매)
 * - 구매팩: 10,000원 = 40개
 * - 친구 신청 단가:
 *    · 일반 20 / 프리미엄 40
 * - 소모 우선순위:
 *    · 기본: 하트 → 스타 → 루비
 *    · 스타 전용: 스타 → 루비 (하트 대체 불가)
 * - 등급 규칙(일일 지급·누적 한도):
 *    · 일반회원:     daily 100 / cap 0(누적 불가)
 *    · 라이트회원:   daily 240 / cap 1200
 *    · 프리미엄회원: daily 400 / cap 2000
 *    · 베타회원:     daily 400 / cap 0(누적 불가)
 * - 지급 기준 시각: 매일 11:00 (KST, Asia/Seoul)
 */
// ────────────────────────────────────────────────────────────

const POINT = Object.freeze({
  HEART: '하트',   // 무료/일일지급
  STAR:  '스타',   // 보상/출석·이벤트
  RUBY:  '루비',   // 유료/결제
});

const COLORS = Object.freeze({
  [POINT.HEART]: '#FF5A79',
  [POINT.STAR]:  '#FFD85C',
  [POINT.RUBY]:  '#E52B50',
});

// 구매팩(표시/결제 연동용)
const PURCHASE_PACKS = Object.freeze([
  Object.freeze({ priceKRW: 10000, qty: 40 }),
]);

// ✅ 포인트 소모 단가
const COST = Object.freeze({
  NORMAL_REQUEST: 20,  // 일반 친구 신청
  PREMIUM_REQUEST: 40, // 프리미엄 친구 신청
});

// 결제(소모) 우선순위
const DEFAULT_CONSUME_ORDER = Object.freeze([POINT.HEART, POINT.STAR, POINT.RUBY]);
const TENDER_POLICY = Object.freeze({
  default: DEFAULT_CONSUME_ORDER,
  starOnly: Object.freeze([POINT.STAR, POINT.RUBY]),
});

// 등급별 하트(무료) 지급/누적 규칙
//  - daily: 매일 지급 수량
//  - cap: 누적 한도 (0 = 누적 불가)
//  - accumulate: true면 누적 허용
const LEVEL_RULES = Object.freeze({
  '일반회원':     Object.freeze({ daily: 100, cap: 0,     accumulate: false }),
  '라이트회원':   Object.freeze({ daily: 240, cap: 1200,  accumulate: true  }),
  '프리미엄회원': Object.freeze({ daily: 400, cap: 2000,  accumulate: true  }),
  '베타회원':     Object.freeze({ daily: 400, cap: 0,     accumulate: false }),
});

// 지급 기준 시각(KST)
const GRANT_HOUR_KST = 11;
const KST_TZ = 'Asia/Seoul';

// ────────────────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────────────────
function getLevelRules(level) {
  return LEVEL_RULES[level] || LEVEL_RULES['일반회원'];
}

function getDailyHeartGrant(level) {
  return getLevelRules(level).daily;
}

function getHeartCap(level) {
  return getLevelRules(level).cap;
}

function isHeartAccumulable(level) {
  return !!getLevelRules(level).accumulate;
}

/** 다음 지급 시간(매일 11:00 KST)을 UTC Date로 반환 */
function getNextGrantTimeKST(now = new Date()) {
  const utc = now.getTime();
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const nowKST = new Date(utc + KST_OFFSET);

  const y = nowKST.getUTCFullYear();
  const m = nowKST.getUTCMonth();
  const d = nowKST.getUTCDate();

  // 11:00 KST = 02:00 UTC
  const todayBoundaryUTC = Date.UTC(y, m, d, GRANT_HOUR_KST - 9, 0, 0, 0);
  if (utc < todayBoundaryUTC) return new Date(todayBoundaryUTC);
  return new Date(Date.UTC(y, m, d + 1, GRANT_HOUR_KST - 9, 0, 0, 0));
}

function getTenderOrder(policy = 'default') {
  return TENDER_POLICY[policy] || TENDER_POLICY.default;
}

// ────────────────────────────────────────────────────────────
module.exports = {
  POINT,
  COLORS,
  COST,
  PURCHASE_PACKS,
  DEFAULT_CONSUME_ORDER,
  TENDER_POLICY,
  LEVEL_RULES,
  GRANT_HOUR_KST,
  KST_TZ,
  getNextGrantTimeKST,
  getLevelRules,
  getDailyHeartGrant,
  getHeartCap,
  isHeartAccumulable,
  getTenderOrder,
};
