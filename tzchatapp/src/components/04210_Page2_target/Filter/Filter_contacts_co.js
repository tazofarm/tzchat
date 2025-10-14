// frontend/utils/Filter_contacts_co.js
// ------------------------------------------------------------
// 연락처 기반 상호 배제 필터 (Disconnect Local Contacts)
// 규칙:
// 1) 내가 OFF → 모든 유저 통과 (연락처 기반 배제 없음)
// 2) 내가 ON  → "내 연락처에 있는 사람"은 검색/노출 모두 제외
// 3) 상호 노출: 상대도 ON 이고, 상대 연락처에 내가 있다면 서로에게 노출되지 않음
//
// 구현 메모:
// - 프런트에 개인정보가 오지 않는 경우가 많으므로, 다음 우선순위로 판별:
//   A) 서버가 내려준 플래그 사용: other.isInMyContacts, other.amInTheirContacts
//   B) 해시 비교: my.localContactHashes vs other.phoneHash, other.localContactHashes vs my.phoneHash
//   C) 위 정보가 없으면 최소한 "내 쪽" 배제만 적용
// - 'ON'/'OFF'/boolean 모두 처리
// ------------------------------------------------------------

/** 'ON'/'OFF'/boolean → boolean */
export function normalizeOn(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').trim().toUpperCase();
  if (s === 'ON') return true;
  if (s === 'OFF') return false;
  return false;
}

/** 안전한 Set 포함 체크 */
function inSet(value, setLike) {
  if (!value) return false;
  if (!setLike) return false;
  if (Array.isArray(setLike)) return setLike.includes(value);
  try {
    // Set 지원
    if (typeof setLike.has === 'function') return setLike.has(value);
  } catch (_) {}
  return false;
}

/**
 * 연락처 상호 배제 필터
 * @param {Array} users              - 후보 유저 목록
 * @param {Object} me                - 내 유저 객체
 *   - me.search_disconnectLocalContacts: 'ON'/'OFF' 또는 boolean
 *   - me.localContactHashes?: string[]   (선택) 내가 가진 연락처 해시 목록
 *   - me.phoneHash?: string             (선택) 내 번호 해시
 * @param {Object} [opt]
 *   - opt.log?: boolean                콘솔 로그
 * @returns {Array}
 */
export function filterByContactsCo(users, me, opt = {}) {
  const log = !!opt.log;

  const myDisconnectOn = normalizeOn(me?.search_disconnectLocalContacts);
  const myHashes = Array.isArray(me?.localContactHashes) ? me.localContactHashes : [];
  const myPhoneHash = me?.phoneHash || null;

  // 내가 OFF면 연락처 기반 배제는 적용하지 않음 → 그대로 반환
  if (!myDisconnectOn) return Array.isArray(users) ? users : [];

  // 내가 ON이면 "내 연락처에 있는 사람"을 제외 + 상호 배제 고려
  return (Array.isArray(users) ? users : []).filter(other => {
    const nickname = other?.nickname ?? '-';

    // 1) 서버 제공 플래그가 있으면 우선 활용
    // - other.isInMyContacts: 상대가 "내 연락처"에 속하는지 (내가 서버에 업로드한 해시 기준)
    // - other.amInTheirContacts: 내가 "상대 연락처"에 있는지
    const flag_isInMyContacts   = other?.isInMyContacts;
    const flag_amInTheirContacts = other?.amInTheirContacts;

    // 2) 해시 비교로 보조 판단
    const otherPhoneHash = other?.phoneHash || null;
    const otherHashes = Array.isArray(other?.localContactHashes) ? other.localContactHashes : [];

    // 내가 ON → 내 연락처에 있는 사람은 제외
    let excludedByMine = false;
    if (typeof flag_isInMyContacts === 'boolean') {
      excludedByMine = flag_isInMyContacts;
    } else {
      // 해시가 있으면 비교
      excludedByMine = inSet(otherPhoneHash, myHashes);
    }

    if (excludedByMine) {
      if (log) console.log(`[연락처필터] ❌ 제외(내 연락처) → ${nickname}`);
      return false;
    }

    // 상호 배제: 상대도 ON이고, 상대 연락처에 내가 있다면 서로 노출되지 않음
    const theirDisconnectOn = normalizeOn(other?.search_disconnectLocalContacts);

    if (theirDisconnectOn) {
      let iAmInTheirContacts = false;
      if (typeof flag_amInTheirContacts === 'boolean') {
        iAmInTheirContacts = flag_amInTheirContacts;
      } else {
        // 상대가 내 해시를 알고 있을 가능성은 낮지만, 정보가 있으면 비교
        iAmInTheirContacts = inSet(myPhoneHash, otherHashes);
      }

      if (iAmInTheirContacts) {
        if (log) console.log(`[연락처필터] ❌ 제외(상대 연락처 보유 & 상대 ON) → ${nickname}`);
        return false;
      }
    }

    // 통과
    if (log) console.log(`[연락처필터] ✅ 통과 → ${nickname}`);
    return true;
  });
}

/*

사용 예시 (target.vue)
import { filterByContactsCo } from '@/utils/Filter_contacts_co'

// me: 로그인 유저 (search_disconnectLocalContacts, localContactHashes, phoneHash 포함 가능)
const afterContacts = filterByContactsCo(users, me, { log: false })


*/