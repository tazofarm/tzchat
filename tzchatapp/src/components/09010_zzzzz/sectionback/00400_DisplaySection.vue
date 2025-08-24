<template>
  <ion-list inset class="section-root">
    <ion-list-header>
      <ion-label>화면 · 접근성</ion-label>
    </ion-list-header>

    <SettingRange
      v-model="settings.fontSize"
      label="글자 크기"
      :min="12"
      :max="24"
      :step="1"
      :icon="icons.textOutline"
      status="live"
      name="fontSize"
      unit="px"
      :start-text="`${settings.fontSize}px`"
      end-text="크게"
      @change="onRangeChange"
    />

    <SettingSelect
      v-model="settings.theme"
      label="테마"
      :options="themeOptions"
      :icon="icons.colorPaletteOutline"
      status="live"
      name="theme"
      @change="onSelectChange"
    />
  </ion-list>
</template>

<script setup lang="ts">
// ---------------------------------------------
// 00400_DisplaySection.vue
// - 글자 크기(레인지) / 테마(셀렉트) 즉시 반영
// ---------------------------------------------
import { IonList, IonListHeader, IonLabel } from '@ionic/vue'
import SettingRange from '../common/SettingRange.vue'
import SettingSelect from '../common/SettingSelect.vue'
import { textOutline, colorPaletteOutline } from 'ionicons/icons'
import { settings, saveToStorage, saveToServer, applyFontSize, applyTheme } from '../composables/useSettings'


const icons = { textOutline, colorPaletteOutline }

const themeOptions = [
  { label: '라이트',  value: 'light'  },
  { label: '다크',    value: 'dark'   },
  { label: '시스템 기본', value: 'system' }
]

function onRangeChange(payload: { name: string; value: number }) {
  console.log('[00400_DisplaySection] range change:', payload)
  ;(settings as any)[payload.name] = payload.value
  saveToStorage()
  applyFontSize(payload.value)
  saveToServer({ [payload.name]: payload.value })
}

function onSelectChange(payload: { name: string; value: string }) {
  console.log('[00400_DisplaySection] select change:', payload)
  ;(settings as any)[payload.name] = payload.value
  saveToStorage()
  applyTheme(payload.value)
  saveToServer({ [payload.name]: payload.value })
}
</script>

<style scoped>
.section-root { color: #000; } /* 가독성: 검정 */
</style>
