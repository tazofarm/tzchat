<template>
  <ion-item button lines="full" detail @click="handleClick">
    <ion-icon v-if="icon" slot="start" :icon="icon" aria-hidden="true" />
    <ion-label :class="[{ 'danger-text': color==='danger' }]">
      <slot>{{ label }}</slot>
    </ion-label>
    <ion-note slot="end" class="note-right">
      <SettingBadge :status="status" />
    </ion-note>
  </ion-item>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { IonItem, IonLabel, IonIcon, IonNote } from '@ionic/vue'
import SettingBadge from './SettingBadge.vue'

const props = defineProps({
  label: { type: String, default: '' },
  // string(icon name from ionicons) | object(다른 아이콘 구현체)
  icon: { type: [String, Object] as PropType<string | Record<string, any>>, default: undefined },
  status: { type: String, default: 'stub' }, // live | local | stub
  name: { type: String, default: '' },
  color: { type: String, default: 'default' } // default | danger
})
const emit = defineEmits<{
  (e: 'click', payload: { name: string }): void
}>()

function handleClick() {
  console.log('[SettingItemRow] click:', props.name)
  emit('click', { name: props.name })
}
</script>

<style scoped>
/* ────────────────────────────────────────────────────────────────
   SettingItemRow.vue — CSS만 보정 (구조/JS 불변)
   - IonItem: 터치 타깃(≥56px), 패딩/분리선, 라이트 배경 고정
   - 타이포: 레이블 글자 크기/굵기, 검정 고정(가독성)
   - 아이콘/배지: 크기/정렬 보정
   - 포커스/액티브 상태: 접근성 링 + 눌림 피드백
   - 초소형 화면/모션 최소화 대응
──────────────────────────────────────────────────────────────── */

/* 기본 가독성: 검정 */
:host { color: #000; }

/* 행(아이템) 공통 */
ion-item {
  /* 배경/텍스트 */
  --background: #fff;
  --color: #000;

  /* 터치 타깃/패딩(좌/우) */
  --min-height: 56px;
  --padding-start: 12px;
  --inner-padding-end: 12px;

  /* 분리선(하단 1px) */
  --border-color: #eee;
  --border-width: 0 0 1px 0;

  /* 터치 피드백(리플) */
  --ripple-color: rgba(59,130,246,.2);
}

/* 마지막 요소는 분리선 제거 */
ion-item:last-of-type { --border-width: 0; }

/* 버튼 모드 기본 보정 */
ion-item[button] {
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: rgba(0,0,0,0.06);
}

/* 눌림(activated) 시 살짝 하이라이트 */
ion-item.ion-activated { background: #f6f9ff; }

/* 레이블(텍스트) */
ion-label {
  font-size: clamp(14px, 2.6vw, 15px);
  line-height: 1.3;
  font-weight: 600;
  color: #000;
  margin: 0; /* 예기치 않은 상하 여백 방지 */
}

/* 경고 색상 옵션 */
.danger-text { color: #b00020; font-weight: 700; }

/* 시작 아이콘 영역(ion-icon은 폰트 크기로 사이즈 조절) */
ion-icon[slot="start"] {
  font-size: 20px;     /* 약 20px 아이콘 */
  color: #666;
  margin-right: 6px;   /* 텍스트와 간격 */
}

/* 우측 노트/배지 정렬 */
.note-right {
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #444;
}

/* 키보드 포커스 접근성(:focus-visible만) */
ion-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 10px;
}

/* 초소형 화면(≤360px)에서 살짝 컴팩트하게 */
@media (max-width: 360px) {
  ion-item { --padding-start: 10px; --inner-padding-end: 10px; }
  ion-label { font-size: 14px; }
  ion-icon[slot="start"] { font-size: 18px; }
}

/* 사용자 접근성 설정 존중: 모션 최소화 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
</style>

