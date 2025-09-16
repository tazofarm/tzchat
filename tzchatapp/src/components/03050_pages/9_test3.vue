<template>
  <ion-page>
    <ion-content>
      <!-- 로딩 -->
      <ion-text v-if="loading" color="medium">
        <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
      </ion-text>

      <!-- 에러 -->
      <ion-text v-else-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- 스와이프 -->
      <div v-else-if="users.length" class="swiper-area">
        <swiper
          class="user-cards"
          :modules="swiperModules"
          effect="cards"
          :grab-cursor="true"
          :loop="false"
          @swiper="onSwiperReady"
          @slideChange="onSlideChange"
        >
          <swiper-slide
            v-for="(user, idx) in users"
            :key="user._id || idx"
            @click="onCardTap(user)"
          >
            <div class="card" aria-label="사용자 카드">
              <!-- 📸 사진(가로 기준으로 꽉 채움) -->
              <div class="photo" :aria-label="`${user.nickname}의 대표 이미지`">
                <ProfilePhotoViewer
                  :userId="user._id"
                  :gender="user.gender"
                  :size="800"
                />
              </div>

              <!-- 🧾 아래 정보 -->
              <div class="info">
                <h3 class="name"><span class="nick">{{ user.nickname }}</span></h3>

                <p class="meta">
                  출생년도: {{ user.birthyear || '미입력' }} ·               
                  성별: {{ user.gender === 'man' ? '남자' : '여자' }}
                </p>

                <p class="meta">
                  지역: {{ user.region1 || '미입력' }} / {{ user.region2 || '미입력' }}
               </p>

                <p class="meta">
                성향: {{ user.preference || '미입력' }}
                </p>

                <p class="meta">최근접속: 최근</p>

                <p class="meta">
                멘션: {{ user.selfintro || '미입력' }}
                </p>

              </div>
            </div>
          </swiper-slide>
        </swiper>

        <!-- 필요시 표시
        <div class="progress">{{ currentIndex + 1 }} / {{ users.length }}</div>
        -->
      </div>

      <!-- 빈 목록 -->
      <ion-text v-else color="medium">
        <p class="ion-text-center">표시할 사용자가 없습니다.</p>
      </ion-text>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { IonPage, IonContent, IonText } from '@ionic/vue'

import { Swiper as SwiperCore } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'

import ProfilePhotoViewer from '@/components/02010_minipage/ProfilePhotoViewer.vue'

const swiperModules = [EffectCards]
const router = useRouter()

const users = ref([])
const nickname = ref('')
const loading = ref(true)
const errorMessage = ref('')
const currentIndex = ref(0)
const swiperRef = ref(null)

onMounted(async () => {
  try {
    const resUsers = await api.get('/api/users')
    users.value = Array.isArray(resUsers.data?.users) ? resUsers.data.users : []
  } catch (e) {
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  }

  try {
    const resMe = await api.get('/api/me')
    nickname.value = resMe.data?.user?.nickname || ''
  } catch (e) {}

  loading.value = false
})

const onSwiperReady = (swiper) => {
  swiperRef.value = swiper
  currentIndex.value = swiper?.activeIndex ?? 0
}
const onSlideChange = () => {
  if (!swiperRef.value) return
  currentIndex.value = swiperRef.value.activeIndex ?? 0
}
const onCardTap = (user) => {
  if (!user?._id) return
  router.push(`/home/user/${user._id}`)
}
</script>

<style scoped>
/* 전체 배경 다크 + 패딩 제거 */
ion-content{
  --background:#000;
  --padding-top: 0;
  --padding-bottom: 0;
  color:#fff;
  padding:0;            /* 혹시 직접 패딩 준 경우 */
  overscroll-behavior:none;
}

/* 스와이프 영역 = ion-content 높이에 딱 맞춤 (100vh 금지) */
.swiper-area{
  width:100%;
  height:100%;          /* ⬅️ 100vh → 100% */
  padding:0; margin:0;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden;       /* ⬅️ 카드 효과 여백으로 스크롤 생기는 것 차단 */
}

.user-cards{
  width:100%;
  height:100%;          /* ⬅️ 100vh → 100% */
  overflow:hidden;      /* 안전 */
}

/* Swiper 내부도 100%로 맞춤 */
.user-cards :deep(.swiper-wrapper),
.user-cards :deep(.swiper-slide){
  width:100%;
  height:100%;
  overflow:hidden;
}

/* 카드 레이아웃 */
.card{
  width:100%; height:100%;
  display:flex; flex-direction:column;
  background:#000;
}

/* 사진 박스 (원하는 폭/비율 유지) */
.photo{
  width:100%vw;                 /* 중앙 카드 느낌이면 80vw, 풀폭이면 100% */
  max-width:100%;
  aspect-ratio: 4 / 4;        /* ← 사진 높이 비율 조절 포인트 */
  margin:0 auto;              /* 가운데 정렬 */
  overflow:hidden;
  background:#000;
  display:flex; justify-content:center; align-items:center;
}

/* ProfilePhotoViewer 내부 이미지 채우기 */
.photo :deep(.viewer-host){ width:100%; height:100%; }
.photo :deep(.avatar){
  width:100% !important;
  height:100% !important;
  object-fit:cover;
  border-radius:0 !important;
  box-shadow:none !important;
  pointer-events:none;
}

/* 정보 영역은 남는 공간을 채우고, 내부만 스크롤 */
.info{
  flex:1;                      /* ⬅️ 아래 공간을 꽉 채움 */
  padding:14px 16px 16px;
  background:linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.55) 70%, rgba(0,0,0,0));
  color:#fff;
  overflow:auto;               /* 내용이 많을 때만 내부 스크롤 */
}

.name{
  margin:0 0 6px;
  font-size:clamp(18px, 3.6vw, 22px);
  font-weight:900;
  color:#fff;
  line-height:1.25;
}
.nick{ font-weight:900; }
.meta{
  margin:0;
  color:#d0d0d0;
  font-size:clamp(14px, 2.8vw, 16px);
  line-height:1.45;
}
.pref{
  margin:8px 0 0;
  font-size:clamp(14px, 2.8vw, 16px);
  color:#f1f1f1;
}











/* (선택) 진행표시 */
.progress{
  position:fixed; bottom:10px; left:50%;
  transform:translateX(-50%);
  color:#eee; font-weight:700; font-size:14px;
}

@media (max-width:360px){
  .info{ padding:12px 12px 14px; }
}
</style>
