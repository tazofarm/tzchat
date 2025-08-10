<template>
  <!-- ✅ Ionic 레이아웃 차이 제거: IonPage/IonContent 래퍼로 dev/prod 동일화 -->
  <ion-page>
    <ion-content>

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
          <h2 class="black-text">긴급 사용자 목록2</h2>
        </div>

        <!-- ✅ 목록: dev/prod 포커스/터치 일관성 위해 IonItem을 버튼으로 -->
        <ion-list v-if="!isLoading && emergencyUsers.length">
          <ion-item
            v-for="user in emergencyUsers"
            :key="user._id"
            :button="true"
            :detail="true"
            @click="goToUserProfile(user._id)"
          >
            <ion-label class="black-text">
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

    </ion-content>
  </ion-page>
</template>

<script setup>
// ⚠️ 변경 요청 이외는 최대한 유지. dev/prod 동일화에 필요한 최소 수정 + 주석/로그 강화
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'
import {
  IonPage, IonContent,           // ✅ 실제 사용 (레이아웃 동일화)
  IonText, IonList, IonItem, IonLabel, IonButton, IonToggle
} from '@ionic/vue'

// ✅ 필터 모듈 (기존 유지)
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

// ✅ 디버그: 빌드 환경/엔드포인트 표시 (dev/prod 차이 추적)
console.log('[BUILD INFO]', {
  MODE: import.meta.env.MODE,
  BASE: import.meta.env.BASE_URL,
  API: import.meta.env.VITE_API_URL
})

// ✅ 시간 형식 변환 (기존 유지)
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

// ✅ 프로필 이동 (기존 유지 + 로그)
const goToUserProfile = (userId) => {
  if (!userId) return console.warn('❗ userId 없음')
  console.log('➡️ 사용자 프로필 페이지로 이동:', userId)
  router.push(`/home/user/${userId}`)
}

// ✅ 토글 이벤트 (기존 유지)
const onToggleChange = async (event) => {
  const newState = event.detail.checked
  await updateEmergencyState(newState)
}

// ✅ Emergency 상태 변경 (세션 쿠키 사용 → withCredentials 통일)
const updateEmergencyState = async (newState) => {
  try {
    const endpoint = newState ? '/api/emergencyon' : '/api/emergencyoff'
    const res = await axios.put(endpoint, {}, { withCredentials: true }) // ✅ 통일

    emergencyOn.value = newState
    console.log(`🚨 Emergency ${newState ? 'ON' : 'OFF'} 응답:`, res.data)

    if (newState) {
      const remaining = res.data.remainingSeconds
      if (remaining > 0) {
        remainingSeconds.value = remaining
        await nextTick()
        setTimeout(() => startCountdown(remaining), 100) // 렌더 후 안전 시작
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

// ✅ 긴급 사용자 조회 + 필터 적용 (세션 API → withCredentials 통일)
const fetchEmergencyUsers = async () => {
  console.time('[LOAD] /api/emergencyusers')
  try {
    const res = await axios.get('/api/emergencyusers', { withCredentials: true }) // ✅ 통일
    let users = res.data?.users || []

    const me = currentUser.value
    if (!me || !me._id) {
      console.warn('⚠️ 현재 사용자 정보 없음 → 필터 스킵')
      return
    }

    // ✅ 본인 제외 (기존 주석 유지)
    users = users.filter(u => u._id !== me._id)

    // ✅ 필터 적용 (방어적 처리)
    users = filterByRegion(users, me.search_regions) || []
    users = filterByPreference(users, me.gender, me.search_preference) || []
    users = filterByYear(users, me.search_birthyear1, me.search_birthyear2) || []

    emergencyUsers.value = users
    console.log('📥 필터링된 긴급 사용자 목록:', users)
  } catch (err) {
    console.error('❌ 목록 로딩 실패:', err)
  } finally {
    console.timeEnd('[LOAD] /api/emergencyusers')
  }
}

// ✅ 타이머 시작 (기존 유지)
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

// ✅ 타이머 정리 (기존 유지)
const clearCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval)
  countdownInterval = null
  remainingSeconds.value = 0
}

// ✅ 초기 로딩 (세션 API → withCredentials 통일)
onMounted(async () => {
  console.time('[LOAD] /api/me')
  try {
    const me = (await axios.get('/api/me', { withCredentials: true })).data.user // ✅ 통일
    currentUser.value = me
    nickname.value = me?.nickname || ''
    emergencyOn.value = me?.emergency?.isActive === true

    if (emergencyOn.value && me?.emergency?.remainingSeconds > 0) {
      remainingSeconds.value = me.emergency.remainingSeconds
      await nextTick()
      setTimeout(() => startCountdown(remainingSeconds.value), 100)
    } else if (emergencyOn.value) {
      // 서버가 isActive=true지만 남은 시간이 없으면 OFF로 정합성 맞춤
      await updateEmergencyState(false)
    }

    await fetchEmergencyUsers()
  } catch (err) {
    console.error('❌ 사용자 정보 로딩 실패:', err)
  } finally {
    console.timeEnd('[LOAD] /api/me')
    isLoading.value = false
  }
})

// ✅ 종료 시 타이머 제거 (기존 유지)
onBeforeUnmount(() => {
  clearCountdown()
})

// ✅ 로그아웃 (세션 API → withCredentials 통일, replace로 히스토리 정리)
const logout = async () => {
  console.log('➡️ 로그아웃 시도')
  try {
    await axios.post('/api/logout', {}, { withCredentials: true }) // ✅ 통일
    console.log('✅ 로그아웃 성공 → /login 이동')
    router.replace('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
  }
}
</script>

<style scoped>
/* 요청: 가독성 위해 기본 글씨 검정 유지 (dev/prod 동일하게 보이도록 명시) */
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
.welcome-text { font-weight: bold; color: black; }
.black-text { color: black; }
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
