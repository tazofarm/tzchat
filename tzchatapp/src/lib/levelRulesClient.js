// src/lib/levelRulesClient.js
// ------------------------------------------------------------
// 프론트 전용 헬퍼 (버튼 disabled, 힌트/토글 제한 등에 사용)
// ------------------------------------------------------------
import { canEditSelf, getSearchMode, getOpsLimit } from '@/shared/levelRules';

export function uiCanEdit(field, level, opts={}) {
  return canEditSelf(field, level, opts);
}
export function uiSearchMode(field, level) {
  // 'allOnly' | 'offOnly' | true | false
  return getSearchMode(field, level);
}
export function uiOpsLimit(key, level) {
  return getOpsLimit(key, level);
}
