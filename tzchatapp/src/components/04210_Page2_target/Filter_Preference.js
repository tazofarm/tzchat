// components/target_Filter/preferenceFilter.js

/**
 * 대상 친구 필터링
 *
 * ✅ 최종 규칙 요약 (요청하신 사양으로 수정)
 * 1) 이성친구 - 전체:           나와 '반대' 성별
 * 2) 이성친구 - 일반/특수:       나와 '반대' 성별  AND  (나의.search_preference === 상대의 preference)
 * 3) 동성친구 - 전체:           나와 '같은' 성별
 * 4) 동성친구 - 일반/특수:       나와 '같은' 성별  AND  (나의.search_preference === 상대의 preference)
 *
 * @param {Array<object>} users - 전체 사용자 리스트
 *   - 각 user는 최소한 { gender: 'man'|'woman', preference?: string, search_preference?: string } 형태를 가정
 *     (주의) 여기서 비교에 쓰는 값은 상대의 "preference" 입니다.
 * @param {'man'|'woman'} myGender - 내 성별
 * @param {string} selectedPreference - 화면에서 사용자가 고른 필터(이성/동성 + 전체/일반/특수)
 *   - '', '이성친구 - 전체'|'이성친구 - 일반'|'이성친구 - 특수'|
 *      '동성친구 - 전체'|'동성친구 - 일반'|'동성친구 - 특수'
 * @param {string} [mySearchPreference] - 내 프로필의 "검색 선호" 값 (DB: user.search_preference)
 *   - 비교 대상: 상대의 user.preference
 *   - 미전달 시(레거시 호환) selectedPreference를 대신 사용하지만, 정확한 매칭을 위해 전달 권장
 * @returns {Array<object>} 필터링된 사용자 리스트
 */
export function filterByPreference(
  users = [],
  myGender,
  selectedPreference,
  mySearchPreference // ✅ 신규
) {
  // ---------- 안전 가드 & 입력 정규화 ----------
  const safeUsers = Array.isArray(users) ? users : [];
  const pref = (selectedPreference || '').trim();
  const me = (myGender === 'man' || myGender === 'woman') ? myGender : null;

  // 내 검색 선호 값: 명시적으로 들어오면 그걸 사용, 아니면 레거시 호환으로 selectedPreference 사용
  const mySearchPref = (mySearchPreference ?? selectedPreference ?? '').trim();

  console.log('🔎[preferenceFilter] 입력 요약:', {
    totalUsers: safeUsers.length,
    myGender: me,
    selectedPreference: pref,
    mySearchPreference: mySearchPref,
  });

  if (!me) {
    console.warn('⛔[preferenceFilter] myGender가 유효하지 않습니다:', myGender);
    return safeUsers;
  }
  if (!pref) {
    console.log('ℹ️[preferenceFilter] selectedPreference 비어있음 → 필터 없이 전체 반환');
    return safeUsers;
  }

  // ---------- 선택값 파싱: 이성/동성 + 전체/일반/특수 ----------
  const isOpposite = pref.startsWith('이성친구'); // 이성친구-계열?
  const isSame     = pref.startsWith('동성친구'); // 동성친구-계열?
  const isAll      = pref.endsWith('전체');       // 전체?
  const isNormal   = pref.endsWith('일반');       // 일반?
  const isSpecial  = pref.endsWith('특수');       // 특수?

  if (!isOpposite && !isSame) {
    console.warn('⚠️[preferenceFilter] 알 수 없는 카테고리:', pref, '→ 전체 반환');
    return safeUsers;
  }

  // ---------- 성별 비교 헬퍼 ----------
  const isOppositeGender = (g) => (me === 'man' ? g === 'woman' : g === 'man');
  const isSameGender     = (g) => g === me;

  // ---------- 1차: 성별 필터 ----------
  let genderFiltered = safeUsers.filter(u => {
    const ug = u?.gender;
    if (isOpposite) return isOppositeGender(ug);
    if (isSame)     return isSameGender(ug);
    return true; // 방어적 코드
  });

  console.log(`✅[preferenceFilter] 1차 성별 필터(${pref}) 결과: ${genderFiltered.length}/${safeUsers.length}`);

  // ---------- 2차: 세부 옵션 처리 ----------
  if (isAll) {
    // 전체는 성별만 맞으면 끝
    console.log('ℹ️[preferenceFilter] 세부옵션=전체 → 성별 필터 결과 반환');
    return genderFiltered;
  }

  // 일반/특수: "내 검색 선호(mySearchPreference) === 상대의 preference" 비교
  if (isNormal || isSpecial) {
    // 내 검색 선호 값이 비어있으면 매칭할 수 없으므로 성별 필터만 유지
    if (!mySearchPref) {
      console.warn('⚠️[preferenceFilter] 내 검색 선호(mySearchPreference)가 비어있음 → 성별 필터만 적용하여 반환');
      return genderFiltered;
    }

    // 비교 대상은 상대의 "preference"
    const want = mySearchPref;
    const refined = genderFiltered.filter(u => {
      const otherPref = (u?.preference || '').trim();
      const matched = otherPref === want;

      // 상세 로깅(필요 시 주석 해제)
      // console.debug('… 비교:', { otherPref, want, matched, userId: u?._id });

      return matched;
    });

    console.log(`✅[preferenceFilter] 2차(일반/특수) 비교: (my.search_preference === other.preference) → ${refined.length}/${genderFiltered.length}`, {
      mySearchPreference: want,
    });

    return refined;
  }

  // 혹시 모르는 분기: 정의되지 않은 세부옵션이면 1차 결과 반환
  console.warn('⚠️[preferenceFilter] 정의되지 않은 세부옵션 처리:', pref, '→ 성별 필터 결과 반환');
  return genderFiltered;
}
