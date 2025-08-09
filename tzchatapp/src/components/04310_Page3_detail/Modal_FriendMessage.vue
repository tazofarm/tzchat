<template>
  <ion-modal :is-open="true" @didDismiss="closeModal">
    <div class="modal-container">
      <!-- 닫기 버튼 -->
      <div class="modal-header">
        <h3>📨 친구 신청 인사말</h3>
        <ion-button size="small" fill="clear" @click="closeModal">닫기</ion-button>
      </div>

      <!-- 메시지 본문 -->
      <div class="message-box">
        <p class="message-content">
          {{ request.message || '메시지가 없습니다.' }}
        </p>
      </div>

      <!-- 수락/거절/차단 버튼 -->
      <div class="button-row">
        <ion-button color="success" expand="block" @click="accept">수락</ion-button>
        <ion-button color="medium" expand="block" @click="reject">거절</ion-button>
        <ion-button color="danger" expand="block" @click="block">차단</ion-button>
      </div>
    </div>
  </ion-modal>
</template>

<script setup>
import { IonModal, IonButton } from '@ionic/vue'

const props = defineProps({
  request: Object, // request 객체 전체를 받음 (message, _id, from 등)
})

const emit = defineEmits(['close', 'accepted', 'rejected', 'blocked'])

// 닫기
const closeModal = () => emit('close')

// 버튼 이벤트
const accept = () => emit('accepted', props.request._id)
const reject = () => emit('rejected', props.request._id)
const block = () => emit('blocked', props.request._id)
</script>

<style scoped>
.modal-container {
  padding: 1rem;
  background-color: white;
  color: black;
  font-size: 0.9rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.message-box {
  padding: 0.8rem;
  background-color: #f4f4f4;
  border-radius: 6px;
  margin-bottom: 1rem;
  white-space: pre-wrap;
  font-size: 0.9rem;
}

.message-content {
  margin: 0;
  color: #333;
}

.button-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
