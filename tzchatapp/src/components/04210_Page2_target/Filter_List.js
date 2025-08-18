// src/components/04210_Page2_target/Filter_List.js
// ======================================================================
// 관계 기반 제외 필터 (friends / pendingSent / pendingRecv / blocks)
// - 목적: 검색 후보(users)에서 "관계로 제외될 유저"를 한 번에 제거
// - 포함 제외 대상:
//   1) 내 친구 리스트 (friends)
//   2) 내가 보낸 친구신청 '대기중' 대상 (pendingSent)
//   3) 내가 받은 친구신청 '대기중' 대상 (pendingRecv)
//   4) 내 차단 리스트 (blocks)
// - 비포함(요청에 따라 제외 X): "나를 차단한 유저"
// ======================================================================

/**
 * 안전하게 id를 문자열로 변환
 * @param {any} v
 * @returns {string|''}
 */
function toId(v) {
  if (!v) return ''
  // 객체({_id}) 형태면 _id 우선 사용
  if (typeof v === 'object' && v._id) return String(v._id)
  return String(v)
}

/**
 * 배열 → Set<string> (유효 id만 모음)
 * @param {Array<any>} arr
 * @returns {Set<string>}
 */
function toIdSet(arr) {
  const s = new Set()
  if (!Array.isArray(arr)) return s
  for (const v of arr) {
    const id = toId(v)
    if (id) s.add(id)
  }
  return s
}

/**
 * friends / pendingSent / pendingRecv / blocks 를 합쳐 exclude Set 생성
 * @param {object} lists
 * @param {Array<any>} [lists.friends]      - 내 친구 배열(문자열 id 또는 객체)
 * @param {Array<any>} [lists.pendingSent]  - 내가 '보낸' 친구신청(대기중) 대상 id 배열
 * @param {Array<any>} [lists.pendingRecv]  - 내가 '받은' 친구신청(대기중) 대상 id 배열
 * @param {Array<any>} [lists.blocks]       - 내가 차단한 대상 id 배열
 * @returns {Set<string>}
 */
export function buildExcludeIdsSet(lists = {}) {
  const friendsSet     = toIdSet(lists.friends)
  const pendingToSet   = toIdSet(lists.pendingSent)
  const pendingFromSet = toIdSet(lists.pendingRecv)
  const blocksSet      = toIdSet(lists.blocks)

  // 합집합
  const exclude = new Set([
    ...friendsSet,
    ...pendingToSet,
    ...pendingFromSet,
    ...blocksSet,
  ])

  // 로깅(상위 몇 개만)
  console.log('[Filter_List] exclude sizes', {
    friends: friendsSet.size,
    pendingSent: pendingToSet.size,
    pendingRecv: pendingFromSet.size,
    blocks: blocksSet.size,
    total: exclude.size,
  })

  return exclude
}

/**
 * 관계 기반 제외 필터: excludeIds 에 포함된 사용자를 제거
 * @param {Array<object>} users
 * @param {Set<string>} excludeIds - buildExcludeIdsSet()로 만들어진 Set
 * @returns {Array<object>}
 */
export function filterByList(users = [], excludeIds) {
  const safe = Array.isArray(users) ? users : []
  if (!(excludeIds instanceof Set) || excludeIds.size === 0) {
    // 제외 조건이 없으면 그대로 반환
    console.log('[Filter_List] excludeIds empty → pass-through:', safe.length)
    return safe
  }

  const before = safe.length
  const result = safe.filter(u => {
    const id = toId(u?._id || u)
    // id가 없으면 방어적으로 제외
    if (!id) return false
    return !excludeIds.has(id)
  })

  console.log(`[Filter_List] filtered: ${result.length}/${before} (excluded=${before - result.length})`)
  return result
}

// 기본 export(선택): 한 번에 처리하고 싶을 때
export default function filterList(users, lists) {
  const exclude = buildExcludeIdsSet(lists)
  return filterByList(users, exclude)
}
