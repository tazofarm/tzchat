<template>
  <div class="card editable-card" @click="$emit('open')">
    <div class="card-title">검색특징</div>
    <div class="card-value">{{ preference || '전체' }}</div>
  </div>
</template>

<script setup>
defineProps({ preference: String })
defineEmits(['open'])
</script>

<style scoped>
/* ── Modal_FriendMessage.vue: CSS 보정만 적용 ─────────────────────────
   - IonModal 내부 카드 톤/간격/라운드 보강
   - 헤더 정렬(제목 왼쪽, 닫기 오른쪽) + 높이 50px
   - 본문 말줄임/줄바꿈 가독성, 폰트 스케일(clamp)
   - 버튼 열: 터치 타깃(≥40px), 간격/라운드 통일
   - safe-area(inset-bottom) 반영
-------------------------------------------------------------------- */

.modal-container {
  background: #fff;
  color: #000;
  padding: 12px;
  border-radius: 14px;
  box-sizing: border-box;
  min-width: min(92vw, 420px);
  max-width: 640px;
  margin: 0 auto;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.modal-header {
  display: grid;
  grid-template-columns: 1fr auto; /* 제목 | 닫기 */
  align-items: center;
  height: 50px;                     /* 공통 헤더 높이 */
  margin: 0 0 8px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: clamp(16px, 3.2vw, 18px);
  font-weight: 800;
  color: #000;
}

.modal-header ion-button {
  --border-radius: 10px;
  --padding-start: 10px;
  --padding-end: 10px;
  min-height: 36px;
}

/* 메시지 박스 */
.message-box {
  padding: 10px 12px;
  background-color: #f6f6f6;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  margin: 10px 0 12px;
}

.message-content {
  margin: 0;
  color: #222;
  font-size: clamp(14px, 2.8vw, 15px);
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 버튼 열 */
.button-row {
  display: grid;
  grid-auto-flow: row;
  gap: 8px;
}

.button-row ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;                 /* 터치 타깃 */
  font-weight: 700;
}

/* 초소형 기기 보정 */
@media (max-width: 360px) {
  .modal-container { padding: 10px; }
  .message-box { padding: 8px 10px; }
}

</style>
