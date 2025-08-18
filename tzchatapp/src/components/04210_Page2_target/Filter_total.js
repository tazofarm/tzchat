// src/components/target_Filter/filter_total.js
// ======================================================================
// 통합 사용자 필터
//  - (0)  자기 자신 제외
//  - (0.5)관계 제외(친구/보낸신청/받은신청/차단)
//  - (1)  지역(region)    : filterByRegion()
//  - (2)  성향(preference): filterByPreference()
//  - (3)  출생년도(year)  : filterByYear()
//  - (4)  친구신청 허용   : localStorage['tzchat_allowFriendRequest'] (기본 ON)
//
// 사용 예:
//   import { applyTotalFilter } from '@/components/target_Filter/filter_total'
//   const filtered = applyTotalFilter(users, me, { excludeIds })
//
//  ⚠ 경로는 프로젝트 구조에 맞게 아래 import 경로를 조정하세요.
// ======================================================================

/* ▼▼▼ 기존 개별 필터 가져오기 ▼▼▼ */

// (1) region
import { filterByRegion } from '@/components/04210_Page2_target/Filter_Region'

// (2) preference
import { filterByPreference } from '@/components/04210_Page2_target/Filter_Preference'

// (3) year
import { filterByYear } from '@/components/04210_Page2_target/Filter_Year'

// (4) 친구신청 허용(로컬) 읽기
import { readAllowFriendRequest } from '@/components/04210_Page2_target/Filter_allow'

// (0.5) 관계 제외 필터
//  - Filter_List.js에서 제공하는 filterByList(users, excludeIds: Set<string>)
import { filterByList } from '@/components/04210_Page2_target/Filter_List'

/** 로컬 키 정보(참고용 상수) */
export const LS_KEY_ALLOW_FRIEND_REQUEST = 'tzchat_allowFriendRequest'

/**
 * INTERNAL: 친구신청 허용값을 읽고 OFF면 전체 제외, ON이면 통과
 * @param {Array<object>} users
 * @param {boolean=} forceAllowOpt  외부에서 강제로 지정(테스트/옵션)
 * @returns {Array<object>}
 */
function applyFriendPermission(users, forceAllowOpt) {
  const allow =
    typeof forceAllowOpt === 'boolean' ? forceAllowOpt : readAllowFriendRequest()

  console.log(`[FilterTotal] allowFriendRequest=${allow}`)
  if (allow === false) {
    console.warn('[FilterTotal] 친구신청 허용=OFF → 검색 결과를 비웁니다([])')
    return []
  }
  return Array.isArray(users) ? users : []
}

/**
 * ✅ 통합 필터 진입점
 * @param {Array<object>} users      - 검색 결과(서버/클라)
 * @param {object} me                - 내 정보(user/me API)
 *   - me._id
 *   - me.search_regions   : [{ region1, region2 }, ...]
 *   - me.gender           : 'man' | 'woman'
 *   - me.search_preference: '이성친구 - 전체/일반/특수' | '동성친구 - 전체/일반/특수' | ''
 *   - me.search_birthyear1: 'YYYY' | '전체' | '' | null
 *   - me.search_birthyear2: 'YYYY' | '전체' | '' | null
 * @param {object=} options
 *   - options.friendAllowOverride {boolean} : 친구허용 강제 지정(테스트 용)
 *   - options.excludeIds {Set<string>}      : 관계 제외용 ID Set (friends/pending/blocks)
 * @returns {Array<object>} 최종 필터링 결과
 */
export function applyTotalFilter(users = [], me = {}, options = {}) {
  const safeUsers = Array.isArray(users) ? users : []
  const meId = me?._id

  console.time('[FilterTotal] apply')

  // 0) 자기 자신 제외
  let result = safeUsers.filter(u => u?._id !== meId)
  console.log(`[FilterTotal] 0) 자기 자신 제외 → ${result.length}/${safeUsers.length}`)

  // 0.5) 관계 기반 제외 (friends/pendingSent/pendingRecv/blocks)
  // - options.excludeIds: Set<string> 형태 기대 (없으면 통과)
  if (options && options.excludeIds instanceof Set) {
    result = filterByList(result, options.excludeIds)
    console.log(`[FilterTotal] 0.5) 관계 제외 필터 결과 → ${result.length}`)
  } else {
    console.log('[FilterTotal] 0.5) 관계 제외 필터 건너뜀 (excludeIds 없음)')
  }

  // 1) 지역
  result = filterByRegion(result, me?.search_regions || [])
  console.log(`[FilterTotal] 1) 지역 필터 결과 → ${result.length}`)

  // 2) 성향
  result = filterByPreference(result, me?.gender, (me?.search_preference || '').trim())
  console.log(`[FilterTotal] 2) 성향 필터 결과 → ${result.length}`)

  // 3) 출생년도
  result = filterByYear(result, me?.search_birthyear1, me?.search_birthyear2)
  console.log(`[FilterTotal] 3) 출생년도 필터 결과 → ${result.length}`)

  // 4) 친구신청 허용(로컬) — OFF면 전체 제외, ON이면 그대로 통과
  result = applyFriendPermission(result, options.friendAllowOverride)
  console.log(`[FilterTotal] 4) 친구허용 필터 결과 → ${result.length}`)

  console.timeEnd('[FilterTotal] apply')
  return result
}

export default applyTotalFilter
