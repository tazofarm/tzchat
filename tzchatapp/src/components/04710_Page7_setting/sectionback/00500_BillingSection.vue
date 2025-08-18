<template>
  <ion-list inset class="section-root">
    <ion-list-header>
      <ion-label>결제 · 구독</ion-label>
    </ion-list-header>

    <SettingItemRow
      label="구매하기"
      :icon="icons.cardOutline"
      status="stub"
      name="purchase"
      @click="onPurchase"
    />
  </ion-list>
</template>

<script setup lang="ts">
// ---------------------------------------------
// 00500_BillingSection.vue
// - 구매하기(준비중) 버튼형 행
// ---------------------------------------------
import { IonList, IonListHeader, IonLabel } from '@ionic/vue'
import SettingItemRow from '../common/SettingItemRow.vue'
import { cardOutline } from 'ionicons/icons'

const icons = { cardOutline }

function onPurchase() {
  console.log('[00500_BillingSection] 구매하기 클릭 (준비중)')
  alert('구매하기 진입 (준비중)')
}
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   00500_BillingSection.vue — CSS 전용 보정(HTML/JS 불변)
   목적
   - 리스트 카드(inset) 가독성/시각 일관화
   - 모바일 터치 타깃 확대, 검정 텍스트 고정
   - 리스트 헤더/아이템 간격, 분리선 정리
   - 포커스 접근성(:focus-within), 초소형 화면 대응
────────────────────────────────────────────────────────────── */

/* ion-list 자체에 클래스가 있으므로 직접 스타일링 */
.section-root {
  /* 카드 형태(inset) */
  margin: 8px 8px 14px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;

  /* 기본 텍스트 색 */
  color: #000;
}

/* ===== 리스트 헤더 ===== */
:host :deep(ion-list-header) {
  padding: 10px 12px;
  background: #f6f6f6;
  border-bottom: 1px solid #eee;
}
:host :deep(ion-list-header ion-label) {
  color: #000;
  font-weight: 800;
  font-size: clamp(15px, 2.6vw, 16px);
  line-height: 1.25;
}

/* ===== 리스트 아이템(SettingItemRow 내부 ion-item에 변수 주입) ===== */
:host :deep(ion-item) {
  /* 터치 타깃/여백 */
  --min-height: 56px;
  --padding-start: 12px;
  --inner-padding-end: 10px;

  /* 라이트 스킨 */
  --background: #fff;
  --color: #000;

  /* 아래쪽 1px 구분선 */
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: #eee;
}

/* 마지막 아이템은 구분선 제거 */
:host :deep(ion-item:last-of-type) {
  --inner-border-width: 0;
}

/* 아이콘/라벨 가독성 */
:host :deep(ion-item ion-icon) {
  color: #000;
  opacity: 0.9;
  margin-right: 6px;
}
:host :deep(ion-item ion-label) {
  color: #000;
  font-weight: 700;
  font-size: clamp(14px, 2.6vw, 15px);
  line-height: 1.25;
}

/* 포커스 접근성: 키보드/스크린리더 이동 시 하이라이트 */
:host :deep(ion-item:focus-within) {
  box-shadow: 0 0 0 3px rgba(59,130,246,0.3);
  border-radius: 10px;
}

/* 초소형 화면(≤360px)에서 여백 소폭 축소 */
@media (max-width: 360px) {
  .section-root { margin: 6px; }
  :host :deep(ion-list-header) { padding: 8px 10px; }
  :host :deep(ion-item) {
    --padding-start: 10px;
    --inner-padding-end: 8px;
  }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}

</style>
