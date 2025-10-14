// scr/components/04210_Page2_target/Filter/Total_Filter_normal.js
// ------------------------------------------------------------
// Normal Total Filter (일반 채팅용)
// ------------------------------------------------------------
// AND 체인 구성:
// 1. Filter_year_co.js           출생년도(상호)
// 2. Filter_region_co.js         지역(상호)
// 3. Filter_preference_co.js     검색특징(상호)
// 4. Filter_marriage_co.js       결혼유무(상호)
// 5. Filter_photo_co.js          사진(상호)
// 6. Filter_contacts_co.js       연락처 배제(상호)
// 7. Filter_recieve_co.js        친구 신청 받지 않기(나 기준)
// 8. Filter_premium.js           Premium 전용 노출(나 기준) → ON이면 일반에서 비노출
// 9. Filter_recieve_limit.js     받은 신청 수 제한(나 기준) → 검색 유지, 노출만 차단 플래그
// ------------------------------------------------------------

import { filterByYearCo } from './Filter_year_co'
import { filterByRegionCo } from './Filter_region_co'
import { filterByPreferenceCo } from './Filter_preference_co'
import { filterByMarriageCo } from './Filter_marriage_co'
import { filterByPhotoCo } from './Filter_photo_co'
import { filterByContactsCo } from './Filter_contacts_co'
import { filterByReceiveOffCo } from './Filter_recieve_co'
import { filterByPremiumExposure } from './Filter_premium'
import { passThroughWithExposureFlag } from './Filter_recieve_limit'

/** 
 * Normal Total Filter
 * @param {Array} users
 * @param {Object} me
 * @param {Object} [opt]
 * @param {boolean} [opt.log=false]
 * @param {number}  [opt.pendingCountOverride]  // ⬅ 테스트/강제용
 * @param {number}  [opt.receiveLimitOverride]  // ⬅ 테스트/강제용
 */
export function applyTotalFilterNormal(users, me, opt = {}) {
  const log = !!opt.log
  let list = Array.isArray(users) ? [...users] : []

  if (log) console.groupCollapsed('[TotalFilter:Normal] 시작')

  // 1~7: 상호 + 단방향 필터 체인
  list = filterByYearCo(list, me, { log })
  list = filterByRegionCo(list, me, { log })
  list = filterByPreferenceCo(list, me, { log })
  list = filterByMarriageCo(list, me, { log })
  list = filterByPhotoCo(list, me, { log })
  list = filterByContactsCo(list, me, { log })
  list = filterByReceiveOffCo(list, me, { log })

  // 8: Premium 전용 노출(나 기준) — ON이면 일반 채팅에서 완전 비노출
  list = filterByPremiumExposure(list, me, { log })

  // 9: 받은 신청 수 제한 — 정책 전환(제한 도달 시 내 검색 결과도 0)
  const pendingCount = opt.pendingCountOverride ?? me?.pendingCount ?? 0
  const receiveLimit = opt.receiveLimitOverride ?? me?.receiveLimit ?? 19

  const { users: finalList, exposureBlocked } = passThroughWithExposureFlag(
    list,
    pendingCount,
    receiveLimit
  )

  if (exposureBlocked && log) console.log('⛔ 받은신청 제한 도달: 검색/노출 모두 차단됨')

  if (log) console.groupEnd()
  return finalList
}