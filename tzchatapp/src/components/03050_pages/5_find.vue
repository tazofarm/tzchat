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
      <div v-if="user">
        <h3 class="section-title">검색설정</h3>

        <!-- ✅ 1. 검색나이 -->
        <SearchSettingYear
          :birthyear1="user.search_birthyear1"
          :birthyear2="user.search_birthyear2"
          @open="openModal('year')"
        />

        <!-- ✅ 2. 검색특징 -->
        <SearchSettingPreference
          :preference="user.search_preference"
          @open="openModal('preference')"
        />

        <!-- ✅ 3. 검색지역 (다중 선택 대응) -->
        <SearchSettingRegion
          :regions="user.search_regions"
          @open="openModal('region')"
          @updated="handleSearchRegions"
        />
      </div>

      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>

      <!-- 🔹 모달 연결 -->
      <Search_year
        v-if="showYearModal"
        :message="user.search_birthyear1 + '~' + user.search_birthyear2"
        @close="showYearModal = false"
        @updated="handleSearchYear"
      />

      <Search_preference
        v-if="showPreferenceModal"
        :message="user.search_preference"
        @close="showPreferenceModal = false"
        @updated="handleSearchPreference"
      />
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'
import {
  IonPage, IonHeader, IonContent, IonButton
} from '@ionic/vue'

import SearchSettingYear from '@/components/04510_Page5_detail/Search_Year_component.vue'
import SearchSettingPreference from '@/components/04510_Page5_detail/Search_Preference_component.vue'
import SearchSettingRegion from '@/components/04510_Page5_detail/Search_Region_component.vue'

import Search_year from '@/components/04510_Page5_detail/Search_Year_Modal.vue'
import Search_preference from '@/components/04510_Page5_detail/Search_Preference_Modal.vue'

const router = useRouter()
const nickname = ref('')
const user = ref(null)

const showYearModal = ref(false)
const showRegionModal = ref(false)
const showPreferenceModal = ref(false)

const openModal = (type) => {
  showYearModal.value = type === 'year'
  showRegionModal.value = type === 'region'
  showPreferenceModal.value = type === 'preference'
  console.log(`[검색설정] ${type} 모달 열기`)
}

const handleSearchYear = (from, to) => {
  if (user.value) {
    user.value.search_birthyear1 = from
    user.value.search_birthyear2 = to
  }
}

const handleSearchPreference = (pref) => {
  if (user.value) {
    user.value.search_preference = pref
  }
}

// ✅ 다중 지역 검색 조건 저장
const handleSearchRegions = async (regionList) => {
  if (!user.value) return

  try {
    const res = await axios.patch('/api/search/regions', {
      regions: regionList
    }, { withCredentials: true })

    user.value.search_regions = res.data.user.search_regions
    console.log('✅ 다중 검색 지역 저장 완료:', user.value.search_regions)
  } catch (err) {
    console.error('❌ 다중 검색 지역 저장 실패:', err)
  }
}

onMounted(async () => {
  try {
    const resUser = await axios.get('/api/me', { withCredentials: true })
    nickname.value = resUser.data.user?.nickname || ''
    user.value = resUser.data.user
    console.log('✅ 사용자 정보 로딩 완료:', user.value)
  } catch (err) {
    console.error('❌ 유저 정보 로딩 실패:', err)
  }
})

const logout = async () => {
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    router.push('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
  }
}
</script>

<style scoped>
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
