// components/target_Filter/preferenceFilter.js

/**
 * 이성친구 조건 필터링
 * 
 * - '이성친구 - 전체': 나와 성별이 다른 사용자만
 * - '이성친구 - 특수': 나의 search_preference와 같은 값을 가진 사용자만
 * 
 * @param {Array} users - 전체 사용자 리스트
 * @param {String} myGender - 현재 로그인한 사용자의 성별
 * @param {String} mySearchPreference - 현재 로그인한 사용자의 search_preference
 * @returns {Array} 필터링된 사용자 리스트
 */
export function filterByPreference(users, myGender, mySearchPreference) {
  // 🔹 '이성친구 - 전체': 성별이 다른 유저만
  if (mySearchPreference === '이성친구 - 전체') {
    const oppositeGender = myGender === 'man' ? 'woman' : 'man'
    console.log('[필터] 조건: 이성친구 - 전체 → 성별 반대 필터')
    return users.filter(user => user.gender === oppositeGender)
  }

  // 🔹 '이성친구 - 특수': 나의 search_preference와 일치하는 유저만
  if (mySearchPreference === '이성친구 - 특수') {
    console.log('[필터] 조건: 이성친구 - 특수 → search_preference 일치 필터')
    return users.filter(user => user.search_preference === mySearchPreference)
  }

  // 🔸 필터 조건 없을 경우 전체 반환
  return users
}
