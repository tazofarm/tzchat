<template>
  <ion-list inset class="section-root theme-dark-gold">
    <!-- 🔹 헤더 (클릭 시 접기/펼치기) -->
    <ion-list-header class="section-header" @click="toggleCollapse">
      <ion-label class="section-title">
        알림
        <ion-icon
          :icon="collapsed ? icons.chevronForwardOutline : icons.chevronDownOutline"
          class="chevron"
        />
      </ion-label>
    </ion-list-header>

    <!-- 🔹 내용 (접힌 상태면 숨김) -->
    <transition name="fade">
      <div v-show="!collapsed">
        <SettingToggle
          v-model="settings.pushEnabled"
          label="푸시 알림"
          :icon="icons.notificationsOutline"
          status="stub"
          name="pushEnabled"
          @change="onChange"
        />

        <SettingToggle
          v-model="settings.messageNotif"
          label="메시지 알림"
          :icon="icons.chatbubbleOutline"
          status="stub"
          name="messageNotif"
          @change="onChange"
        />

        <SettingToggle
          v-model="settings.friendNotif"
          label="친구 신청 알림"
          :icon="icons.peopleOutline"
          status="stub"
          name="friendNotif"
          @change="onChange"
        />
      </div>
    </transition>
  </ion-list>
</template>

<script setup lang="ts">
// ---------------------------------------------
// 00300_NotificationSection.vue
// - 다크+골드 테마 + 접기/펼치기 기능
// ---------------------------------------------
import { ref } from 'vue'
import { IonList, IonListHeader, IonLabel } from '@ionic/vue'
import SettingToggle from '../common/SettingToggle.vue'
import {
  notificationsOutline,
  chatbubbleOutline,
  peopleOutline,
  chevronForwardOutline,
  chevronDownOutline
} from 'ionicons/icons'
import { settings, saveToStorage, saveToServer } from '../composables/useSettings'

const icons = {
  notificationsOutline,
  chatbubbleOutline,
  peopleOutline,
  chevronForwardOutline,
  chevronDownOutline
}

// ✅ 기본은 접힌 상태
const collapsed = ref(true)

function toggleCollapse() {
  collapsed.value = !collapsed.value
  console.log('[00300_NotificationSection] collapsed 상태:', collapsed.value)
}

function onChange(payload: { name: string; value: any }) {
  try {
    console.log('[00300_NotificationSection] onChange:', payload)
    ;(settings as any)[payload.name] = payload.value
    saveToStorage()
    saveToServer({ [payload.name]: payload.value })
  } catch (e) {
    console.error('[00300_NotificationSection] onChange 처리 예외', e)
  }
}
</script>

<style scoped>
/* ────────────── 다크+골드 테마 ────────────── */
.section-root {
  color: #e8e8e8;
  margin: 10px;
  background: #0f0f12;
  border: 1px solid #2a2a2a;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

/* 헤더 */
.section-header {
  padding: 10px 14px;
  background: #000;
  border-bottom: 1px solid #2a2a2a;
  cursor: pointer;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #d4af37;
  font-weight: 900;
  font-size: clamp(15px, 2.8vw, 16px);
}
.chevron {
  font-size: 18px;
  margin-left: 6px;
  color: #d4af37;
}

/* 토글 리스트 */
.section-root :deep(ion-item) {
  --background: #111216 !important;
  --color: #e8e8e8 !important;
  --inner-border-width: 0 0 1px 0 !important;
  --inner-border-color: #24262b !important;
}
.section-root :deep(ion-item:last-of-type) {
  --inner-border-width: 0 !important;
}
.section-root :deep(ion-item ion-icon) {
  color: #c49c2c;
}
.section-root :deep(ion-item ion-label) {
  color: #e8e8e8;
  font-weight: 700;
}

/* 토글 */
.section-root :deep(ion-toggle) {
  --track-background: #2e3138;
  --handle-background: #6a6f7a;
  --track-background-checked: #d4af37;
  --handle-background-checked: #f1ce6a;
}

/* 접기/펼치기 전환 효과 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  max-height: 0;
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
