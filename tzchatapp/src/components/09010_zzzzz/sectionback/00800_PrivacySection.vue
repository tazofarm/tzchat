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
   - 라이트 테마 고정 + 가독성(검정 텍스트)
   - inset 리스트 카드화(모서리/테두리/그림자)
   - 아이템 패딩/타이포/정렬 보정
   - 앱 버전(ion-note) 가독성 ↑ (칩 형태)
   - 초소형 화면 패딩 보정
────────────────────────────────────────────────────────────── */

/* 컴포넌트 전역 텍스트 컬러를 검정으로 명시 */
:host {
  color: #000;
}

/* ===== 리스트 컨테이너(ion-list.inset) 카드화 ===== */
.section-root {
  color: #000; /* 텍스트 기본 검정 */
}

/* ion-list 자체 변수 지정 (라이트 고정) */
:host :deep(.section-root) {
  --background: transparent;   /* 배경 투명 → 카드 느낌 유지 */
}

/* inset 리스트를 카드처럼 보이게 */
:host :deep(.section-root.inset) {
  margin: 10px 12px 16px;
  padding: 0; /* 내부 패딩은 item에 맡김 */
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden; /* 둥근 모서리 안쪽 자르기 */
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
}

/* ===== 헤더(ion-list-header) ===== */
:host :deep(.section-root ion-list-header) {
  --background: #fafafa;
  --color: #000;
  padding-inline-start: 14px;
  padding-inline-end: 12px;
  min-height: 44px;
  border-bottom: 1px solid #eee;
}

:host :deep(.section-root ion-list-header ion-label) {
  font-weight: 800;
  font-size: clamp(14px, 2.6vw, 15px);
  letter-spacing: 0.2px;
  color: #000;
}

/* ===== 아이템(ion-item) ===== */
:host :deep(.section-root ion-item) {
  /* 터치 타깃/여백 */
  --min-height: 56px;
  --padding-start: 12px;
  --inner-padding-end: 12px;

  /* 라이트 스킨 */
  --background: #fff;
  --color: #000;

  /* 이 섹션은 lines="none" 사용 → 분리선 없음 */
}

/* 라벨 타이포 */
:host :deep(.section-root ion-item ion-label) {
  color: #000;
  font-weight: 700;
  font-size: clamp(14px, 2.6vw, 15px);
  line-height: 1.25;
}

/* ===== 우측 노트(ion-note) — 앱 버전 칩 형태 ===== */
:host :deep(.section-root ion-item ion-note[slot="end"]) {
  color: #111;                         /* 글자 진하게 */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: clamp(12px, 2.4vw, 13px); /* 살짝 작게, 단 가독성 유지 */
  padding: 2px 8px;                    /* 칩 내부 여백 */
  border: 1px solid #e5e5e5;           /* 옅은 테두리 */
  border-radius: 999px;                /* 알약 모양 */
  background: #f7f7f7;                 /* 은은한 배경 */
  letter-spacing: 0.2px;
}

/* 포커스 접근성(:focus-within만 하이라이트) — 키보드 탐색 보조 */
:host :deep(.section-root ion-item:focus-within) {
  box-shadow: 0 0 0 3px rgba(59,130,246,0.30);
  border-radius: 10px; /* 시각적으로 링이 더 또렷하게 */
}

/* 초소형 화면(≤360px)에서 여백 소폭 축소 */
@media (max-width: 360px) {
  :host :deep(.section-root.inset) {
    margin: 8px 8px 12px;
  }
  :host :deep(.section-root ion-item) {
    --padding-start: 10px;
    --inner-padding-end: 10px;
  }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}

</style>
