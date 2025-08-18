<template>
  <ion-list inset class="section-root">
    <ion-list-header>
      <ion-label>고급 설정 · 실험실</ion-label>
    </ion-list-header>

    <ion-item lines="none">
      <ion-label>
        <div class="placeholder-title">준비중</div>
        <div class="placeholder-desc">개발자 옵션/실험 기능 토글이 여기에 추가됩니다.</div>
      </ion-label>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
// 01100_AdvancedSection.vue
import { IonList, IonListHeader, IonLabel, IonItem } from '@ionic/vue'
console.log('[01100_AdvancedSection] mounted')
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   01100_AdvancedSection.vue — CSS 전용 보정(HTML/JS 불변)
   목적
   - inset 리스트 카드 스타일 통일(라이트, 검정 텍스트)
   - 모바일 터치 타깃/여백 최적화
   - 헤더/아이템 가독성 강화, 초소형 화면 대응
   - 포커스 접근성(:focus-within) 하이라이트
────────────────────────────────────────────────────────────── */

/* 카드(inset) 형태 + 기본 텍스트 컬러 고정 */
.section-root {
  margin: 8px 8px 14px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;
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

/* ===== 아이템(placeholder) ===== */
:host :deep(ion-item) {
  /* IonItem 내부 패딩/높이 변수 주입 */
  --background: #fff;
  --color: #000;
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 56px;

  /* lines="none" 이므로 외곽 경계선 보강 */
  border-top: 1px solid #eee;
}

/* 포커스 접근성 */
:host :deep(ion-item:focus-within) {
  box-shadow: 0 0 0 3px rgba(59,130,246,0.3);
  border-radius: 10px;
}

/* 플레이스홀더 텍스트 가독성 */
.placeholder-title {
  font-weight: 700;
  color: #000;
  font-size: clamp(14px, 2.6vw, 15px);
  line-height: 1.25;
}
.placeholder-desc {
  margin-top: 2px;
  font-size: clamp(13px, 2.4vw, 14px);
  color: #444;
  line-height: 1.35;
}

/* 초소형 화면(≤360px)에서 여백 소폭 축소 */
@media (max-width: 360px) {
  .section-root { margin: 6px; }
  :host :deep(ion-list-header) { padding: 8px 10px; }
  :host :deep(ion-item) {
    --padding-start: 10px;
    --inner-padding-end: 10px;
  }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}

</style>
