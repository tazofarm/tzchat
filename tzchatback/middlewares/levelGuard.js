// middlewares/levelGuard.js
// ------------------------------------------------------------
// 등급 규칙 기반의 프로필/검색 입력 보정 유틸 (라우터에서 사용)
// ------------------------------------------------------------
const { SELF_EDIT, canEditSelf, getSearchMode } = require('@/shared/levelRules');

// 특징 허용 검증
function isAllowedPreference(level, value) {
  const r = SELF_EDIT.preference[level];
  if (r === true) return true;
  if (typeof r === 'object' && Array.isArray(r.allow)) {
    return r.allow.includes(value);
  }
  return false;
}

// 프로필 수정 payload 보정
function sanitizeProfileUpdate(level, body, { duringSignup = false } = {}) {
  const out = {};
  const map = {
    phone: 'phone',
    birthyear: 'birthyear',
    gender: 'gender',
    nickname: 'nickname',
    region1: 'region',
    region2: 'region',
    preference: 'preference',
    marriage: 'marriage',
    selfintro: 'selfintro',
  };

  for (const [field, ruleKey] of Object.entries(map)) {
    if (body[field] === undefined) continue;
    if (!canEditSelf(ruleKey, level, { duringSignup })) continue;

    // 특징 특수 처리(일반/여성 제한)
    if (ruleKey === 'preference' && !isAllowedPreference(level, body[field])) continue;

    const rule = SELF_EDIT[ruleKey]?.[level];
    let v = body[field];

    if (typeof rule === 'object') {
      if (rule.maxLen && typeof v === 'string') v = String(v).slice(0, rule.maxLen);
    }
    out[field] = v;
  }
  return out;
}

// 검색 설정 보정
function sanitizeSearchSettings(level, body) {
  const out = {};
  const entries = [
    ['age', ['search_birthyear1', 'search_birthyear2']],
    ['region', ['search_regions', 'search_region1', 'search_region2']],
    ['preference', ['search_preference']],
    ['marriage', ['search_marriage']],
    ['onlyWithPhoto', ['search_onlyWithPhoto']],   // 'ON'|'OFF'
    ['premiumOnly', ['search_matchPremiumOnly']],  // 'ON'|'OFF'
  ];

  for (const [field, keys] of entries) {
    const mode = getSearchMode(field, level); // true|'allOnly'|'offOnly'|false
    if (mode === false) continue;

    for (const k of keys) {
      if (body[k] === undefined) continue;

      let v = body[k];
      if (mode === 'allOnly') {
        if (k === 'search_preference') v = '이성친구 - 전체'; // 표: "전체 만"
        if (k === 'search_marriage')   v = '전체';
      }
      if (mode === 'offOnly') {
        if (k === 'search_onlyWithPhoto' || k === 'search_matchPremiumOnly') v = 'OFF';
      }
      out[k] = v;
    }
  }
  return out;
}

module.exports = {
  sanitizeProfileUpdate,
  sanitizeSearchSettings,
  isAllowedPreference,
};
