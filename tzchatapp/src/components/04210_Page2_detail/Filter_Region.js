// components/target_Filter/regionFilter.js

/**
 * ✅ 다중 지역 조건 필터링
 * 
 * - 사용자의 `search_regions` 배열을 기준으로
 * - 상대방 유저의 region1/region2가 하나라도 매칭되면 통과
 * - ex) search_regions = [{ region1: '서울', region2: '전체' }, { region1: '경기', region2: '성남시' }]
 * 
 * @param {Array} users - 전체 사용자 리스트
 * @param {Array} searchRegions - 나의 지역 조건 배열 (ex: [{ region1, region2 }, ...])
 * @returns {Array} 필터링된 사용자 리스트
 */
export function filterByRegion(users, searchRegions) {
  return users.filter(user => {
    // 🔹 조건 없거나 '전체' 포함 시 모두 허용
    if (
      !Array.isArray(searchRegions) ||
      searchRegions.length === 0 ||
      searchRegions.some(r => r.region1 === '전체')
    ) {
      console.log(`[필터] 지역조건 없음 또는 전체 허용 → ${user.nickname} 통과`)
      return true
    }

    // 🔹 사용자 지역이 searchRegions 중 하나라도 매치되면 통과
    const match = searchRegions.some(condition => {
      if (!condition.region1 || !condition.region2) return false

      const region1Match = user.region1 === condition.region1
      const region2Match =
        condition.region2 === '전체' ? true : user.region2 === condition.region2

      return region1Match && region2Match
    })

    if (match) {
      console.log(`[필터] 지역 일치 → ${user.nickname} (${user.region1}, ${user.region2})`)
    }

    return match
  })
}
