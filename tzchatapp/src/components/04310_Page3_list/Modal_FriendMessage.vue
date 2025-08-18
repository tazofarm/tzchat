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
/* ── Modal_FriendMessage: CSS 보정만 적용 ───────────────────────────────
   - 모달 쉘(ion-modal) 크기/라운드/백드롭 톤 통일
   - 내부 카드(.modal-container) 가독성/그림자/반응형 패딩
   - 헤더/본문/버튼 간격 및 폰트 스케일 통일
   - 긴 메시지 스크롤 안전(max-height)
   - 터치 타깃(≥40px), safe-area 하단 여백 반영
   - HTML/JS 변경 없음
────────────────────────────────────────────────────────────────────── */

/* 모달 자체 톤/크기 (Vue SFC scoped → :deep 필요) */
:deep(ion-modal) {
  --backdrop-opacity: 0.45;
  --width: min(92vw, 420px);
  --height: auto;                 /* 내용 높이에 맞춤 */
  --border-radius: 14px;
  --box-shadow: 0 10px 28px rgba(0,0,0,.20);
}
:deep(ion-modal)::part(content) {
  background: transparent;        /* 내부 카드만 흰 배경을 사용 */
  border-radius: 14px;            /* iOS에서 모서리 유지 */
  overflow: visible;              /* 그림자 잘리지 않도록 */
}

/* 카드 래퍼 */
.modal-container {
  background: #fff;
  color: #000;
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0,0,0,.12);
  padding: 16px 18px;
  font-size: clamp(14px, 2.6vw, 15px);
  max-height: min(86vh, 640px);   /* 작은 화면에서도 안전 */
  overflow: auto;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

/* 헤더: 타이틀 + 닫기 버튼 */
.modal-header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.modal-header h3 {
  margin: 0;
  font-size: clamp(16px, 3.2vw, 18px);
  font-weight: 800;
  color: #000;
  line-height: 1.25;
}
.modal-header ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;               /* 터치 타깃 */
  font-weight: 600;
}

/* 메시지 박스: 긴 텍스트 대비 */
.message-box {
  padding: 12px;
  background-color: #f6f6f6;
  border-radius: 10px;
  border: 1px solid #e5e5e5;
  margin-bottom: 12px;
  white-space: pre-wrap;
  line-height: 1.45;
  color: #111;
  max-height: 38vh;               /* 너무 길면 내부 스크롤 */
  overflow: auto;
}
.message-content {
  margin: 0;
  color: #333;
  word-break: break-word;
}

/* 버튼 열: 세로 스택 */
.button-row {
  display: grid;
  grid-auto-flow: row;
  gap: 8px;
}
.button-row ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 44px;               /* 터치 타깃 강화 */
  font-weight: 700;
}

/* 포커스 접근성 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 10px;
}

/* 초소형 화면(≤360px) 보정 */
@media (max-width: 360px) {
  .modal-container { padding: 14px; }
  .message-box { padding: 10px; }
}

</style>
