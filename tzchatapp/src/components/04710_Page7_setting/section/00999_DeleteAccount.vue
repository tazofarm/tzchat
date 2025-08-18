<template>
  <ion-list inset class="settings-section">
    <!-- ✅ 헤더(“회원”) -->
    <ion-list-header class="settings-header">
      <ion-label>회원</ion-label>
    </ion-list-header>

    <!-- ✅ 회원 탈퇴 아이템(행) -->
    <ion-item
      button
      detail
      @click="openDeleteModal"
      class="settings-item"
      color="danger"
    >
      <ion-icon :icon="icons.trashOutline" slot="start" class="settings-icon" />
      <ion-label class="settings-label">회원 탈퇴</ion-label>
    </ion-item>
  </ion-list>

  <!-- 회원 탈퇴 모달 -->
  <DeleteAccountModal :is-open="isDeleteOpen" @close="closeDeleteModal" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonList, IonListHeader, IonLabel, IonItem, IonIcon } from '@ionic/vue'
import { trashOutline } from 'ionicons/icons'
import DeleteAccountModal from '../section_modals/00999_DeleteAccountModal.vue'

const icons = { trashOutline }
const isDeleteOpen = ref(false)

const openDeleteModal = () => {
  console.log('[MemberSection] 회원 탈퇴 클릭 → 모달 오픈')
  isDeleteOpen.value = true
}
const closeDeleteModal = () => {
  console.log('[MemberSection] 회원 탈퇴 모달 닫힘')
  isDeleteOpen.value = false
}
</script>

<style scoped>

</style>
