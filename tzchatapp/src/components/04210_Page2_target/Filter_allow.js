// utils/searchFilters.js
// ===================================================================
// 친구 신청 허용(ON/OFF) 기반 검색 필터
// - 저장소: localStorage['tzchat_allowFriendRequest']
// - 기본값: ON(true) → 그대로 통과
// - OFF(false) → "검색에서 제외" 요구에 따라 결과를 빈 배열로 반환
// - 연동: 다른 화면(검색 필터 등)에서 이 함수를 호출해 전체 결과를 걸러 주세요
// ===================================================================

/** 로컬스토리지 키(공용) */
export const LS_KEY_ALLOW_FRIEND_REQUEST = 'tzchat_allowFriendRequest'

/**
 * 로컬스토리지에서 "친구 신청 허용" 플래그를 읽음
 * - 저장이 없거나 에러면 기본값 true 반환
 * @returns {boolean}
 */
export function readAllowFriendRequest () {
  try {
    const raw = localStorage.getItem(LS_KEY_ALLOW_FRIEND_REQUEST)
    if (raw === null) {
      console.info(`[친구허용] 로컬 키 없음 → 기본값(true) 사용`)
      return true
    }
    const val = JSON.parse(raw)
    const ok = (typeof val === 'boolean') ? val : Boolean(val)
    console.info(`[친구허용] 로컬 로드: ${ok}`)
    return ok
  } catch (e) {
    console.error('[친구허용] 로컬 로드 실패 → 기본값(true) 사용:', e)
    return true
  }
}

/**
 * (옵션) 로컬스토리지에 "친구 신청 허용" 값을 저장
 * @param {boolean} next
 */
export function writeAllowFriendRequest (next) {
  try {
    localStorage.setItem(LS_KEY_ALLOW_FRIEND_REQUEST, JSON.stringify(Boolean(next)))
    console.info(`[친구허용] 로컬 저장: ${next}`)
  } catch (e) {
    console.error('[친구허용] 로컬 저장 실패:', e)
  }
}

/**
 * ✅ 친구 신청 허용 필터
 *
 * 동작:
 * - allowFriendRequest === true  → 전체 통과 (검색에 포함)
 * - allowFriendRequest === false → 전체 제외 (검색에서 제외) → 빈 배열 반환
 *
 * 참고:
 * - 이 필터는 **현재 사용자(나)** 의 공개 여부를 결정하는 용도입니다.
 * - "OFF면 검색에서 제외" 요구에 맞춰, 클라이언트 검색 결과를 **아예 비우는** 방식으로 구현했습니다.
 *   (즉, 본 클라이언트에서 검색을 수행하지 않거나, 서버 요청 전에 차단하는 흐름으로 쓰세요)
 *
 * @param {Array} users - 기존 검색 결과(그대로 통과/전부 제외 대상)
 * @param {boolean|null} allowFlagOpt - (선택) 외부에서 강제로 ON/OFF를 넘기고 싶을 때
 * @returns {Array} 필터링된 결과
 */
export function filterByFriendRequestPermission (users, allowFlagOpt = null) {
  // 🟢 현재 설정값 로드 (우선순위: 인자 → localStorage → 기본 true)
  const allowFlag = (allowFlagOpt === null || allowFlagOpt === undefined)
    ? readAllowFriendRequest()
    : Boolean(allowFlagOpt)

  console.log(`[필터-친구허용] allowFriendRequest=${allowFlag}`)

  // ✅ ON: 그대로 통과
  if (allowFlag === true) {
    console.log(`[필터-친구허용] ✅ 검색 포함 → ${Array.isArray(users) ? users.length : 0}건 통과`)
    return Array.isArray(users) ? users : []
  }

  // ❌ OFF: 검색에서 제외 → 빈 배열
  console.warn('[필터-친구허용] ❌ 검색 제외 설정 감지 → 결과 비움([]) 반환')
  return []
}
