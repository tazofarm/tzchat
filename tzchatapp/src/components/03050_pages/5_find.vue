<!-- src/views/5_find.vue -->
<template>
  <ion-page>
    <!-- 🔹 최상단 인사 + 로그아웃 -->
    <ion-header>
      <div class="top-bar">
        <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
        <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
      </div>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- ✅ 유저 정보가 로드된 경우 -->
      <div v-if="user">
        <h3 class="section-title">검색설정</h3>

        <!-- ✅ 1. 검색나이 (카드 클릭 → 부모에서 모달 오픈) -->
        <SearchSettingYear
          :birthyear1="user.search_birthyear1"
          :birthyear2="user.search_birthyear2"
          @open="openModal('year')"
        />

        <!-- ✅ 2. 검색특징 (카드 클릭 → 부모에서 모달 오픈) -->
        <SearchSettingPreference
          :preference="user.search_preference"
          @open="openModal('preference')"
        />

        <!-- ✅ 3. 검색지역 (카드 클릭 → 부모에서 모달 오픈)
             ⬇️ 변경: @updated를 제거하고 모달에서 저장하도록 통일 -->
        <SearchSettingRegion
          :regions="user.search_regions"
          @open="openModal('region')"
        />
      </div>

      <!-- 🔸 로딩 중 -->
      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>

      <!-- 🔹 모달들 (부모에서 직접 렌더) -->
      <Search_year
        v-if="showYearModal"
        :message="(user?.search_birthyear1 || '') + '~' + (user?.search_birthyear2 || '')"
        @close="closeModal('year')"
        @updated="handleSearchYear"
      />

      <Search_preference
        v-if="showPreferenceModal"
        :message="user?.search_preference || ''"
        @close="closeModal('preference')"
        @updated="handleSearchPreference"
      />

      <!-- ✅ Region 모달 추가: 결과는 @updated로 부모가 저장 처리 -->
      <Search_region
        v-if="showRegionModal"
        :regions="user?.search_regions || []"
        @close="closeModal('region')"
        @updated="handleSearchRegions"
      />
    </ion-content>
  </ion-page>
</template>

<script setup>
/**
 * 5_find.vue
 * - 목표: 3개 카드 + 3개 모달 구조 통일
 *   1) SearchSettingYear        → Search_year (모달)
 *   2) SearchSettingPreference  → Search_preference (모달)
 *   3) SearchSettingRegion      → Search_region (모달)  ← 이번 수정 포인트
 *
 * - 변경 최소 원칙:
 *   · 기존 axios / 라우터 / 스타일 유지
 *   · Region은 카드에서 모달 내장 제거 → 부모에서 모달 렌더
 * - 로그를 최대한 추가하여 동작 추적이 쉽도록 구성
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'
import { IonPage, IonHeader, IonContent, IonButton } from '@ionic/vue'

// 🔸 카드 컴포넌트
import SearchSettingYear from '@/components/04510_Page5_detail/Search_Year_component.vue'
import SearchSettingPreference from '@/components/04510_Page5_detail/Search_Preference_component.vue'
import SearchSettingRegion from '@/components/04510_Page5_detail/Search_Region_component.vue'

// 🔸 모달 컴포넌트
import Search_year from '@/components/04510_Page5_detail/Search_Year_Modal.vue'
import Search_preference from '@/components/04510_Page5_detail/Search_Preference_Modal.vue'
import Search_region from '@/components/04510_Page5_detail/Search_Region_Modal.vue' // ✅ 신규 추가 (부모가 직접 렌더)

const router = useRouter()

// ✅ 화면 표시용 상태
const nickname = ref('')
const user = ref(null)

// ✅ 모달 표시 상태
const showYearModal = ref(false)
const showRegionModal = ref(false)
const showPreferenceModal = ref(false)

/** ✅ 공통: 모달 열기 */
const openModal = (type) => {
  showYearModal.value = type === 'year'
  showRegionModal.value = type === 'region'
  showPreferenceModal.value = type === 'preference'
  console.log(`[5_find] ▶ 모달 열기 요청: ${type}`, {
    showYearModal: showYearModal.value,
    showRegionModal: showRegionModal.value,
    showPreferenceModal: showPreferenceModal.value
  })
}

/** ✅ 공통: 모달 닫기 */
const closeModal = (type) => {
  if (type === 'year') showYearModal.value = false
  else if (type === 'region') showRegionModal.value = false
  else if (type === 'preference') showPreferenceModal.value = false

  console.log(`[5_find] ▶ 모달 닫기: ${type}`, {
    showYearModal: showYearModal.value,
    showRegionModal: showRegionModal.value,
    showPreferenceModal: showPreferenceModal.value
  })
}

/** ✅ 나이 수정 결과 반영 (부모 메모리 업데이트만) */
const handleSearchYear = (from, to) => {
  if (!user.value) return
  user.value.search_birthyear1 = from
  user.value.search_birthyear2 = to
  console.log('[5_find] ✅ 검색나이 반영 완료:', {
    from: user.value.search_birthyear1,
    to: user.value.search_birthyear2
  })
}

/** ✅ 특징 수정 결과 반영 (부모 메모리 업데이트만) */
const handleSearchPreference = (pref) => {
  if (!user.value) return
  user.value.search_preference = pref
  console.log('[5_find] ✅ 검색특징 반영 완료:', { preference: user.value.search_preference })
}

/** ✅ 지역 수정 저장 (서버 PATCH) — 결과로 user.search_regions 갱신 */
const handleSearchRegions = async (regionList) => {
  if (!user.value) return
  console.log('[5_find] ▶ 다중 검색 지역 저장 요청:', regionList)

  try {
    const res = await axios.patch(
      '/api/search/regions',
      { regions: regionList },
      { withCredentials: true }
    )
    // 서버에서 최신 user 반환한다고 가정
    user.value.search_regions = res.data.user.search_regions
    console.log('✅ [5_find] 다중 검색 지역 저장 완료:', user.value.search_regions)
  } catch (err) {
    console.error('❌ [5_find] 다중 검색 지역 저장 실패:', err)
  }
}

/** ✅ 유저 정보 로딩 */
onMounted(async () => {
  try {
    console.log('[5_find] ▶ 사용자 정보 로딩 시작')
    const resUser = await axios.get('/api/me', { withCredentials: true })
    nickname.value = resUser.data.user?.nickname || ''
    user.value = resUser.data.user
    console.log('✅ [5_find] 사용자 정보 로딩 완료:', user.value)
  } catch (err) {
    console.error('❌ [5_find] 유저 정보 로딩 실패:', err)
  }
})

/** ✅ 로그아웃 */
const logout = async () => {
  try {
    console.log('[5_find] ▶ 로그아웃 요청')
    await axios.post('/api/logout', {}, { withCredentials: true })
    console.log('✅ [5_find] 로그아웃 성공 → /login 이동')
    router.push('/login')
  } catch (err) {
    console.error('❌ [5_find] 로그아웃 실패:', err)
  }
}
</script>

<style scoped>
/* ✅ 기본 글씨는 검정(가독성) */
* { color: #000; }

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0rem;
  background-color: #f1f1f1;
  font-size: 0.95rem;
  border-bottom: 1px solid #ccc;
}
.welcome-text {
  font-weight: bold;
  color: #000;
}
.section-title {
  font-size: 1rem;
  font-weight: bold;
  margin-bottom: 0.8rem;
  color: #000;
}
.loading-text {
  color: #999;
  text-align: center;
}
</style>
