// shared/levelRules.js
// ------------------------------------------------------------
// 기능 접근/제한 매트릭스 (프론트/백엔드 공용)
// 표(이미지) 내용을 코드로 반영: 일반회원, 여성회원, 프리미엄
// ------------------------------------------------------------
const LEVELS = ['일반회원', '여성회원', '프리미엄'];

// 1) 나의 프로필 (편집 권한)
// true: 수정 가능 / 'signup': 가입시에만 / object: 제한(allow/maxLen 등)
const SELF_EDIT = {
  phone:      { 일반회원: 'signup', 여성회원: 'signup', 프리미엄: 'signup' },
  birthyear:  { 일반회원: 'signup', 여성회원: 'signup', 프리미엄: 'signup' },
  gender:     { 일반회원: 'signup', 여성회원: 'signup', 프리미엄: 'signup' },
  nickname:   { 일반회원: true,     여성회원: true,     프리미엄: true     },
  region:     { 일반회원: true,     여성회원: true,     프리미엄: true     },
  // 특징: 일반/여성 → "이성친구*"만 허용, 프리미엄 → 자유
  preference: {
    일반회원: { allow: ['이성친구 - 전체','이성친구 - 일반','이성친구 - 특수'] },
    여성회원: { allow: ['이성친구 - 전체','이성친구 - 일반','이성친구 - 특수'] },
    프리미엄: true
  },
  marriage:   { 일반회원: true,     여성회원: true,     프리미엄: true     },
  selfintro:  { 일반회원: { maxLen: 1000 }, 여성회원: { maxLen: 1000 }, 프리미엄: { maxLen: 1000 } },
};

// 2) 상대 프로필 (열람 권한) — 참고용
const OTHER_VIEW = {
  phone:      { 일반회원: false, 여성회원: false, 프리미엄: false },
  birthyear:  { 일반회원: true,  여성회원: true,  프리미엄: true  },
  gender:     { 일반회원: true,  여성회원: true,  프리미엄: true  },
  nickname:   { 일반회원: true,  여성회원: true,  프리미엄: true  },
  region:     { 일반회원: true,  여성회원: true,  프리미엄: true  },
  preference: { 일반회원: false, 여성회원: false, 프리미엄: true  },
  marriage:   { 일반회원: false, 여성회원: false, 프리미엄: true  },
  selfintro:  { 일반회원: true,  여성회원: true,  프리미엄: true  },
};

// 3) 검색 조건 (사용 가능 범위)
// 'allOnly': "전체"만 / 'offOnly': OFF만 / true: 자유 / false: 불가
const SEARCH_RULES = {
  age:           { 일반회원: true,       여성회원: true,       프리미엄: true     },
  region:        { 일반회원: true,       여성회원: true,       프리미엄: true     },
  preference:    { 일반회원: 'allOnly',  여성회원: 'allOnly',  프리미엄: true     },
  marriage:      { 일반회원: 'allOnly',  여성회원: 'allOnly',  프리미엄: true     },
  onlyWithPhoto: { 일반회원: 'offOnly',  여성회원: 'offOnly',  프리미엄: true     },
  premiumOnly:   { 일반회원: 'offOnly',  여성회원: 'offOnly',  프리미엄: true     },
};

// 4) 운영 한도 (참고용)
const OPS_LIMITS = {
  inboxCap:         { 일반회원: 20, 여성회원: 20, 프리미엄: 20 },
  normalRequests:   { 일반회원: { base: 5,   extra: '보상광고' },
                      여성회원: { base: 5,   extra: '보상광고' },
                      프리미엄: { base: Infinity, extra: null } },
  premiumSearch:    { 일반회원: '보상광고', 여성회원: true, 프리미엄: true },
  premiumRequests:  { 일반회원: { base: 1,   extra: '보상광고' },
                      여성회원: { base: 5,   extra: null },
                      프리미엄: { base: Infinity, extra: null } },
  emergencyMinutes: { 일반회원: 10, 여성회원: 120, 프리미엄: 120 },
};

// ──────────────── helpers ────────────────
function getRule(table, field, level) {
  return table?.[field]?.[level];
}
function canEditSelf(field, level, { duringSignup=false } = {}) {
  const r = getRule(SELF_EDIT, field, level);
  if (r === true) return true;
  if (r === 'signup') return !!duringSignup;
  return !!r && typeof r === 'object';
}
function canViewOther(field, level) {
  return !!getRule(OTHER_VIEW, field, level);
}
function getSearchMode(field, level) {
  return getRule(SEARCH_RULES, field, level);
}
function getOpsLimit(key, level) {
  return getRule(OPS_LIMITS, key, level);
}

module.exports = {
  LEVELS,
  SELF_EDIT,
  OTHER_VIEW,
  SEARCH_RULES,
  OPS_LIMITS,
  canEditSelf,
  canViewOther,
  getSearchMode,
  getOpsLimit,
};
