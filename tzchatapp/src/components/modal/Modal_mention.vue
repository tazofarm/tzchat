<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>소개 정보</h3>
      <p class="popup-text">{{ message }}</p>
      <ion-button expand="block" color="primary" @click="$emit('close')">닫기</ion-button>
    </div>
  </div>
</template>

<script setup>
import { IonButton } from '@ionic/vue'
defineProps({ message: String })
defineEmits(['close'])
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.popup-content {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  text-align: center;
  width: 80%;
  max-width: 300px;
}
.popup-text {
  color: #000;
}
</style>
