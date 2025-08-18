<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>닉네임 수정</h3>

      <input
        v-model="newNickname"
        type="text"
        placeholder="새 닉네임을 입력하세요"
        class="nickname-input"
      />

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitNickname">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'

// 🔹 Props: 기존 닉네임 전달받음
const props = defineProps({
  message: String
})

// 🔹 Emits: 부모에 닫기(close) 및 수정 완료(updated) 전달
const emit = defineEmits(['close', 'updated'])

const newNickname = ref(props.message || '')
const errorMsg = ref('')
const successMsg = ref('')

// 🔧 닉네임 수정 요청
const submitNickname = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const trimmed = newNickname.value.trim()

  // 입력 유효성 검사
  if (!trimmed) {
    errorMsg.value = '닉네임을 입력하세요.'
    return
  }
  if (trimmed === props.message) {
    errorMsg.value = '기존 닉네임과 동일합니다.'
    return
  }

  try {
    // 닉네임 PUT 요청
    const response = await axios.put(
      '/api/update-nickname',
      { nickname: trimmed },
      { withCredentials: true }
    )

    if (response.data.success) {
      console.log(`[닉네임 수정 성공] → ${trimmed}`)
      successMsg.value = '닉네임이 성공적으로 수정되었습니다.'

      // 1초 후 닫기 및 부모에 변경 알림
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 1000)
    } else {
      errorMsg.value = response.data.message || '닉네임 수정 실패'
      console.warn(`[닉네임 수정 실패] → ${errorMsg.value}`)
    }
  } catch (err) {
    console.error('[닉네임 수정 중 오류]', err)
    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* ── Modal_Nickname.vue: CSS 보정만 적용 ───────────────────────────────
   - 오버레이: 전체 덮기, 배경 블러/딤, 스크롤 체인 방지, 안전영역 반영
   - 카드: 가독성(검정), 라운드/그림자, 반응형 폭/패딩, 최대 높이 처리
   - 제목/입력/버튼/메시지 타이포 clamp()로 모바일~데스크탑 스케일 안정화
   - 입력 포커스 링/placeholder 톤, 버튼 터치 타깃(≥40px)
   - 모션 최소화 환경 대응
   - HTML/JS 변경 없음
────────────────────────────────────────────────────────────────────── */

/* 오버레이(뒷배경) */
.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  background-color: rgba(0, 0, 0, 0.45); /* 딤 */
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);

  padding:
    env(safe-area-inset-top, 0px)
    env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);

  overscroll-behavior: contain;  /* 스크롤 체인/바운스 방지 */
  z-index: 1000;
  cursor: default;
}

/* 콘텐츠 카드 */
.popup-content {
  width: min(92vw, 360px);
  max-height: min(86vh, 640px);  /* 너무 커지지 않도록 */
  overflow: auto;                /* 내용 많을 때 내부 스크롤 */

  background: #ffffff;
  color: #000000;                /* 가독성: 검정 텍스트 */
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.20);
  padding: 16px 18px;

  animation: modal-in .18s ease-out;
  transform-origin: center;
  -webkit-font-smoothing: antialiased;
}

/* 제목 */
.popup-content h3 {
  margin: 0 0 10px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
  color: #000;
  letter-spacing: 0.1px;
  text-wrap: balance;
}

/* 입력창 */
.nickname-input {
  width: 100%;
  padding: 10px 12px;
  margin: 12px 0;
  font-size: clamp(14px, 2.8vw, 15px);
  line-height: 1.4;

  background: #fff;
  color: #000;
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  outline: none;

  transition: box-shadow .15s, border-color .15s, background-color .15s;
}
.nickname-input::placeholder { color: #999; }
.nickname-input:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.28);
}

/* 메시지 */
.error-msg,
.success-msg {
  margin: 4px 0 0;
  font-size: clamp(13px, 2.8vw, 14px);
  line-height: 1.35;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 버튼 그룹 */
.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 닫기 | 수정 */
  gap: 8px;
  margin-top: 12px;
}
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;              /* 터치 타깃 */
  font-weight: 700;
}

/* 초소형 기기(≤360px)에서는 버튼 세로 스택 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; }
  .button-group { grid-template-columns: 1fr; }
}

/* 접근성: 키보드 포커스 링(안전망) */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
  border-radius: 10px;
}

/* 모션 최소화 환경 */
@media (prefers-reduced-motion: reduce) {
  .popup-content { animation: none !important; }
}

/* 등장 애니메이션 */
@keyframes modal-in {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}

</style>
