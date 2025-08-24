<template>
  <ion-list inset class="section-root">
    <ion-list-header>
      <ion-label>데이터 관리</ion-label>
    </ion-list-header>

    <ion-item button detail @click="onClearCache">
      <ion-label>캐시 삭제</ion-label>
    </ion-item>

    <ion-item lines="none">
      <ion-label>
        <div class="placeholder-desc">임시 파일 정리, 데이터 다운로드 등은 이후 연결됩니다.</div>
      </ion-label>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
// 00900_DataManagementSection.vue
import { IonList, IonListHeader, IonLabel, IonItem } from '@ionic/vue'

function onClearCache() {
  try {
    // 매우 단순한 데모: localStorage 전체 삭제는 위험하므로 주석
    // localStorage.clear()
    console.log('[00900_DataManagementSection] 캐시 삭제 (데모)')
    alert('캐시 삭제 (데모). 실제 항목별 정리가 필요합니다.')
  } catch (e) {
    console.error('[00900_DataManagementSection] 캐시 삭제 실패:', e)
    alert('캐시 삭제 실패')
  }
}
</script>
<style scoped>
/* ─────────────────────────────────────────────────────
   00900_DataManagementSection.vue — CSS 전용 보정(HTML/JS 불변)
   목적
   - 섹션을 카드처럼(흰 배경, 라운드, 구분선) 통일
   - 라벨 가독성(검정 텍스트) + 터치 타깃 확대
   - Ion 변수 기반으로 dev/prod 일관성
   - 초소형 화면/포커스 접근성 보강
────────────────────────────────────────────────────── */

/* 섹션 루트: 카드 느낌 */
.section-root {
  color: #000;                /* 기본 글자색 검정 */
  --background: transparent;  /* 리스트 배경 투명(바깥 카드가 가짐) */

  margin: 8px 8px 14px;
  padding: 0;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;           /* 둥근 모서리 내부로 자르기 */
}

/* 리스트 헤더(제목) */
.section-root :deep(ion-list-header) {
  --color: #000;
  min-height: 44px;
  padding: 8px 12px;
  background: #fafafa;
  border-bottom: 1px solid #eee;
}
.section-root :deep(ion-list-header ion-label) {
  color: #000;
  font-weight: 800;
  font-size: clamp(15px, 2.8vw, 16px);
}

/* 공통 아이템(ion-item) 변수 일관화 */
.section-root :deep(ion-item) {
  --background: #fff !important;
  --color: #000 !important;

  /* 터치 타깃/여백 */
  --min-height: 56px !important;
  --padding-start: 12px !important;
  --inner-padding-end: 12px !important;

  /* 아래쪽 1px 라인 */
  --inner-border-width: 0 0 1px 0 !important;
  --inner-border-color: #eee !important;
}

/* 마지막 아이템은 구분선 제거 */
.section-root :deep(ion-item:last-of-type),
.section-root :deep(ion-item[lines="none"]) {
  --inner-border-width: 0 !important;
}

/* 버튼형 아이템(캐시 삭제) 인터랙션 보강 */
.section-root :deep(ion-item[button]) {
  cursor: pointer;
  -webkit-tap-highlight-color: rgba(0,0,0,0.06);
  transition: background-color .15s ease, transform .05s ease;
}
@media (hover:hover) {
  .section-root :deep(ion-item[button]:hover) {
    background-color: #f7f7f7;
  }
}
.section-root :deep(ion-item[button]:active) {
  transform: translateY(1px);
}

/* 본문 설명(placeholder-desc) 가독성 */
.placeholder-desc {
  font-size: clamp(13px, 2.4vw, 14px);
  color: #444;
  line-height: 1.45;
  margin: 4px 0;
}

/* 포커스 접근성(:focus-within) */
.section-root :deep(ion-item:focus-within) {
  box-shadow: 0 0 0 3px rgba(59,130,246,0.3);
  border-radius: 10px;
}

/* 초소형 화면(≤360px)에서 여백 소폭 축소 */
@media (max-width: 360px) {
  .section-root { margin: 6px; }
  .section-root :deep(ion-list-header) { padding: 6px 10px; }
  .section-root :deep(ion-item) {
    --padding-start: 10px !important;
    --inner-padding-end: 10px !important;
  }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
</style>
