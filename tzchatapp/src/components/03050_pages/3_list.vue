<template>
  <!-- ✅ Ionic 정석 구조로 변경: ion-page > ion-header > ion-content -->
  <ion-page class="friends-page dark-scope">
    <!-- 상단 고정 탭을 ion-header/ion-toolbar 안으로 이동 -->
    <ion-header translucent="true">
      <ion-toolbar class="top-tabs" role="tablist" aria-label="목록 전환">
        <ion-segment :value="currentTab" @ionChange="onTabChange">
          <!-- 
          <ion-segment-button value="premium">
            <ion-label>Premium</ion-label>
          </ion-segment-button>
          -->
          <ion-segment-button value="received">
            <ion-label>받은신청</ion-label>
          </ion-segment-button>

          <ion-segment-button value="sent">
            <ion-label>보낸신청</ion-label>
          </ion-segment-button>

          <ion-segment-button value="friends">
            <ion-label>친구리스트</ion-label>
          </ion-segment-button>

          <ion-segment-button value="blocks">
            <ion-label>차단리스트</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <!-- ✅ 본문 -->
    <ion-content fullscreen="true">
      <div class="page-container fl-scope" role="region" aria-label="탭 페이지 영역">
        <component
          :is="currentView"
          :viewer-level="viewerLevel"
          :is-premium="isPremium"
          @open-receive="openReceive"
          @close-receive="closeReceive"
        />

        <!-- ✅ 하단에 받은신청 패널(3) -->
        <transition name="slide-up">
          <section
            v-if="receiveUser"
            class="receive-panel"
            role="dialog"
            aria-label="받은신청 상세"
          >
            <header class="receive-head">
              <h3>받은 신청</h3>
              <button type="button" class="btn-close" @click="closeReceive" aria-label="닫기">×</button>
            </header>

            <!-- ⬇⬇⬇ 상세 패널 컴포넌트 (경로 주의) -->
            <ReceivePanel
              :user="receiveUser"
              :viewer-level="viewerLevel"
              :is-premium="isPremium"
              @close="closeReceive"
            />
          </section>
        </transition>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonContent,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/vue'
import { api } from '@/lib/api'

// 탭별 페이지
import PremiumPage  from '@/components/04310_Page3_list/Page_Premium.vue'
import ReceivedPage from '@/components/04310_Page3_list/Page_Receive.vue'
import SentPage     from '@/components/04310_Page3_list/Page_Send.vue'
import FriendsPage  from '@/components/04310_Page3_list/Page_Friend.vue'
import BlocksPage   from '@/components/04310_Page3_list/Page_Block.vue'

// ✅ 받은신청 '상세 패널' 컴포넌트
import ReceivePanel from '@/components/02010_minipage/mini_list/UserList.vue'

const currentTab = ref('received')
const onTabChange = (ev) => {
  const val = ev?.detail?.value
  if (!val) return
  currentTab.value = val
  closeReceive()
}

const viewMap = {
  premium:  PremiumPage,
  received: ReceivedPage,
  sent:     SentPage,
  friends:  FriendsPage,
  blocks:   BlocksPage,
}
const currentView = computed(() => viewMap[currentTab.value] || PremiumPage)

const receiveUser = ref(null)
const openReceive = (user) => { receiveUser.value = user || null }
const closeReceive = () => { receiveUser.value = null }

/* ✅ 프리미엄 가림 로직 전달용 상태 */
const viewerLevel = ref('')  // '일반회원' | '여성회원' | '프리미엄' 등
const isPremium   = ref(false)

onMounted(async () => {
  try {
    const me = (await api.get('/api/me')).data?.user || {}
    const levelFromApi =
      me?.level ||
      me?.user_level ||
      me?.membership ||
      ''
    viewerLevel.value = String(levelFromApi || '').trim()

    const premiumBool =
      me?.isPremium ??
      me?.premium ??
      (String(levelFromApi || '').trim() === '프리미엄')
    isPremium.value = Boolean(premiumBool)
  } catch (e) {
    // 서버 실패 시 로컬 스토리지 폴백
    const lv = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim().toLowerCase()
    viewerLevel.value = lv
    const boolish = (localStorage.getItem('isPremium') || '').trim().toLowerCase()
    isPremium.value = ['프리미엄', 'premium', 'premium_member', 'prem'].includes(lv) ||
                      ['true','1','yes','y'].includes(boolish)
  }
})
</script>
  
