<template>
  <div class="top-bar">
    <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
    <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
  </div>

  <div class="ion-padding">
    <div class="emergency-toggle">
      <ion-label class="black-text">Emergency Matching</ion-label>
      <ion-toggle
        :checked="emergencyOn"
        @ionChange="onToggleChange"
        color="danger"
      ></ion-toggle>
      <span class="toggle-label black-text">{{ emergencyOn ? 'ON' : 'OFF' }}</span>
    </div>

    <div v-if="emergencyOn" class="countdown black-text">
      남은 시간: {{ formattedTime }}
    </div>

    <div class="ion-padding ion-text-center">
      <h2 class="black-text">긴급 사용자 목록250810-1</h2>
    </div>

    <ion-list v-if="!isLoading && emergencyUsers.length">
      <ion-item v-for="user in emergencyUsers" :key="user._id">
        <ion-label @click="goToUserProfile(user._id)">
          <h3>{{ user.username }} ({{ user.nickname }})</h3>
          <p>
            출생년도: {{ user.birthyear }} /
            성별:
            {{
              user.gender === 'man' ? '남자'
              : user.gender === 'woman' ? '여자'
              : '미입력'
            }}
          </p>
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-text color="medium" v-else-if="!isLoading && !emergencyUsers.length">
      <p class="ion-text-center">현재 긴급 사용자 없음</p>
    </ion-text>

    <ion-text color="medium" v-else>
      <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
    </ion-text>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'
import {
  IonText, IonList, IonItem, IonLabel, IonButton, IonToggle
} from '@ionic/vue'

// ✅ 필터 모듈 가져오기
import { filterByRegion } from '@/components/04210_Page2_detail/Filter_Region'
import { filterByPreference } from '@/components/04210_Page2_detail/Filter_Preference'
import { filterByYear } from '@/components/04210_Page2_detail/Filter_Year'

const nickname = ref('')
const emergencyOn = ref(false)
const emergencyUsers = ref([])
const isLoading = ref(true)
const remainingSeconds = ref(0)
const currentUser = ref({})
let countdownInterval = null
const router = useRouter()

// ✅ 시간 형식 변환
const formattedTime = computed(() => {
  const sec = remainingSeconds.value
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (sec <= 0) return ''
  if (h > 0) return `${h}시간 ${m}분 ${s}초`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
})

// ✅ 프로필 이동
const goToUserProfile = (userId) => {
  if (!userId) return console.warn('❗ userId 없음')
  router.push(`/home/user/${userId}`)
}

// ✅ 토글 이벤트
const onToggleChange = async (event) => {
  const newState = event.detail.checked
  await updateEmergencyState(newState)
}

// ✅ Emergency 상태 변경
const updateEmergencyState = async (newState) => {
  try {
    const endpoint = newState ? '/api/emergencyon' : '/api/emergencyoff'
    const res = await axios.put(endpoint)

    emergencyOn.value = newState
    console.log(`🚨 Emergency ${newState ? 'ON' : 'OFF'} 응답:`, res.data)

    if (newState) {
      const remaining = res.data.remainingSeconds
      if (remaining > 0) {
        remainingSeconds.value = remaining
        await nextTick()
        setTimeout(() => startCountdown(remaining), 100)
      } else {
        console.warn('❌ 이미 만료됨 → 자동 OFF')
        await updateEmergencyState(false)
      }
    } else {
      clearCountdown()
    }

    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 상태 변경 실패:', err)
    emergencyOn.value = false
    clearCountdown()
  }
}


// ✅ 긴급 사용자 조회 + 필터 적용
const fetchEmergencyUsers = async () => {
  try {
    const res = await axios.get('/api/emergencyusers')
    let users = res.data.users || []

    const me = currentUser.value
    if (!me || !me._id) return

    
    // ✅ 본인 제외 + 필터
    users = users.filter(u => u._id !== me._id)   // ✅ [선택] 자기 자신 제외하고 싶을 때 사용


    users = filterByRegion(users, me.search_regions)
    users = filterByPreference(users, me.gender, me.search_preference)
    users = filterByYear(users, me.search_birthyear1, me.search_birthyear2)

    emergencyUsers.value = users
    console.log('📥 필터링된 긴급 사용자 목록:', users)
  } catch (err) {
    console.error('❌ 목록 로딩 실패:', err)
  }
}

// ✅ 타이머 시작
const startCountdown = (initial) => {
  clearCountdown()
  let localRemaining = initial
  countdownInterval = setInterval(async () => {
    if (localRemaining > 0) {
      localRemaining--
      remainingSeconds.value = localRemaining
    } else {
      console.log('⏱️ 타이머 만료 → 자동 OFF')
      clearCountdown()
      await updateEmergencyState(false)
    }
  }, 1000)
}

// ✅ 타이머 정리
const clearCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval)
  countdownInterval = null
  remainingSeconds.value = 0
}

// ✅ 초기 로딩
onMounted(async () => {
  try {
    const me = (await axios.get('/api/me')).data.user
    currentUser.value = me
    nickname.value = me.nickname
    emergencyOn.value = me.emergency?.isActive === true

    if (emergencyOn.value && me.emergency?.remainingSeconds > 0) {
      remainingSeconds.value = me.emergency.remainingSeconds
      await nextTick()
      setTimeout(() => startCountdown(remainingSeconds.value), 100)
    } else if (emergencyOn.value) {
      await updateEmergencyState(false)
    }

    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 사용자 정보 로딩 실패:', err)
  } finally {
    isLoading.value = false
  }
})

// ✅ 종료 시 타이머 제거
onBeforeUnmount(() => {
  clearCountdown()
})

// ✅ 로그아웃
const logout = async () => {
  try {
    await axios.post('/api/logout')
    router.push('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
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
  color: black;
}
.black-text {
  color: black;
}
.emergency-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #ccc;
}
.toggle-label {
  margin-left: 1rem;
  font-weight: bold;
  color: black;
}
.countdown {
  font-size: 1rem;
  text-align: right;
  margin-bottom: 1rem;
  color: black;
}
</style>
