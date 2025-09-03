<template>
  <!-- ⚠️ Ionic 레이아웃 일치성: IonPage/IonContent 래퍼 필수 -->
  <ion-page>
    <ion-content>
      <!-- 🔹 회원 목록 제목 -->
      <div class="ion-padding ion-text-center">
        <h2 class="black-text">회원 목록</h2>
      </div>

      <!-- ✅ 로딩 상태 -->
      <ion-text v-if="loading" color="medium">
        <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
      </ion-text>

      <!-- ✅ 에러 상태 -->
      <ion-text v-else-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- 🔹 사용자 리스트 -->
      <ion-list v-else-if="users.length">
        <!-- IonItem을 버튼으로: dev/prod 터치/포커스 일치 -->
        <ion-item
          v-for="user in users"
          :key="user._id"
          :button="true"
          :detail="true"
          @click="goToUserProfile(user._id)"
        >
          <ion-label class="black-text">
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

      <!-- 🔸 빈 목록 -->
      <ion-text v-else color="medium">
        <p class="ion-text-center">표시할 사용자가 없습니다.</p>
      </ion-text>
    </ion-content>
  </ion-page>
</template>

<script setup>
// ⚠️ 가독성 + 유지보수: 주석 및 로그 최대화
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance' // 공통 인스턴스( baseURL = <origin>/api, withCredentials = true )
import { refreshSocketAuth, disconnectSocket } from '@/lib/socket' // JWT 갱신/종료 (옵션)

// Ionic 컴포넌트 (import만 하고 안 쓰면 트리쉐이킹/타입 경고 가능)
import {
  IonPage, IonContent,
  IonList, IonItem, IonLabel,
  IonText, IonButton
} from '@ionic/vue'

const router = useRouter()

// 🔸 상태 정의
const users = ref([])               // 전체 사용자 목록
const nickname = ref('')            // 내 닉네임
const loading = ref(true)           // 로딩 플래그(로딩/빈 상태 구분)
const errorMessage = ref('')        // 사용자 메시지용 에러

// 🔧 공통 디버그: 빌드 환경/엔드포인트 확인 (dev/prod 동일화 점검)
console.log('[UI]', {
  mode: import.meta.env.MODE,
  base: import.meta.env.BASE_URL,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
})

// 🔹 유저 목록 + 내 정보 불러오기
onMounted(async () => {
  console.time('[LOAD] GET /users')
  console.time('[LOAD] GET /me')

  try {
    // ✅ 공통 axios 인스턴스 사용: baseURL이 이미 /api 이므로 경로는 '/users'
    const resUsers = await axios.get('/users')
    users.value = Array.isArray(resUsers.data?.users) ? resUsers.data.users : []
    console.log('[HTTP][OK]', { path: '/users', count: users.value.length })
  } catch (error) {
    console.error('[HTTP][ERR]', { path: '/users', message: error?.message, status: error?.response?.status })
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  } finally {
    console.timeEnd('[LOAD] GET /users')
  }

  try {
    const resMe = await axios.get('/me')
    nickname.value = resMe.data?.user?.nickname || ''
    console.log('[HTTP][OK]', { path: '/me', nickname: nickname.value })
  } catch (error) {
    console.error('[HTTP][ERR]', { path: '/me', message: error?.message, status: error?.response?.status })
    // 닉네임 실패는 치명적이지 않으므로 메시지는 생략하고 로그만 남김
  } finally {
    console.timeEnd('[LOAD] GET /me')
    loading.value = false
  }
})

// 🔹 로그아웃
const logout = async () => {
  console.log('[UI] 로그아웃 시도')
  try {
    // ✅ baseURL=/api → 경로는 '/logout'
    await axios.post('/logout')
    // 로컬 JWT 토큰이 있다면 정리(앱/WebView 대응)
    try {
      localStorage.removeItem('TZCHAT_AUTH_TOKEN')
      refreshSocketAuth()
      disconnectSocket()
    } catch {}
    console.log('[UI] 로그아웃 성공 → /login 이동')
    router.replace('/login') // replace로 히스토리 정리
  } catch (err) {
    console.error('[HTTP][ERR]', { path: '/logout', message: err?.message, status: err?.response?.status })
    errorMessage.value = '로그아웃에 실패했습니다.'
  }
}

// ✅ 유저 클릭 시 페이지로 이동
const goToUserProfile = (userId) => {
  if (!userId) {
    console.warn('[UI] 유효하지 않은 userId:', userId)
    return
  }
  console.log('[UI] 사용자 프로필 페이지로 이동:', userId)
  router.push(`/home/user/${userId}`)
}
</script>

<style scoped>
/* ✅ Users Page - CSS만 보정(구조/JS 불변)
   - 텍스트: 기본 검정 유지
   - 상단바: 높이/간격 정리, 작은 화면에서도 줄바꿈 안전
   - 리스트: 아이템 간격/폰트/분리선, 터치 타깃 강화
   - Ion 컴포넌트 배경/텍스트 고정(라이트), 안전영역/스크롤 안정성
*/

/* 이 컴포넌트 범위에서 Ion 배경/텍스트를 명시적으로 고정 */
ion-content {
  --background: #ffffff;
  color: #000000;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: contain; /* 바운스 체인 방지 */
}

/* ===== 상단 바 ===== */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 10px 12px;            /* 상하 10~12px 권장 */
  background-color: #f6f6f6;
  border-bottom: 1px solid #e5e5e5;
  gap: 10px;
}
.welcome-text {
  font-weight: 700;
  color: #000;
  font-size: clamp(15px, 2.6vw, 16px);
  white-space: nowrap;            /* 너무 길면 말줄임 */
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 메인 타이틀(h2) */
h2.black-text {
  color: #000;
  font-size: clamp(18px, 4.5vw, 22px);
  font-weight: 700;
  margin: 10px 0 6px;
  line-height: 1.25;
}

/* ===== 리스트 컨테이너 ===== */
ion-list {
  background: #fff;
  margin: 8px 8px 14px;
  border-radius: 12px;
  overflow: hidden;               /* 둥근 모서리 내부로 자르기 */
  border: 1px solid #eee;
}

/* ===== 리스트 아이템 ===== */
ion-item {
  --inner-border-width: 0 0 1px 0;       /* 아래쪽 1px 라인 */
  --inner-border-color: #eee;
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 56px;                    /* 터치 타깃 충분히 */
  color: #000;
}
ion-item:last-of-type {
  --inner-border-width: 0;
}

/* 라벨 내부 텍스트 스케일: 라벨=16~17, 보조=14~15 */
ion-item ion-label.black-text h3 {
  color: #000;
  font-size: clamp(15px, 2.6vw, 16px);
  font-weight: 700;
  margin: 0 0 4px;
  line-height: 1.3;
  word-break: break-word;
}
ion-item ion-label.black-text p {
  color: #333;
  font-size: clamp(14px, 2.4vw, 15px);
  margin: 0;
  line-height: 1.35;
  word-break: break-word;
}

/* 빈 상태/로딩 상태 텍스트 */
ion-text p.ion-text-center {
  margin: 12px 0;
  font-size: clamp(15px, 2.6vw, 16px);
  color: #555;
}

/* 포커스 접근성(:focus-visible) */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
  border-radius: 8px;
}

/* 초소형 화면(≤360px)에서 여백 약간 축소 */
@media (max-width: 360px) {
  .top-bar { padding: 8px 10px; gap: 8px; }
  ion-list { margin: 6px; }
}
</style>
