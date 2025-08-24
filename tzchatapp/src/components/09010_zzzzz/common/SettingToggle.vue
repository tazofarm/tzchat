<template>
  <ion-item lines="full">
    <ion-icon v-if="icon" slot="start" :icon="icon" aria-hidden="true" />
    <ion-label>
      {{ label }}
      <p v-if="description">{{ description }}</p>
    </ion-label>

    <ion-toggle
      slot="end"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || label"
      @ionChange="handleChange"
    />
    <ion-note slot="end" class="note-right">
      <SettingBadge :status="status" />
    </ion-note>
  </ion-item>
</template>

<script setup lang="ts">
// ---------------------------------------------
// SettingToggle.vue
// - 공용 토글 행: 아이콘/라벨/설명/토글/배지
// - v-model + change 이벤트로 상위에서 저장/적용
// ---------------------------------------------
import type { PropType } from 'vue'
import { IonItem, IonIcon, IonLabel, IonToggle, IonNote } from '@ionic/vue'
import SettingBadge from './SettingBadge.vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  // 🔧 여기 수정
  icon: { type: [String, Object] as PropType<string | Record<string, any>>, default: undefined },
  status: { type: String, default: 'stub' },
  disabled: { type: Boolean, default: false },
  name: { type: String, default: '' },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'change'])

function handleChange(ev: any) {
  const value = !!ev.detail.checked
  console.log('[SettingToggle] change:', props.name, '=>', value)
  emit('update:modelValue', value)
  emit('change', { name: props.name, value })
}
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   SettingSelect.vue — CSS 보정(템플릿/스크립트 변경 없음)
   목적
   - 모바일 가독성: 기본 검정 글씨, 라벨/값 대비 강화
   - 터치 타깃: 행 높이/여백 확장(≥56px)
   - 정렬: 라벨(좌), 값/배지(우) 정렬 안정화
   - 포커스 접근성: :focus-within 시 보더/섀도우 표시
   - 작은 화면 대응: 글자/폭 반응형(clamp)
   - 주석 풍부, 불필요 수정 없음
────────────────────────────────────────────────────────────── */

/* 이 컴포넌트 루트의 기본 텍스트 컬러(가독성) */
:host { color: #000; }

/* ===== Ion Item(한 행) 공통 레이아웃 보정 ===== */
ion-item {
  /* 배경/텍스트 */
  --background: #fff;
  --color: #000;

  /* 좌/우 패딩 & 최소 높이(터치 타깃) */
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 56px;

  /* 내부 보더(아래줄) 색상 */
  --inner-border-color: #eee;
  /* lines="full" 유지 (템플릿) */
}

/* 포커스 접근성: 내부 포커스가 들어오면 행을 살짝 강조 */
ion-item:focus-within {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.22);
  border-radius: 10px;
}

/* ===== 아이콘(선택) ===== */
ion-icon[slot="start"] {
  font-size: 18px;
  color: #444;              /* 라벨 대비 약간 약하게 */
  margin-right: 6px;
}

/* ===== 라벨(좌측 텍스트) ===== */
ion-label {
  /* 긴 라벨도 자연 줄바꿈, 너무 길면 2줄 정도로 표시 */
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;

  /* 가독성 스케일 */
  font-weight: 700;
  font-size: clamp(14px, 2.8vw, 16px);
  line-height: 1.3;
  color: #000;
}

/* ===== 셀렉트(우측 값) =====
   - slot="end" 이므로 오른쪽 정렬
   - 폭이 너무 좁아지지 않도록 최소폭 보장
*/
ion-select[slot="end"] {
  margin-left: auto;                        /* 우측 정렬 보강 */
  min-width: clamp(120px, 34vw, 220px);     /* 모바일에서 값이 잘리기 쉬워 폭 확보 */
  text-align: right;                        /* 텍스트 오른쪽 정렬 느낌 */
  --placeholder-opacity: 1;                 /* (브라우저별) placeholder 명시성 */
}

/* 셀렉트 내부 텍스트(값) - Shadow Parts */
ion-select::part(text) {
  color: #000;
  font-weight: 600;
  font-size: clamp(14px, 2.8vw, 15px);
}
ion-select::part(placeholder) {
  color: #777;
  font-weight: 500;
  font-size: clamp(14px, 2.8vw, 15px);
}

/* iOS/안드 기본 탭 하이라이트 완화 */
ion-select {
  -webkit-tap-highlight-color: rgba(0,0,0,0.06);
}

/* ===== 우측 배지(노트) ===== */
.note-right {
  margin-left: 8px; /* 기존 6px → 살짝 넉넉히 */
  display: inline-flex;
  align-items: center;
  color: #000;
  font-size: 12px;
}

/* ===== 초소형 화면(≤360px)에서 살짝 압축 ===== */
@media (max-width: 360px) {
  ion-item { --padding-start: 10px; --inner-padding-end: 10px; }
  ion-select[slot="end"] { min-width: clamp(110px, 36vw, 180px); }
}

/* ===== 사용자 모션 최소화 설정 존중 ===== */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}

</style>
