<template>
  <div class="setting-section">
    <h3>비밀번호 변경</h3>
    <ion-item>
      <ion-label position="stacked">현재 비밀번호</ion-label>
      <ion-input v-model="currentPassword" type="password" placeholder="현재 비밀번호 입력" />
    </ion-item>

    <ion-item>
      <ion-label position="stacked">새 비밀번호</ion-label>
      <ion-input v-model="newPassword" type="password" placeholder="새 비밀번호 입력" />
    </ion-item>

    <ion-item>
      <ion-label position="stacked">새 비밀번호 확인</ion-label>
      <ion-input v-model="confirmPassword" type="password" placeholder="비밀번호 재입력" />
    </ion-item>

    <ion-button expand="block" color="primary" @click="handleChangePassword">비밀번호 변경</ion-button>
    <p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonItem, IonLabel, IonInput, IonButton } from '@ionic/vue'

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const message = ref('')

const handleChangePassword = async () => {
  message.value = ''

  if (newPassword.value !== confirmPassword.value) {
    message.value = '새 비밀번호가 일치하지 않습니다.'
    return
  }

  try {
    const res = await axios.put('/api/update-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    })

    message.value = res.data.message || '비밀번호가 변경되었습니다.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    message.value = err.response?.data?.error || '비밀번호 변경 실패'
  }
}
</script>

<style scoped>
.setting-section {
  padding: 1rem;
  border-bottom: 1px solid #ddd;
}

.message {
  margin-top: 0.5rem;
  color: red;
  font-size: 0.9rem;
}
</style>
