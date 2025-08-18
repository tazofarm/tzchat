<template>
  <ion-list inset class="section-root">
    <ion-list-header>
      <ion-label>디버그 · 로그</ion-label>
    </ion-list-header>

    <ion-item button detail @click="exportLogs">
      <ion-label>콘솔 로그 내보내기 (데모)</ion-label>
    </ion-item>

    <ion-item lines="none">
      <ion-label>
        <div class="placeholder-desc">내부 진단/상태 점검 항목이 여기에 추가됩니다.</div>
      </ion-label>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
// 01200_DebugSection.vue
import { IonList, IonListHeader, IonLabel, IonItem } from '@ionic/vue'

function exportLogs() {
  // 실제 콘솔 로그를 수집하는 것은 브라우저 제약이 있어 데모 처리
  const sample = [
    '[Debug] sample log 1',
    '[Debug] sample log 2'
  ].join('\n')
  const blob = new Blob([sample], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tzchat-logs.txt'
  a.click()
  URL.revokeObjectURL(url)
  console.log('[01200_DebugSection] 로그 내보내기(데모)')
}
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   01200_DebugSection.vue — CSS 전용 보정(HTML/JS 불변)
   목적
   - 라이트 테마 고정 + 가독성(검정 텍스트)
   - inset 리스트 카드화(모서리/테두리/그림자)
   - 아이템 터치 타깃/분리선/포커스 접근성
   - 초소형 화면 패딩 보정
────────────────────────────────────────────────────────────── */

/* 컴포넌트 전역 기본 텍스트 컬러를 검정으로 명시 */
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
  --inner-padding-end: 10px;

  /* 라이트 스킨 + 분리선 */
  --background: #fff;
  --color: #000;
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: #eee;
}

/* 마지막 아이템은 분리선 제거 */
:host :deep(.section-root ion-item:last-of-type) {
  --inner-border-width: 0;
}

/* 버튼 아이템 시각 상태 */
:host :deep(.section-root ion-item[button]) {
  cursor: pointer;
}
:host :deep(.section-root ion-item[button]:hover) {
  filter: brightness(0.98);
}
:host :deep(.section-root ion-item[button]:active) {
  filter: brightness(0.96);
}

/* 포커스 접근성(:focus-within만 하이라이트) */
:host :deep(.section-root ion-item:focus-within) {
  box-shadow: 0 0 0 3px rgba(59,130,246,0.30);
  border-radius: 10px; /* 시각적으로 링이 더 또렷하게 */
}

/* 라벨/설명문 가독성 */
:host :deep(.section-root ion-item ion-label) {
  color: #000;
  font-weight: 700;
  font-size: clamp(14px, 2.6vw, 15px);
  line-height: 1.25;
}

.placeholder-desc {
  font-size: clamp(13px, 2.4vw, 14px);
  color: #444;
  line-height: 1.35;
}

/* 초소형 화면(≤360px)에서 여백 소폭 축소 */
@media (max-width: 360px) {
  :host :deep(.section-root.inset) {
    margin: 8px 8px 12px;
  }
  :host :deep(.section-root ion-item) {
    --padding-start: 10px;
    --inner-padding-end: 8px;
  }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}

</style>
