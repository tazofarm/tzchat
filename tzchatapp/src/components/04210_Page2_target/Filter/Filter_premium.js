// frontend/utils/Filter_premium_exposure.js
// ------------------------------------------------------------
// Premium 전용 노출 필터 (단방향)
//
// 규칙:
// - search_matchPremiumOnly === 'OFF' → 모두 검색 + 모두에게 노출
// - search_matchPremiumOnly === 'ON'  → 아무도 검색 안 함, 노출도 안 됨
//
// 주의:
// - 이 필터는 상호 노출이 아닌 "나의 상태 기준" 필터입니다.
// - 즉, 내가 'ON'이면 나 자신이 완전히 비공개 상태가 됩니다.
// ------------------------------------------------------------

/** 'ON'/'OFF'/boolean → boolean */
function normalizeOn(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').toUpperCase();
  if (s === 'ON') return true;
  if (s === 'OFF') return false;
  return false;
}

/**
 * Premium 전용 노출 필터
 * @param {Array} users - 후보 유저 목록
 * @param {Object} me   - 내 유저 객체 (search_matchPremiumOnly 포함)
 * @param {Object} [opt]
 * @param {boolean} [opt.log=false]
 * @returns {Array}
 */
export function filterByPremiumExposure(users, me, opt = {}) {
  const log = !!opt.log;
  const isPremiumOnly = normalizeOn(me?.search_matchPremiumOnly);

  // 내가 'ON'이면 아예 비노출
  if (isPremiumOnly) {
    if (log) console.log('[Premium필터] 🔒 Premium Only 모드 → 검색/노출 차단');
    return [];
  }

  // OFF면 제한 없음
  return Array.isArray(users) ? users : [];
}