<style scoped>
/* =======================
   다크 테마 강제 고정
======================= */
.dark-scope {
  background: #0a0a0a !important;
  color: #f5f5f5;
}

/* 🔒 Ionic 내부 배경 변수/파트까지 강제 오버라이드 */
:global(.dark-scope ion-content) {
  --background: #0a0a0a !important;
  background: #0a0a0a !important;
}
:global(.dark-scope ion-content::part(background)) {
  background: #0a0a0a !important;
}
:global(.dark-scope ion-list) {
  --background: transparent !important;
  background: transparent !important;
}
:global(.dark-scope ion-item) {
  --background: transparent !important;
  --background-focused: transparent !important;
  --background-hover: #17171a !important;
  --background-activated: #17171a !important;
}

/* ========== 상단 탭 (toolbar 안) ========== */
/* ✅ sticky 제거: header가 고정 역할 수행 */
.top-tabs {
  /* position: sticky;  ← 제거 */
  /* top: env(safe-area-inset-top, 0px); ← 제거 */
  
  background: var(--bg-deep, #0a0a0a);
  padding: 4px 6px 8px;
  border-bottom: 1px solid var(--border, #333);
  
}
.top-tabs :deep(ion-segment) {
  --background: var(--panel, #141414);
  --indicator-color: var(--gold, #d4af37);
  --color: var(--ink, #f5f5f5);
  --color-checked: #000;
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-between;
  overflow-x: auto;
  
}
.top-tabs :deep(ion-segment-button) {
  flex: 1 1 20%;
  min-width: 64px;
  height: 34px;
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
}
.top-tabs :deep(ion-segment-button ion-label) {
  font-size: clamp(11px, 2.2vw, 13px);
  white-space: nowrap;
  text-align: center;
}
.top-tabs :deep(ion-segment-button.segment-button-checked) {
  background: linear-gradient(135deg, var(--gold, #d4af37), var(--gold-strong, #b18f1a)) !important;
  color: #000 !important;
  font-weight: 900;
  box-shadow: 0 0 0 1px rgba(0,0,0,.35) inset, 0 3px 10px rgba(212,175,55,.3);
  transform: translateY(-1px);
}
.top-tabs :deep(ion-segment-button.segment-button-checked ion-label) {
  color: #000 !important;
}

/* ========== 색상 변수(로컬) ========== */
:root {
  --gold: #d4af37;
  --gold-weak: #e6c964;
  --gold-strong: #b18f1a;
  --bg-deep: #0a0a0a;
  --panel: #141414;
  --row: #1b1b1b;
  --ink: #f5f5f5;
  --ink-weak: #c9c9c9;
  --border: #333;
}

/* ========== 페이지 컨테이너 ========== */
.page-container {
  padding: 0;
  position: relative;
}

/* ========== 하단 패널 ========== */
.receive-panel {
  background: var(--panel, #141414);
  border: 1px solid var(--border, #333);
  border-radius: 14px;
  margin-top: 12px;
  padding: 10px;
  box-shadow: 0 10px 24px rgba(0,0,0,.45);
}
.receive-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.receive-head h3 {
  color: var(--gold, #d4af37);
  font-size: clamp(14px, 2.5vw, 16px);
  font-weight: 800;
  margin: 0;
}
.btn-close {
  background: transparent;
  border: none;
  color: var(--ink-weak, #c9c9c9);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

/* slide-up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all .18s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* 공통 카드 */
.card {
  background: var(--panel, #141414);
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  padding: 10px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  position: relative;
}

@media (max-width: 380px) {
  .top-tabs :deep(ion-segment-button) { height: 32px; }
  .top-tabs :deep(ion-segment-button ion-label) { font-size: 11px; }
}
</style>
