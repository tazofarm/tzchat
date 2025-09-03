<template>
  <!-- ⚠️ Ionic 레이아웃 일치성: IonPage/IonContent 래퍼 필수 -->
  <ion-page>
    <ion-content>

      <!-- 🔹 화면 제목(라이트 배경) -->
      <div class="ion-padding ion-text-center">
        <h2 class="black-text">회원 스와이프</h2>
        <p class="desc">카드를 좌/우로 스와이프하여 살펴보세요</p>
      </div>

      <!-- ✅ 로딩 상태 -->
      <ion-text v-if="loading" color="medium">
        <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
      </ion-text>

      <!-- ✅ 에러 상태 -->
      <ion-text v-else-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- 🔹 스와이프 카드 영역 -->
      <div v-else-if="users.length" class="swiper-area">
        <!-- Swiper 카드 스택 -->
        <swiper
          class="user-cards"
          :modules="swiperModules"
          effect="cards"
          :grab-cursor="true"
          :loop="false"
          @swiper="onSwiperReady"
          @slideChange="onSlideChange"
        >
          <!-- 개별 사용자 카드 -->
          <swiper-slide
            v-for="(user, idx) in users"
            :key="user._id || idx"
            @click="onCardTap(user)"
          >
            <div class="card" aria-label="사용자 카드">
              <div class="card-header">
                <!-- ⚠️ 카드 내부는 어두운 배경이므로 black-text 클래스 사용 금지 -->
                <h3>
                  {{ user.username }}
                  <span class="nick">({{ user.nickname }})</span>
                </h3>
                <p class="meta">
                  출생년도: {{ user.birthyear || '미입력' }} ·
                  성별: {{ user.gender === 'man' ? '남자' : '여자' }}
                </p>
                <p class="meta">
                  지역: {{ user.region1 || '미입력' }} / {{ user.region2 || '미입력' }}
                </p>
              </div>

              <!-- 썸네일/이미지 영역: 실제 이미지가 있다면 교체 -->
              <div class="thumb" role="img" aria-label="사용자 이미지(샘플)">
                <div class="thumb-fallback">NO IMAGE</div>
              </div>

              <div class="card-body">
                <p class="pref">
                  성향: {{ user.preference || '미입력' }}
                </p>
              </div>
            </div>
          </swiper-slide>
        </swiper>

        <!-- 🔘 하단 액션 버튼 (접근성/테스트용) -->
        <div class="action-bar" role="group" aria-label="카드 액션">
          <ion-button fill="outline" color="medium" @click="skipCard">
            건너뛰기
          </ion-button>
          <ion-button fill="solid" color="dark" @click="openProfile">
            프로필
          </ion-button>
          <ion-button fill="solid" color="warning" @click="likeCard">
            관심
          </ion-button>
        </div>

        <!-- 진행 상태 -->
        <div class="progress" aria-live="polite">
          {{ currentIndex + 1 }} / {{ users.length }}
        </div>
      </div>

      <!-- 🔸 빈 목록 -->
      <ion-text v-else color="medium">
        <p class="ion-text-center">표시할 사용자가 없습니다.</p>
      </ion-text>

    </ion-content>
  </ion-page>
</template>

<script setup>
// ------------------------------------------------------
// Swipe Users Page (Tinder-like)
// - 기능/데이터 로딩/라우팅 로직은 유지
// - 카드 내부 색상만 다크(블랙) + 텍스트 화이트로 변경
// - API 호출을 공통 인스턴스(api)로 통일(/api 포함 baseURL)
// ------------------------------------------------------
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'

// Ionic
import {
  IonPage, IonContent,
  IonText, IonButton
} from '@ionic/vue'

// Swiper
import { Swiper as SwiperCore } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'

const swiperModules = [EffectCards]

const router = useRouter()

// 🔸 상태
const users = ref([])               // 전체 사용자 목록
const nickname = ref('')            // 내 닉네임
const loading = ref(true)           // 로딩 플래그
const errorMessage = ref('')        // 사용자 메시지용 에러
const currentIndex = ref(0)         // 현재 카드 인덱스 (UI 표시용)
const swiperRef = ref(null)         // Swiper 인스턴스 참조

// 🔧 공통 디버그: 빌드 환경 확인
console.log('[BUILD INFO]', {
  MODE: import.meta.env.MODE,
  BASE: import.meta.env.BASE_URL
})

// 🔹 유저 목록 + 내 정보 불러오기 (기존 로직 유지)
onMounted(async () => {
  console.time('[LOAD] GET /users')
  console.time('[LOAD] GET /me')

  try {
    const resUsers = await api.get('/users')
    users.value = Array.isArray(resUsers.data?.users) ? resUsers.data.users : []
    console.log('✅ /users OK, count:', users.value.length)
  } catch (error) {
    console.error('❌ 유저 목록 불러오기 실패:', error)
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  } finally {
    console.timeEnd('[LOAD] GET /users')
  }

  try {
    const resMe = await api.get('/me')
    nickname.value = resMe.data?.user?.nickname || ''
    console.log('✅ /me OK, nickname:', nickname.value)
  } catch (error) {
    console.error('❌ 닉네임 불러오기 실패:', error)
  } finally {
    console.timeEnd('[LOAD] GET /me')
    loading.value = false
  }
})

