// scr/components/04210_Page2_target/Filter/Total_Filter_premium.js
// ------------------------------------------------------------
// Premium Total Filter
// ------------------------------------------------------------
// 구성요소 (모두 AND 연결):
// 1. Filter_year_co.js          출생년도 범위 (상호 노출)
// 2. Filter_region_co.js        지역 (상호 노출)
// 3. Filter_preference_co.js    검색특징 (이성/동성 등)
// 4. Filter_marriage_co.js      결혼 유무
// 5. Filter_photo_co.js         사진 (ON일 때만 노출)
// 6. Filter_contacts_co.js      연락처 연결 끊기
// 7. Filter_receive_co.js       친구신청 받지 않기
// 8. Filter_emergency_co.js     긴급모드(Emergency) — Premium 핵심
// 9. Filter_recieve_limit.js    받은신청 제한 (노출 제한 전용)
// ------------------------------------------------------------

import { filterByYearCo } from './Filter_year_co'
import { filterByRegionCo } from './Filter_region_co'
import { filterByPreferenceCo } from './Filter_preference_co'
import { filterByMarriageCo } from './Filter_marriage_co'
import { filterByPhotoCo } from './Filter_photo_co'
import { filterByContactsCo } from './Filter_contacts_co'
import { filterByReceiveOffCo } from './Filter_recieve_co'
import { filterByEmergencyCo } from './Filter_emergency_co'
import { passThroughWithExposureFlag } from './Filter_recieve_limit'

/**
 * Premium Total Filter
 * @param {Array} users - 후보 유저 목록
 * @param {Object} me   - 내 유저 객체
 * @param {Object} [opt]
 * @param {boolean} [opt.log=false] - 콘솔 로그 활성화
 * @returns {Array} 최종 필터링된 유저 목록
 */
export function applyTotalFilterPremium(users, me, opt = {}) {
  const log = !!opt.log
  let list = Array.isArray(users) ? [...users] : []

  if (log) console.groupCollapsed('[TotalFilter:Premium] 시작')

  // 1~8: 상호 조건 필터 체인
  list = filterByYearCo(list, me, { log })
  list = filterByRegionCo(list, me, { log })
  list = filterByPreferenceCo(list, me, { log })
  list = filterByMarriageCo(list, me, { log })
  list = filterByPhotoCo(list, me, { log })
  list = filterByContactsCo(list, me, { log })
  list = filterByReceiveOffCo(list, me, { log })
  list = filterByEmergencyCo(list, me, { log }) // 🔥 Premium 핵심

  // 9: 받은신청 제한 — 검색은 유지, 노출만 차단
  const { users: finalList, exposureBlocked } = passThroughWithExposureFlag(
    list,
    me?.pendingCount ?? 0,
    me?.receiveLimit ?? 19
  )

  if (exposureBlocked && log) console.log('⚠️ 받은신청 제한으로 노출 차단됨')

  if (log) console.groupEnd()
  return finalList
}



/**
 ✅ 사용 예시
import { applyTotalFilterPremium } from '@/utils/Total_Filter_premium'

// me: 로그인 유저
// users: 서버에서 받은 전체 유저 리스트
const premiumUsers = applyTotalFilterPremium(users, me, { log: true }) 
 */