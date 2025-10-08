<template>
  <!-- 회원 목록 -->
  <ion-list v-if="!isLoading && users.length" class="users-list fl-scope">
    <div
      v-for="(user, idx) in users"
      :key="user._id"
      class="list-row"
    >
      <!-- ✅ 행 사이 회색 구분선: 실제 DOM 요소 -->
      <div v-if="idx > 0" class="row-divider" aria-hidden="true"></div>

      <!-- ① 프로필/정보 -->
      <ion-item button detail @click="$emit('select', user)" class="row-item">
        <!-- 좌측: 대표사진 -->
        <!-- ✅ 아바타 클릭 시에도 프로필로 이동하도록 수정 -->
        <div
          class="list-avatar lead-start"
          slot="start"
          role="button"
          tabindex="0"
          @click="$emit('select', user)"
          @keydown.enter="$emit('select', user)"
          @keydown.space.prevent="$emit('select', user)"
        >
          <ProfilePhotoViewer
            :userId="user._id"
            :gender="user.gender"
            :size="90"
          />
        </div>

        <!-- 본문 -->
        <ion-label class="black-text">
          <h3 class="title">
            <span class="nickname">{{ user.nickname }}</span>
          </h3>

          <p class="meta">
            <ion-icon :icon="icons.calendarOutline" class="row-icon" aria-hidden="true" />
            출생년도 : {{ user.birthyear }}
          </p>
          <p class="meta">
            <ion-icon :icon="user.gender === 'man' ? icons.maleOutline : icons.femaleOutline" class="row-icon" aria-hidden="true" />
            성별 : {{ user.gender === 'man' ? '남자' : '여자' }}
          </p>
          <p class="meta">
            <ion-icon :icon="icons.locationOutline" class="row-icon" aria-hidden="true" />
            지역 : {{ user.region1 }} / {{ user.region2 }}
          </p>
          <p class="meta">
            <ion-icon :icon="icons.chatbubblesOutline" class="row-icon" aria-hidden="true" />
            특징 : {{ user.preference }}
          </p>
          <p class="meta">
            <ion-icon :icon="icons.timeOutline" class="row-icon" aria-hidden="true" />
            최근 접속 : 회원전용
          </p>
          <p class="meta">
            <ion-icon :icon="icons.chatbubblesOutline" class="row-icon" aria-hidden="true" />
            멘션 : {{ (user.selfintro ?? user.selfIntro ?? '').trim() || '미입력' }}
          </p>

          <!-- (옵션) 본문 내부 보조 슬롯 -->
          <div v-if="$slots['item-extra']" class="item-extra" @click.stop>
            <slot name="item-extra" :user="user" />
          </div>
        </ion-label>
      </ion-item>

      <!-- ② 카드 하단 버튼 줄: 슬롯이 있을 때만 렌더 -->
      <div
        v-if="$slots['item-actions']"
        class="actions-bar"
        @click.stop
      >
        <slot name="item-actions" :user="user" />
      </div>
    </div>
  </ion-list>

  <!-- 빈 상태 -->
  <ion-text color="medium" v-else-if="!isLoading && !users.length">
    <p class="ion-text-center">{{ emptyText }}</p>
  </ion-text>

  <!-- 로딩 상태 -->
  <ion-text color="medium" v-else>
    <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
  </ion-text>
</template>

<script setup>
import ProfilePhotoViewer from '@/components/02010_minipage/mini_profile/ProfilePhotoViewer.vue'
import { IonList, IonItem, IonLabel, IonText, IonIcon } from '@ionic/vue'
import {
  calendarOutline,
  maleOutline,
  femaleOutline,
  locationOutline,
  chatbubblesOutline,
  timeOutline
} from 'ionicons/icons'

defineProps({
  users: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  emptyText: { type: String, default: '조건에 맞는 사용자가 없습니다.' },
})
defineEmits(['select'])

const icons = {
  calendarOutline,
  maleOutline,
  femaleOutline,
  locationOutline,
  chatbubblesOutline,
  timeOutline
}
</script>

<style scoped>
/* ===== 독립 스타일: 공용 변수에 의존하지 않음 ===== */
.fl-scope{
  background:#121214;
  margin:10px 12px 16px;
  border-radius:14px;
  overflow:hidden;
  border:1px solid rgba(212,175,55,.18);
  box-shadow:0 2px 10px rgba(0,0,0,.35);
  padding:0;
}

/* 행 컨테이너 */
.list-row{ position:relative; background:transparent; }

/* ✅ 실제 구분선 요소 (공용 CSS에 영향 받지 않도록 강한 지정) */
.row-divider{
  height:1px;
  background:#4a4a4a;        /* 회색 구분선 */
  margin:6px 10px 8px 18px;  /* 좌우 여백(아바타 공간 고려) */
  pointer-events:none;
  z-index:1;
}

/* ion-item 기본 여백/색 */
.row-item{
  --inner-border-width:0 !important;
  --background:transparent !important;
  --min-height:60px;

  --inner-padding-top:2px;
  --inner-padding-bottom:2px;

  --padding-start:18px;
  --inner-padding-end:10px;
  --inner-padding-start:0;

  color:#d7d7d9;
  transition:background .18s ease, transform .06s ease;
}
.row-item:hover{ background:#17171a; }
.row-item:active{ transform:translateY(1px); }

/* Shadow DOM 보정 */
.row-item::part(native){ padding-left:18px; padding-right:10px; }
.row-item::part(start){ margin-inline-start:0; margin-inline-end:0; }

/* 아바타 */
.list-avatar{
  width:100px; height:100px; min-width:64px; margin-right:30px;
  display:flex; align-items:center; justify-content:center;
  border-radius:10%; overflow:hidden;
  border:1px solid rgba(212,175,55,.18);
  background:rgba(212,175,55,.08);
  cursor:pointer; /* ✅ 클릭 가능 표시 */
}
.list-avatar :deep(.viewer-host){ width:100%; height:100%; }
.list-avatar :deep(.avatar){
  width:100% !important; height:100% !important; object-fit:cover;
  border-radius:0 !important; box-shadow:none !important; pointer-events:none;
}

/* 텍스트 */
.black-text{ color:#d7d7d9; }
.title{ color:#f3f3f3; font-size:clamp(15px,2.6vw,16px); font-weight:800; margin:0 0 4px; line-height:1.28; }
.nickname{ font-weight:800; letter-spacing:.2px; text-shadow:0 0 10px rgba(212,175,55,.08); }
.meta{ display:flex; align-items:center; gap:6px; color:#d7d7d9; font-size:clamp(13px,2.4vw,14px); margin:2px 0 0; line-height:1.32; opacity:.94; }
.row-icon{ font-size:15px; color:#d4af37; }

/* (옵션) 본문 내부 보조 슬롯 */
.item-extra{ margin-top:6px; }

/* 하단 가로 버튼 바(슬롯) */
.actions-bar{
  display:flex; gap:10px; flex-wrap:wrap;
  padding:10px 14px 12px;
  background:#0f0f0f;
  border-top:1px solid rgba(212,175,55,.12);
}
.actions-bar :deep(ion-button){
  width:auto; display:inline-flex;
}

@media (max-width:360px){
  .fl-scope{ margin:8px; border-radius:12px; }
  .row-item{ --padding-start:80px; --inner-padding-end:10px; --min-height:56px; }
  .actions-bar{ gap:8px; padding:8px 10px 10px; }
}
</style>