/* ──────────────────────────────
 * Swiper 이벤트/제어
 * ────────────────────────────── */
const onSwiperReady = (swiper) => {
  swiperRef.value = swiper
  currentIndex.value = swiper?.activeIndex ?? 0
  console.log('🧭 Swiper Ready. activeIndex=', currentIndex.value)
}
const onSlideChange = () => {
  if (!swiperRef.value) return
  currentIndex.value = swiperRef.value.activeIndex ?? 0
  console.log('🔄 SlideChanged →', currentIndex.value)
}

// 🔘 카드 탭 → 프로필로 이동 (스와이프 중 탭은 Swiper 제어)
const onCardTap = (user) => {
  if (!user?._id) return
  console.log('➡️ 카드 탭 → 프로필 이동:', user._id)
  router.push(`/home/user/${user._id}`)
}

// 🔘 하단 액션: 건너뛰기
const skipCard = () => {
  if (!swiperRef.value) return
  const next = Math.min((swiperRef.value.activeIndex ?? 0) + 1, users.value.length - 1)
  console.log('⏭️ 건너뛰기 →', next)
  swiperRef.value.slideTo(next)
}

// 🔘 하단 액션: 관심(예시 - 실제 API 연결 지점)
const likeCard = async () => {
  const idx = swiperRef.value?.activeIndex ?? 0
  const user = users.value[idx]
  if (!user?._id) return
  console.log('❤️ 관심 표시 시도 → userId:', user._id)

  try {
    // 예: await api.post('/like', { to: user._id })
    console.log('✅ 관심 처리 완료(샘플). 다음 카드로 이동.')
    skipCard()
  } catch (e) {
    console.error('❌ 관심 처리 실패:', e)
  }
}

// 🔘 하단 액션: 프로필 열기
const openProfile = () => {
  const idx = swiperRef.value?.activeIndex ?? 0
  const user = users.value[idx]
  if (!user?._id) {
    console.warn('⚠️ 프로필 이동 불가: userId 없음')
    return
  }
  console.log('➡️ 하단 버튼 → 프로필 이동:', user._id)
  router.push(`/home/user/${user._id}`)
}
</script>

<style scoped>
/* ✅ Ion 배경/텍스트 기본값 고정 (상단 영역 라이트) */
ion-content {
  --background: #ffffff;
  color: #000000;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: contain;
}

/* 제목/설명 — 대비 강화, 크기 상향 */
h2.black-text {
  color: #000;
  font-size: clamp(20px, 5.2vw, 24px);
  font-weight: 800;
  margin: 12px 0 4px;
  line-height: 1.25;
}
.desc {
  margin: 0 0 10px;
  font-size: clamp(14px, 2.6vw, 15.5px);
  color: #333;
}

/* 스와이프 영역 래퍼 */
.swiper-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 10px 14px 18px;
}

/* 카드 스택 크기 */
.user-cards {
  width: min(440px, 94vw);
  height: min(600px, 72vh);
}

/* ───────── 카드: 블랙 배경 + 골드 라인 ───────── */
.user-cards .swiper-slide {
  background: #000000 !important;    /* ✅ 블랙 배경 */
  border-radius: 18px;
  box-shadow: 0 10px 22px rgba(0,0,0,0.18);
  border: 1px solid #e9b40080;       /* 은은한 골드 테두리 */
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.card {
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  overflow: hidden;
}

/* 카드 상단 정보 — 다크 배경 전용 색상(화이트/연회색) */
.card-header {
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.card-header h3 {
  margin: 0 0 6px;
  font-size: clamp(17px, 3.2vw, 19px);
  font-weight: 900;
  color: #ffffff !important;          /* ✅ 메인 텍스트 흰색 */
  line-height: 1.28;
}
.card-header .nick {
  font-weight: 800;
  color: #ffffff !important;          /* ✅ 닉네임도 흰색 */
}
.card-header .meta {
  margin: 0;
  color: #cccccc !important;          /* ✅ 보조 정보는 연회색 */
  font-size: clamp(14px, 2.6vw, 15.5px);
  line-height: 1.45;
}

/* 이미지/썸네일 — 카드 대비 유지(밝은 톤) */
.thumb {
  position: relative;
  height: 56%;
  background: #fafafa;                /* 밝은 배경으로 콘텐츠 구분 */
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-fallback {
  font-weight: 800;
  opacity: 0.8;
  color: #000000 !important;          /* 밝은 영역이므로 검정 */
  font-size: clamp(14px, 2.6vw, 16px);
}

/* 카드 본문 — 흰색 텍스트 */
.card-body {
  padding: 14px 16px 16px;
}
.pref {
  margin: 0;
  font-size: clamp(15px, 2.8vw, 16.5px);
  color: #ffffff !important;          /* ✅ 본문 흰색 */
  line-height: 1.45;
}

/* 하단 액션 버튼 바 — 넓이 유지 + 간격 확대 */
.action-bar {
  width: min(440px, 94vw);
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

/* 진행표시 — 라이트 영역 텍스트 */
.progress {
  font-size: clamp(14px, 2.6vw, 15.5px);
  color: #111;
  font-weight: 700;
}

/* 초소형 화면 대응 */
@media (max-width: 360px) {
  .user-cards { height: 68vh; width: 92vw; }
  .swiper-area { gap: 12px; padding: 8px 10px 14px; }
}
</style>
