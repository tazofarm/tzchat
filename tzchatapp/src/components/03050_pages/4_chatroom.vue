<template>
  <!-- ✅ Ionic 정석 구조: ion-page > ion-header > ion-content -->
  <ion-page class="friends-page dark-scope">
    <!-- 상단 고정 탭을 header/toolbar 안으로 이동 
    <ion-header translucent="true">
      <ion-toolbar class="top-tabs" role="tablist" aria-label="목록 전환">
        <IonSegment :value="currentTab" @ionChange="onTabChange">
          <IonSegmentButton value="premiumchat">
            <IonLabel>Premium chat</IonLabel>
          </IonSegmentButton>

          <IonSegmentButton value="normalchat">
            <IonLabel>Chat list</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </ion-toolbar>
    </ion-header>
    -->
    <!-- 본문 -->
    <ion-content fullscreen="true">
      <div class="page-container fl-scope" role="region" aria-label="탭 페이지 영역">
        <component
          :is="currentView"
          @open-receive="openReceive"
          @close-receive="closeReceive"
          @open-aaa="openAaa"
        />

        <!-- 하단 패널 -->
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

            <AaaView :user="receiveUser" @close="closeReceive" />
          </section>
        </transition>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonContent,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/vue'

/** 탭별 페이지 */
import PremiumchatPage from '@/components/04410_Page4_chatroom/PremiumchatPage.vue'
import NormalchatPage  from '@/components/04410_Page4_chatroom/NormalchatPage.vue'

/** 리스트 클릭 시 전환될 상세/대상 뷰(예: 채팅방) */
import AaaView from '@/components/04410_Page4_chatroom/ChatRoomPage.vue'

/* ──────────────────────────────
   탭 하이라이트는 currentTab,
   실제 표시할 뷰는 activeViewKey로 분리
────────────────────────────── */
const currentTab = ref('normalchat')   // 'premiumchat' | 'normalchat'
const activeViewKey = ref(currentTab.value) // 초기에는 탭과 동일

const onTabChange = (ev) => {
  const val = ev?.detail?.value
  if (!val) return
  currentTab.value = val
  activeViewKey.value = val     // 탭 전환 시 해당 탭 화면으로 복귀
  closeReceive()
}

/* 🔹 부모가 관리하는 뷰 매핑 (aaa 추가) */
const viewMap = {
  premiumchat: PremiumchatPage,
  normalchat:  NormalchatPage,
  aaa:         AaaView,         // ★ 리스트 클릭 시 이 뷰로 전환
}
const currentView = computed(() => viewMap[activeViewKey.value] || PremiumchatPage)

/* 🔹 하단 받은신청 패널 제어 */
const receiveUser = ref(null)
const openReceive = (user) => { receiveUser.value = user || null }
const closeReceive = () => { receiveUser.value = null }

/* 🔹 자식에서 emit('open-aaa', payload) 호출 시 실행 */
const openAaa = (payload) => {
  // payload 필요 시 스토어에 보관 후 사용
  activeViewKey.value = 'aaa'
}
</script>

<style scoped>
/* =======================
   다크 테마 강제 고정
======================= */
.dark-scope { background: #0a0a0a !important; color: #f5f5f5; }

/* 🔒 Ionic 내부 배경 변수/파트까지 강제 오버라이드 */
:global(.dark-scope ion-content) { --background: #0a0a0a !important; background: #0a0a0a !important; }
:global(.dark-scope ion-content::part(background)) { background: #0a0a0a !important; }
:global(.dark-scope ion-list) { --background: transparent !important; background: transparent !important; }
:global(.dark-scope ion-item) {
  --background: transparent !important;
  --background-focused: transparent !important;
  --background-hover: #17171a !important;
  --background-activated: #17171a !important;
  /* (선택) 기본 hairline 제거가 필요하면 전역 CSS에서 border vars도 함께 0 처리 */
}

/* ========== 상단 탭 (toolbar 안) ========== */
/* ✅ sticky 제거: header가 고정 역할 수행 */
.top-tabs {
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
  color: #000 !important; font-weight: 900;
  box-shadow: 0 0 0 1px rgba(0,0,0,.35) inset, 0 3px 10px rgba(212,175,55,.3);
  transform: translateY(-1px);
}
.top-tabs :deep(ion-segment-button.segment-button-checked ion-label) { color: #000 !important; }

/* ========== 색상 변수(로컬) ========== */
:root {
  --gold:#d4af37; --gold-weak:#e6c964; --gold-strong:#b18f1a;
  --bg-deep:#0a0a0a; --panel:#141414; --row:#1b1b1b;
  --ink:#f5f5f5; --ink-weak:#c9c9c9; --border:#333;
}

/* ========== 페이지 컨테이너 ========== */
.page-container { padding: 0; position: relative; }

/* ========== 하단 패널 ========== */
.receive-panel {
  background: var(--panel, #141414);
  border: 1px solid var(--border, #333);
  border-radius: 14px;
  margin-top: 12px;
  padding: 10px;
  box-shadow: 0 10px 24px rgba(0,0,0,.45);
}
.receive-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.receive-head h3 { color: var(--gold, #d4af37); font-size: clamp(14px, 2.5vw, 16px); font-weight: 800; margin: 0; }
.btn-close { background: transparent; border: none; color: var(--ink-weak, #c9c9c9); font-size: 20px; line-height: 1; cursor: pointer; }

/* slide-up transition */
.slide-up-enter-active, .slide-up-leave-active { transition: all .18s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(8px); }

/* 공통 카드 */
.card { background: var(--panel, #141414); border: 1px solid var(--border, #333); border-radius: 12px; padding: 10px; box-shadow: 0 6px 16px rgba(0,0,0,0.35); position: relative; }

/* 소형 디바이스 */
@media (max-width: 380px) {
  .top-tabs :deep(ion-segment-button) { height: 32px; }
  .top-tabs :deep(ion-segment-button ion-label) { font-size: 11px; }
}
</style>
