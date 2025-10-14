<template>
  <!-- Speed Matching 헤더 -->
  <div class="speed-head" role="group" aria-label="Speed Matching Toggle">
    <div class="speed-title">
      <ion-icon :icon="icons.flameOutline" aria-hidden="true" class="title-icon" />
      <ion-label class="black-text">Speed Matching</ion-label>
    </div>

    <div v-if="emergencyOn" class="inline-timer black-text" aria-live="polite">
      <ion-icon :icon="icons.timerOutline" aria-hidden="true" class="inline-icon" />
      <span class="timer-text">{{ formattedTime }}</span>
    </div>

    <ion-toggle
      :checked="emergencyOn"
      @ionChange="onToggle"
      color="success"
      aria-label="Speed Matching On/Off"
    />
  </div>
</template>

<script setup>
import { IonIcon, IonToggle, IonLabel } from '@ionic/vue'
import { flameOutline, timerOutline } from 'ionicons/icons'

defineProps({
  emergencyOn: { type: Boolean, default: false },
  /** 부모에서 계산된 포맷 시간을 그대로 노출 */
  formattedTime: { type: String, default: '' },
})

const emit = defineEmits(['toggle'])

const icons = { flameOutline, timerOutline }

const onToggle = (ev) => {
  const next = !!ev?.detail?.checked
  emit('toggle', next)
}
</script>

<style scoped>
/* ===== Speed Matching 헤더 ===== */
.speed-head{
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 6px 2px 10px;
  border-bottom: 1px solid var(--divider, #26262a);
  color: var(--text, #d7d7d9);
}
.speed-title{ display:inline-flex; align-items:center; gap:8px; }
.title-icon{ font-size:18px; color: var(--gold, #d4af37); }
.black-text{ color: var(--text-strong, #f3f3f3); }
.inline-timer{ display:inline-flex; align-items:center; gap:8px; font-weight:800; font-size:14px; color:var(--text-strong, #f3f3f3); white-space:nowrap; }
.inline-icon{ margin-right:0; vertical-align:-2px; color:var(--gold, #d4af37); }

/* IonToggle OFF 상태 가시성 강화 */
ion-toggle {
  --handle-background: #f3f3f3;        /* 동그라미 색상 */
  --handle-background-checked: #fff;   /* 켜졌을 때 동그라미 */
  
  --track-background: #555;            /* 꺼졌을 때 트랙 */
  --track-background-checked: #2dd36f; /* 켜졌을 때 트랙(기본 success) */
  
  --track-border-radius: 9999px;
  --handle-border-radius: 50%;

}

</style>
