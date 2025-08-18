<template>
  <!-- 회원 탈퇴 모달(제목만 표시) -->
  <ion-modal
    :is-open="isOpen"
    @didDismiss="$emit('close')"
    class="simple-modal"
  >
    <ion-header>
      <ion-toolbar color="danger">
        <ion-title>회원 탈퇴</ion-title>
        <ion-buttons slot="end">
          <ion-button color="light" @click="$emit('close')">닫기</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="modal-body">
        <h2>회원 탈퇴</h2>
        <!-- 요구사항: 제목만 출력 -->
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
// ---------------------------------------------
// DeleteAccountModal.vue
// - 제목만 간단히 출력하는 모달
// - 닫기 시 close emit
// - 로그 추가
// ---------------------------------------------
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent
} from '@ionic/vue'
import { watch } from 'vue'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

watch(() => props.isOpen, (v) => {
  console.log(`[DeleteAccountModal] isOpen 변경: ${v}`)
})
</script>

<style scoped>
.simple-modal {
  color: #000;
}
.modal-body {
  color: #000;
  padding: 16px;
}
.modal-body h2 {
  margin: 12px 0;
  font-weight: 800;
}
</style>
