<template>
  <!-- 상태 배지 (live/local/stub) -->
  <span :class="badgeClass">{{ badgeText }}</span>
</template>

<script setup>
// ---------------------------------------------
// SettingBadge.vue
// - 상태 배지 텍스트/색상 일원화 (실제동작/로컬저장/준비중)
// ---------------------------------------------
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'stub' } // 'live' | 'local' | 'stub'
})

const badgeText = computed(() => {
  if (props.status === 'live') return '실제동작'
  if (props.status === 'local') return '로컬저장'
  return '준비중'
})

const badgeClass = computed(() => {
  return [
    'setting-badge',
    props.status === 'live' ? 'badge-live'
      : props.status === 'local' ? 'badge-local'
      : 'badge-stub'
  ].join(' ')
})
</script>

<style scoped>
/* ── SettingBadge.vue: CSS 보정만 적용 ───────────────────────────────
   - 가독성: 기본 글자색 검정 유지, 부드러운 파스텔 배경
   - 타이포: clamp()로 폰트 스케일 안정화(모바일~데스크탑)
   - 레이아웃: 불필요한 줄바꿈 방지, 수직 정렬, 둥근 캡슐
   - 상태색: live/local/stub 테마 일관화(+ 좌측 컬러 점 표시)
   - 접근성: :focus-visible 포커스 링, 고대비 모드 대응
   - HTML/JS 변경 없음
------------------------------------------------------------------- */

.setting-badge {
  display: inline-block;
  vertical-align: middle;
  white-space: nowrap;

  padding: 3px 10px;                     /* 터치/클릭 시 실수 적게 */
  border-radius: 999px;                   /* 완전한 캡슐 */
  border: 1px solid #aaa;

  background: #f6f6f6;                    /* 기본 배경 */
  color: #000;                             /* 가독성: 검정 텍스트 */
  font-size: clamp(12px, 2.8vw, 13px);
  line-height: 1.25;
  letter-spacing: 0.1px;

  user-select: none;                       /* 뱃지 텍스트 선택 방지 */
  -webkit-font-smoothing: antialiased;
  position: relative;                      /* before 점 배치용 */
}

/* 좌측 작은 컬러 점 (상태 시각 강조) */
.setting-badge::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: 50%;
  position: absolute;
  left: 6px;                               /* 내부 여백과 어울리게 */
  top: 50%;
  transform: translateY(-50%);
  background: #9e9e9e;                     /* 기본(Stub) 점 색 */
}

/* 내부 텍스트가 점과 겹치지 않도록 좌측 패딩 보정 */
.setting-badge { padding-left: 16px; }

/* 상태별 테마 */
.badge-live  {
  border-color: #2e7d32;
  background: #e8f5e9;                    /* 연녹 */
}
.badge-live::before  { background: #2e7d32; }

.badge-local {
  border-color: #1565c0;
  background: #e3f2fd;                    /* 연파 */
}
.badge-local::before { background: #1565c0; }

.badge-stub  {
  border-color: #9e9e9e;
  background: #f5f5f5;                    /* 연회 */
}
.badge-stub::before  { background: #9e9e9e; }

/* 키보드 포커스 접근성 */
.setting-badge:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
}

/* 고대비 환경 보조 */
@media (prefers-contrast: more) {
  .setting-badge {
    border-width: 2px;
  }
}

</style>
