<template>
  <!-- 상단 바 -->
  <div class="top-bar">
    <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
    <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
  </div>

  <!-- 회원 목록 -->
  <div class="ion-padding ion-text-center">
    <h2 class="black-text">회원 목록</h2>
  </div>

  <ion-list v-if="!isLoading && users.length">
    <ion-item
      v-for="user in users"
      :key="user._id"
      @click="goToUserProfile(user._id)"
    >
      <ion-label>
        <h3>{{ user.username }} ({{ user.nickname }})</h3>
        <p>
          출생년도: {{ user.birthyear }} /
          성별: {{ user.gender === 'man' ? '남자' : '여자' }} /
          지역: {{ user.region1 }} / {{ user.region2 }}
        </p>
        <p>성향: {{ user.preference }}</p>
      </ion-label>
    </ion-item>
  </ion-list>

  <ion-text color="medium" v-else-if="!isLoading && !users.length">
    <p class="ion-text-center">조건에 맞는 사용자가 없습니다.</p>
  </ion-text>

  <ion-text color="medium" v-else>
    <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
  </ion-text>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'

import {
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonButton
} from '@ionic/vue'

import { filterByPreference } from '@/components/04210_Page2_detail/Filter_Preference'
import { filterByYear } from '@/components/04210_Page2_detail/Filter_Year'

// ✅ 다중 지역 필터 유틸 (직접 포함)
function filterByRegion(users, regionList) {
  // '전체' 포함 → 모두 통과
  if (
    !Array.isArray(regionList) ||
    regionList.length === 0 ||
    regionList.some(r => r.region1 === '전체')
  ) {
    console.log('[필터] 전체 지역 허용됨 → 전체 사용자 반환')
    return users
  }

  return users.filter(user => {
    return regionList.some(cond => {
      if (cond.region2 === '전체') {
        return user.region1 === cond.region1
      }
      return user.region1 === cond.region1 && user.region2 === cond.region2
    })
  })
}

const users = ref([])
const nickname = ref('')
const currentUser = ref({})
const myFriendIds = ref([])
const isLoading = ref(true)

const router = useRouter()

const goToUserProfile = (userId) => {
  if (!userId) return console.warn('❗ userId 없음')
  console.log('➡️ 유저 프로필 페이지 이동:', userId)
  router.push(`/home/user/${userId}`)
}

// ✅ 친구 목록 가져오기
const fetchMyFriends = async () => {
  try {
    const res = await axios.get('/api/my-friends', { withCredentials: true })
    myFriendIds.value = res.data.friendIds || []
    console.log('🟩 내 친구 목록:', myFriendIds.value)
  } catch (e) {
    console.error('❌ 친구 목록 로딩 실패:', e)
  }
}

// ✅ 조건 필터 적용
const applyUserFilters = (users, me) => {
  let filtered = users.filter(u => u._id !== me._id)
  filtered = filterByRegion(filtered, me.search_regions)
  filtered = filterByPreference(filtered, me.gender, me.search_preference)
  filtered = filterByYear(filtered, me.search_birthyear1, me.search_birthyear2)
  return filtered
}

// ✅ 초기 로딩
onMounted(async () => {
  try {
    const me = (await axios.get('/api/me', { withCredentials: true })).data.user
    currentUser.value = me
    nickname.value = me.nickname
    console.log('✅ 사용자 정보 로딩 완료:', me)

    const regionFilter = me.search_regions || []
    const res = await axios.post('/api/search/users', {
      regions: regionFilter
    }, { withCredentials: true })

    users.value = applyUserFilters(res.data, me)
    await fetchMyFriends()
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', e)
  } finally {
    isLoading.value = false
  }
})

// ✅ 로그아웃
const logout = async () => {
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    router.push('/login')
  } catch (e) {
    console.error('❌ 로그아웃 실패:', e)
  }
}
</script>

<style scoped>
h3 {
  color: black;
  margin-bottom: 1rem;
}
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
.black-text {
  color: black;
}
</style>
