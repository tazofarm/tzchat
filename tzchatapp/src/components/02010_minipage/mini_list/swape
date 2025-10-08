

<template>
  <!-- 스와이프 카드 -->
  <div v-if="!isLoading && users.length" class="swiper-area">
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
        @click="emitUserClick(user._id)"
      >
        <div class="card" aria-label="사용자 카드">
          <!-- 사진 -->
          <div class="photo" :aria-label="`${user.nickname}의 대표 이미지`">
            <ProfilePhotoViewer
              :userId="user._id"
              :gender="user.gender"
              :size="800"
            />
          </div>

          <!-- 정보 -->
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

            <p class="meta">최근접속: 회원전용</p>

            <p class="meta">
              멘션: {{ ((user.selfintro ?? user.selfIntro ?? '') + '').trim() || '미입력' }}
            </p>
          </div>
        </div>
      </swiper-slide>
    </swiper>
  </div>

  <!-- 빈 상태 -->
  <ion-text color="medium" v-else-if="!isLoading && !users.length">
    <p class="ion-text-center">조건에 맞는 사용자가 없습니다.</p>
  </ion-text>

  <!-- 로딩 상태 -->
  <ion-text color="medium" v-else>
    <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
  </ion-text>
</template>

<script setup>
/* -----------------------------------------------------------
   공용 스와이프 리스트 컴포넌트 (swapeList)
   - props: users, isLoading
   - emits: userClick(userId)
----------------------------------------------------------- */
import { ref } from 'vue'
import { IonText } from '@ionic/vue'
import ProfilePhotoViewer from '@/components/02010_minipage/mini_profile/ProfilePhotoViewer.vue'

/* Swiper */
import { Swiper as SwiperCore } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'

const props = defineProps({
  users: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['userClick'])

/* Swiper 상태 */
const swiperModules = [EffectCards]
const swiperRef = ref(null)
const currentIndex = ref(0)

const onSwiperReady = (swiper) => {
  swiperRef.value = swiper
  currentIndex.value = swiper?.activeIndex ?? 0
}
const onSlideChange = () => {
  if (!swiperRef.value) return
  currentIndex.value = swiperRef.value.activeIndex ?? 0
}

const emitUserClick = (userId) => {
  if (!userId) return
  emit('userClick', userId)
}
</script>

<style scoped>
/* =========================================================
   Black + Gold Theme (scoped)
========================================================= */
:root,
:host {
  --bg: #0b0b0d;
  --panel: #121214;
  --panel-2: #17171a;
  --text-strong: #f3f3f3;
  --text: #d7d7d9;
  --text-dim: #a9a9ad;
  --divider: #26262a;
  --gold: #d4af37;
  --gold-2: #f1cf5a;
  --focus: rgba(212, 175, 55, 0.45);
}

ion-content{
  --background: var(--bg);
  color:#fff;
  padding:0;
  overscroll-behavior:none;
}

/* 스와이프 영역 = ion-content에 맞춤 */
.swiper-area{
  width:100%;
  height:100%;
  padding:0; margin:0;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden;
}

.user-cards{
  width:100%;
  height:100%;
  overflow:hidden;
}

/* Swiper 내부도 100%로 */
.user-cards :deep(.swiper-wrapper),
.user-cards :deep(.swiper-slide){
  width:100%;
  height:100%;
  overflow:hidden;
}

/* 카드 */
.card{
  width:100%; height:100%;
  display:flex; flex-direction:column;
  background:#000;
}

/* 사진 박스 */
.photo{
  width:100%;
  max-width:100%;
  aspect-ratio: 4 / 4;       /* 사진 높이 비율 조절 포인트 */
  margin:0 auto;
  overflow:hidden;
  background:#000;
  display:flex; justify-content:center; align-items:center;
}

/* ProfilePhotoViewer 보정 */
.photo :deep(.viewer-host){ width:100%; height:100%; }
.photo :deep(.avatar){
  width:100% !important;
  height:100% !important;
  object-fit:cover;
  border-radius:0 !important;
  box-shadow:none !important;
  pointer-events:none;
}

/* 정보 영역 */
.info{
  flex:1;
  padding:14px 16px 16px;
  background:linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.55) 70%, rgba(0,0,0,0));
  color:#fff;
  overflow:auto;
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

/* 포커스 */
:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus); border-radius: 10px; }

/* 작은 화면 보정 */
@media (max-width:360px){
  .info{ padding:12px 12px 14px; }
}
</style>
