<!-- src/components/modal/FriendRequestModal.vue -->
<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>📩 {{ toNickname }}님에게 친구 신청</h3>

      <ion-textarea
        v-model="message"
        placeholder="신청 메시지를 입력하세요"
        rows="5"
      ></ion-textarea>

      <div class="button-group">
        <ion-button @click="sendRequest" color="primary">신청하기</ion-button>
        <ion-button @click="$emit('close')" color="medium">취소</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton, IonTextarea } from '@ionic/vue'

const props = defineProps({
  toUserId: String,
  toNickname: String
})

const emit = defineEmits(['close', 'request-sent'])

const message = ref('')

const sendRequest = async () => {
  try {
    const res = await axios.post('/api/friend-request', {
      to: props.toUserId,
      message: message.value
    }, { withCredentials: true })

    alert(res.data.message || '친구 신청 완료!')
    emit('request-sent') // 부모에게 알림
    emit('close')         // 팝업 닫기
  } catch (err) {
    console.error('❌ 친구 신청 실패:', err)
    alert('신청 중 오류가 발생했습니다.')
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}
.modal {
  background: white;
  padding: 1rem;
  border-radius: 10px;
  width: 90%;
  max-width: 400px;
  box-sizing: border-box;
  color: black;
}
.button-group {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
