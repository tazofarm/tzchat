<template>
  <ion-list inset class="section-root">
    <ion-list-header>
      <ion-label>백업 · 복원</ion-label>
    </ion-list-header>

    <ion-item button detail @click="onBackup">
      <ion-label>설정 백업 (데모)</ion-label>
    </ion-item>
    <ion-item button detail @click="onRestore">
      <ion-label>설정 복원 (데모)</ion-label>
    </ion-item>

    <ion-item lines="none">
      <ion-label>
        <div class="placeholder-desc">클라우드/파일 기반 백업 연동은 이후 진행됩니다.</div>
      </ion-label>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
// 01000_BackupRestoreSection.vue
import { IonList, IonListHeader, IonLabel, IonItem } from '@ionic/vue'
import { settings } from '../composables/useSettings'

function onBackup() {
  try {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tzchat-settings-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    console.log('[01000_BackupRestoreSection] 백업 완료(데모)')
  } catch (e) {
    console.error('[01000_BackupRestoreSection] 백업 실패:', e)
    alert('백업 실패')
  }
}

function onRestore() {
  alert('복원 (데모)\n실제 구현 시 파일 선택 후 검증/머지 로직이 필요합니다.')
  console.log('[01000_BackupRestoreSection] 복원 클릭(데모)')
}
</script>

<style scoped>
.section-root { color: #000; }
.placeholder-desc { font-size: 0.9rem; color: #444; }
</style>
