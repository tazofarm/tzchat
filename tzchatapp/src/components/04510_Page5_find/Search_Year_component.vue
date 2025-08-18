<template>
  <!-- 검색나이 카드 -->
  <div class="card editable-card" @click="$emit('open')">
    <!-- 제목 -->
    <div class="card-title">검색나이</div>

    <!-- 값 표시: null 또는 빈 문자열이면 '전체' -->
    <div class="card-value">
      {{
        (!birthyear1 ? '전체' : birthyear1) +
        ' ~ ' +
        (!birthyear2 ? '전체' : birthyear2)
      }}
    </div>
  </div>
</template>

<script setup>
// Props 정의: null, string, number 모두 허용
defineProps({
  birthyear1: {
    type: [String, Number, null],
    default: null
  },
  birthyear2: {
    type: [String, Number, null],
    default: null
  }
})

// open 이벤트 발생
defineEmits(['open'])
</script>

<style scoped>
/* ── Search_Year_component.vue: CSS 보정만 적용 ───────────────────────
   - 카드 스타일을 프로젝트 공통(Preference 카드와 동일 톤)으로 통일
   - 가독성: 검정 텍스트, 적절한 여백/라운드/그림자
   - 상호작용: hover/active/focus-visible 시각 피드백
   - 타이포: clamp()로 모바일~데스크톱 폰트 스케일 안정화
   - HTML/JS 변경 없음
--------------------------------------------------------------------- */

/* 카드 공통 */
.card {
  border: 1px solid #ddd;                 /* #ccc → #ddd (일관 톤) */
  border-radius: 12px;                    /* 8px → 12px (공통 라운드) */
  padding: 14px;                          /* 1rem → 14px (공통 내부 여백) */
  margin-bottom: 12px;                    /* 1rem → 12px (공통 간격) */
  background-color: #fff;
  color: #000;                            /* 가독성: 검정 텍스트 */
  box-shadow: 0 2px 6px rgba(0,0,0,.04);  /* 은은한 깊이감 */
  transition: background-color .15s,
              box-shadow .15s,
              border-color .15s,
              transform .06s ease-out;    /* active 눌림감 */
  -webkit-font-smoothing: antialiased;
}

/* 클릭 가능한 카드 상호작용 */
.editable-card { cursor: pointer; }
.editable-card:hover { background-color: #f7f7f7; }   /* 살짝 강조 */
.editable-card:active { transform: translateY(1px); } /* 눌림 효과 */
.editable-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);        /* 접근성 포커스 링 */
  border-radius: 12px;
}

/* 제목 */
.card-title {
  font-weight: 800;                               /* 굵게 */
  font-size: clamp(14px, 2.8vw, 15px);            /* 반응형 타이포 */
  margin-bottom: 6px;                             
  color: #111;
  letter-spacing: .1px;
}

/* 값(나이 범위) */
.card-value {
  font-size: clamp(15px, 3vw, 16px);              /* 본문 크기 살짝 ↑ */
  color: #000;
  line-height: 1.35;                               /* 가독성 보강 */
  word-break: break-word;                          /* 긴 숫자/텍스트 안전 */
}

</style>
