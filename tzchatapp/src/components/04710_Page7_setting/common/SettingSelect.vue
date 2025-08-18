<template>
  <ion-item lines="full">
    <ion-icon v-if="icon" slot="start" :icon="icon" aria-hidden="true" />
    <ion-label>{{ label }}</ion-label>

    <ion-select
      slot="end"
      interface="popover"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="ariaLabel || label"
      @ionChange="handleChange"
    >
      <ion-select-option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </ion-select-option>
    </ion-select>

    <ion-note slot="end" class="note-right">
      <SettingBadge :status="status" />
    </ion-note>

    <slot name="suffix" />
  </ion-item>
</template>

<script setup lang="ts">
// ---------------------------------------------
// SettingSelect.vue
// - 공용 셀렉트 행: 아이콘/라벨/셀렉트/배지
// - v-model + change 이벤트
// ---------------------------------------------
import type { PropType } from 'vue'
import { IonItem, IonIcon, IonLabel, IonSelect, IonSelectOption, IonNote } from '@ionic/vue'
import SettingBadge from './SettingBadge.vue'

type Opt = { label: string; value: string | number }

const props = defineProps({
  modelValue: { type: [String, Number], required: true },
  label: { type: String, required: true },
  options: { type: Array as () => Opt[], default: () => [] },
  // 🔧 여기 수정
  icon: { type: [String, Object] as PropType<string | Record<string, any>>, default: undefined },
  status: { type: String, default: 'stub' },
  placeholder: { type: String, default: '' },
  name: { type: String, default: '' },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'change'])

function handleChange(ev: any) {
  const value = ev.detail.value
  console.log('[SettingSelect] change:', props.name, '=>', value)
  emit('update:modelValue', value)
  emit('change', { name: props.name, value })
}
</script>

<style scoped>
:host { color: #000; } /* 가독성: 검정 */
.note-right { margin-left: 6px; }
</style>
