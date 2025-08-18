<template>
  <ion-item lines="full">
    <ion-icon v-if="icon" slot="start" :icon="icon" aria-hidden="true" />
    <ion-label>{{ label }}</ion-label>

    <ion-range
      slot="end"
      :min="min"
      :max="max"
      :step="step"
      :snaps="snaps"
      :ticks="ticks"
      :value="modelValue"
      :aria-label="ariaLabel || label"
      @ionChange="handleChange"
    >
      <ion-label slot="start">
        <!-- 슬롯이 있으면 슬롯 사용, 없으면 startText → 기본값 순으로 표시 -->
        <slot name="start">{{ computedStart }}</slot>
      </ion-label>
      <ion-label slot="end">
        <slot name="end">{{ computedEnd }}</slot>
      </ion-label>
    </ion-range>

    <ion-note slot="end" class="note-right">
      <SettingBadge :status="status" />
    </ion-note>
  </ion-item>
</template>

<script setup lang="ts">
// ---------------------------------------------
// SettingRange.vue
// - 공용 레인지(슬라이더) 행: 아이콘/라벨/슬라이더/배지
// - v-model + change 이벤트
// - start/end 슬롯 없이도 props로 대체 가능(startText/endText)
// ---------------------------------------------
import type { PropType } from 'vue'
import { computed } from 'vue'
import { IonItem, IonIcon, IonLabel, IonRange, IonNote } from '@ionic/vue'
import SettingBadge from './SettingBadge.vue'

const props = defineProps({
  modelValue: { type: Number, required: true },
  label: { type: String, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  step: { type: Number, default: 1 },
  snaps: { type: Boolean, default: true },
  ticks: { type: Boolean, default: true },
  // 🔧 여기 수정
  icon: { type: [String, Object] as PropType<string | Record<string, any>>, default: undefined },
  status: { type: String, default: 'stub' },
  name: { type: String, default: '' },
  unit: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  startText: { type: String, default: '' },
  endText: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'change'])

const computedStart = computed(() =>
  props.startText !== '' ? props.startText : `${props.modelValue}${props.unit}`
)
const computedEnd = computed(() =>
  props.endText !== '' ? props.endText : 'max'
)

function handleChange(ev: any) {
  const value = Number(ev.detail.value)
  console.log('[SettingRange] change:', props.name, '=>', value)
  emit('update:modelValue', value)
  emit('change', { name: props.name, value })
}
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   SettingRange.vue - CSS만 보정(HTML/JS 변경 없음)
   목적
   - 모바일 가독성(검정 텍스트) & 터치 타깃(≥56px) 확보
   - IonItem 내부 간격·정렬 정돈, Range 가시성/대비 개선
   - 키보드 포커스 접근성(:focus-visible), 작은 화면 대응
   - Ionic Range 테마 변수로 색/두께/노브 크기 튜닝
────────────────────────────────────────────────────────────── */

/* 컴포넌트 기본 텍스트 컬러 고정(가독성) */
:host { color: #000; }

/* ===== 행 컨테이너(IonItem) ===== */
ion-item {
  /* 안쪽 패딩/최소 높이: 터치 타깃 확보 */
  --padding-start: 12px;
  --inner-padding-end: 10px;
  --min-height: 56px;

  /* 라이트 배경/텍스트 고정 */
  --background: #fff;
  color: #000;

  /* 아래쪽 1px 라인(리스트일 때 자연스럽게) */
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: #eee;

  /* 스크롤/바운스 최소화 */
  overscroll-behavior: contain;
}

/* 시작(아이콘) 여백 살짝 확보 */
ion-icon[slot="start"] {
  margin-right: 8px;
}

/* 라벨(설정명) 타이포 */
ion-item > ion-label {
  font-weight: 700;
  font-size: clamp(14px, 2.6vw, 15px);
  line-height: 1.25;
  color: #000;
  margin-right: 8px; /* Range와 간격 */
  min-width: 92px;   /* 너무 붙지 않도록 최소폭 */
}

/* ===== Range 자체 ===== */
ion-range {
  /* 레이아웃: end 슬롯이더라도 넓게 차지하도록 */
  flex: 1 1 auto;
  min-width: 180px;
  max-width: 100%;
  margin-left: 6px;

  /* 트랙/활성/노브/틱 테마 변수 */
  --bar-background: #e5e7eb;           /* 비활성 트랙 */
  --bar-background-active: #3b82f6;    /* 활성 트랙 */
  --bar-border-radius: 999px;
  --bar-height: 6px;

  --knob-background: #111;             /* 노브 색 */
  --knob-size: 18px;                    /* 노브 크기 */

  --tick-background: #cfd8e3;          /* 틱 기본 */
  --tick-background-checked: #3b82f6;  /* 틱 활성 */
  --tick-width: 2px;
  --tick-height: 8px;
}

/* Range의 start/end 보조 라벨(숫자/단위 등) */
ion-range > ion-label[slot="start"],
ion-range > ion-label[slot="end"] {
  font-size: clamp(12px, 2.2vw, 13px);
  color: #333;
  user-select: none;
}

/* 오른쪽 배지 노트 간격 */
.note-right {
  margin-left: 8px;
  white-space: nowrap;
}

/* 포커스 접근성: 키보드로 이동 시 링 표시 */
ion-range:focus-visible,
ion-item:has(ion-range:focus-visible) {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.3);
  border-radius: 12px;
}

/* 초소형 화면(≤360px)에서 여백 축소 */
@media (max-width: 360px) {
  ion-item { --padding-start: 10px; --inner-padding-end: 8px; }
  ion-item > ion-label { margin-right: 6px; min-width: 84px; }
  ion-range { min-width: 150px; }
  .note-right { margin-left: 6px; }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}

</style>
