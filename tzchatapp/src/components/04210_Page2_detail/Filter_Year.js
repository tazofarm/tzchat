/**
 * 출생년도 조건 필터링
 *
 * 조건:
 * - 둘 다 null/''/'전체' → 전체 통과
 * - fromYear이 null/''/'전체' → 최대값 이하
 * - toYear이 null/''/'전체' → 최소값 이상
 * - 둘 다 명시되어 있을 경우 → 최소값 이상 & 최대값 이하
 *
 * @param {Array} users - 전체 사용자 리스트
 * @param {String|null} fromYear - 검색 시작년도 ('1980', '전체', '', null 등)
 * @param {String|null} toYear - 검색 끝년도 ('2000', '전체', '', null 등)
 * @returns {Array} 필터링된 사용자 리스트
 */
export function filterByYear(users, fromYear, toYear) {
  return users.filter(user => {
    // 🟡 출생년도 추출
    const birthYear = Number(user.birthyear)

    // 🔺 숫자가 아니면 필터에서 제외
    if (isNaN(birthYear)) {
      console.log(`[필터] ❌ ${user.nickname} → 유효하지 않은 출생년도:`, user.birthyear)
      return false
    }

    // 🟢 조건값 유효성 확인 ('전체' 또는 null/'' 이면 없는 조건으로 판단)
    const hasFrom = fromYear && fromYear !== '전체'
    const hasTo = toYear && toYear !== '전체'

    // 🔢 숫자로 변환
    const min = hasFrom ? Number(fromYear) : null
    const max = hasTo ? Number(toYear) : null

    // ✅ 비교 수행
    const validMin = !hasFrom || birthYear >= min
    const validMax = !hasTo || birthYear <= max
    const match = validMin && validMax

    // 📝 로그 출력
    if (match) {
      console.log(`[필터] 출생년도 일치 ✅ → ${user.nickname} (${birthYear})`)
    } else {
      console.log(`[필터] 출생년도 불일치 ❌ → ${user.nickname} (${birthYear})`)
    }

    return match
  })
}
