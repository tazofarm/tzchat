<template>
  <!-- ✅ 골드 테마 활성화: 클래스 한 줄 -->
  <ion-app class="theme-gold">
    <router-view />
  </ion-app>
</template>

<script setup>
import { IonApp } from '@ionic/vue'
</script>

<style>
/* 전역 테마 임포트: variables → (optional) mobile-utilities → theme-gold */
@import "@/theme/variables.css";
/* @import "@/theme/mobile-utilities.css";  // 사용 중이면 그대로 유지하세요 */
@import "@/theme/theme-gold.css";

/* ===== App 전역 뷰포트/높이 안정화 (구조 변경 없음) =====
   - html/body/#app/ion-app: 100% + 100dvh 보장 (모바일 주소창 대응)
   - ⚠️ 배경/글자색은 '전역 토큰' 사용 → 라이트/골드 모두 OK
   - 스크롤 바운스/뒤로가기 제스처로 인한 깜빡임 최소화
   - 라우터 뷰(페이지 컨테이너)도 높이 상속
*/

/* 1) 전역 기본값 */
:root {
  color-scheme: light; /* 강제 라이트 기본값(입력 줌/주소창 이슈 최소화) */
}
html, body {
  height: 100%;
  min-height: 100dvh;              /* 동적 뷰포트: 모바일 주소창 대응 */
  margin: 0;
  background: var(--ion-background-color);
  color: var(--ion-text-color);
  overscroll-behavior: none;       /* 뷰포트 바운스/오버스크롤 체인 방지 */
  -webkit-text-size-adjust: 100%;
}

/* 2) 앱 루트 높이 보장 */
#app, ion-app {
  height: 100%;
  min-height: 100dvh;              /* iOS 사파리 높이 변화 대응 */
  background: var(--ion-background-color); /* ✅ 토큰 기반 */
  color: var(--ion-text-color);            /* ✅ 토큰 기반 */
}

/* 3) 라우터 컨테이너도 높이 상속 */
#app > ion-app > * {
  height: 100%;
  min-height: 100%;
}

/* 4) 스크롤바(데스크톱 보조) */
* { scrollbar-width: thin; scrollbar-color: #bbb transparent; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }

/* 5) 접근성: 모션 최소화 존중 */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
</style>
