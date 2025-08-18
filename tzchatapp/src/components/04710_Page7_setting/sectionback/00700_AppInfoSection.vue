<template>
  <ion-list inset class="section-root">
    <ion-list-header>
      <ion-label>앱 정보</ion-label>
    </ion-list-header>

    <ion-item lines="none">
      <ion-label>앱 버전</ion-label>
      <ion-note slot="end">{{ appVersion }}</ion-note>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
// ---------------------------------------------
// 00700_AppInfoSection.vue
// - 앱 버전 등 간단한 정보 표시
// ---------------------------------------------
import { IonList, IonListHeader, IonLabel, IonItem, IonNote } from '@ionic/vue'
import { appVersion } from '../composables/useSettings'

console.log('[00700_AppInfoSection] version:', appVersion)
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   00700_AppInfoSection.vue — CSS 전용 보정(HTML/JS 불변)
   목적
   - 모바일 가독성(검정 텍스트) 유지
   - inset 리스트를 카드처럼 보이게(배경/모서리/테두리)
   - 아이템 패딩/높이/폰트 스케일 정돈
   - 우측 버전 값은 살짝 모노스페이스로 가독성 ↑
────────────────────────────────────────────────────────────── */

.section-root {
  /* 기본 글자색 */
  color: #000;

  /* 카드 형태(ion-list inset과 조화) */
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  margin: 10px 8px;     /* inset 여백과 비슷한 톤 */
  overflow: hidden;     /* 둥근 모서리 내부로 자르기 */

  /* 후손 ion-item 배경 기본값 */
  --ion-item-background: #fff;
}

/* 리스트 헤더: 간격/폰트 */
.section-root ion-list-header {
  padding: 8px 12px;
}
.section-root ion-list-header ion-label {
  font-size: clamp(14px, 2.6vw, 15px);
  font-weight: 700;
  color: #000;
}

/* 단일 아이템(앱 버전 행) */
.section-root ion-item {
  /* 터치 타깃/패딩/배경 */
  --min-height: 52px;
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --background: #fff;

  color: #000;
}

/* 좌측 라벨(“앱 버전”) */
.section-root ion-item ion-label {
  font-size: clamp(14px, 2.6vw, 15px);
  color: #000;
}

/* 우측 값(버전) — 살짝 모노스페이스로 정렬감 부여 */
.section-root ion-item ion-note {
  font-size: clamp(13px, 2.4vw, 14px);
  color: #000;
  opacity: 0.9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

/* 포커스 접근성(:focus-visible만 적용) */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
  border-radius: 8px;
}

/* 초소형 화면(≤360px): 여백 살짝 축소 */
@media (max-width: 360px) {
  .section-root { margin: 8px 6px; }
  .section-root ion-list-header { padding: 6px 10px; }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}

</style>
