<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>소개 수정</h3>

      <!-- 🔸 소개 입력 textarea -->
      <textarea
        v-model="newIntro"
        placeholder="소개 내용을 입력하세요"
        class="intro-textarea"
        rows="4"
      ></textarea>

      <!-- 🔸 오류/성공 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 🔸 버튼 그룹: 닫기 / 수정 -->
      <div class="button-group">
        
        <ion-button expand="block" color="primary" @click="submitIntro">수정</ion-button>
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* ------------------------------------------------------------------
   Modal_mention.vue
   - 프로필 소개 수정 모달
   - api 사용 (세션 쿠키 포함)
   - 검증/에러/성공 메시지 출력 + 부모 반영
------------------------------------------------------------------- */
import { ref } from 'vue'
import axios from '@/lib/api'
import { IonButton } from '@ionic/vue'

// Props: 초기 소개 메시지
const props = defineProps({
  message: String
})

// Emits: close, updated
const emit = defineEmits(['close', 'updated'])

// 상태
const newIntro = ref(props.message || '')
const errorMsg = ref('')
const successMsg = ref('')

// 소개 수정 요청
const submitIntro = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  const trimmed = newIntro.value.trim()

  if (!trimmed) {
    errorMsg.value = '소개를 입력해주세요.'
    return
  }
  if (trimmed === props.message) {
    errorMsg.value = '기존 소개와 동일합니다.'
    return
  }

  try {
    console.log('[ModalMention] 소개 수정 요청 시작', trimmed)
    const res = await axios.put(
      '/api/update-selfintro',
      { selfintro: trimmed },
      { withCredentials: true }
    )

    if (res.data?.success) {
      console.log('[ModalMention] 소개 수정 성공', res.data)
      successMsg.value = '소개가 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 800)
    } else {
      errorMsg.value = res.data?.message || '소개 수정 실패'
      console.warn('[ModalMention] 소개 수정 실패', errorMsg.value)
    }
  } catch (err) {
    console.error('[ModalMention] 소개 수정 오류', err)
    if (err?.code === 'ERR_NETWORK') {
      console.error('[네트워크 오류] 서버 미동작/CORS 설정 확인 필요')
    }
    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* ===========================================================
   소개 수정 모달 - CSS
   - 다크 오버레이 + 화이트 카드
   - 반응형, 접근성, 안전영역 대응
=========================================================== */

/* 오버레이 */
.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  z-index: 1000;
  overscroll-behavior: contain;
  padding: calc(env(safe-area-inset-top, 0px) + 12px)
           12px
           calc(env(safe-area-inset-bottom, 0px) + 12px);
}

/* 카드 */
.popup-content {
  background: #fff;
  color: #000;
  width: min(92vw, 420px);
  max-height: min(86vh, 640px);
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.18);
  padding: 16px 18px;
  text-align: center;
  overflow: auto;
  box-sizing: border-box;
  animation: modal-in .18s ease-out;
  transform-origin: center;
}

/* 제목 */
.popup-content h3 {
  margin: 0 0 10px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
}

/* 입력창 */
.intro-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  margin: 12px 0;
  font-size: 16px;
  line-height: 1.45;
  background: #fff;
  color: #111;
  border: 1px solid #ccc;
  border-radius: 10px;
  resize: none;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.intro-textarea::placeholder { color: #999; }
.intro-textarea:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}

/* 버튼 그룹 */
.button-group {
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
  margin-top: 12px;
}
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 8px;
  --padding-bottom: 8px;
  min-height: 44px;
  font-weight: 700;
}

/* 메시지 */
.error-msg,
.success-msg {
  margin: 6px 0 0;
  font-size: clamp(14px, 2.8vw, 15px);
  line-height: 1.3;
  word-break: break-word;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 포커스 링 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 10px;
}

/* 작은 화면 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; width: 94vw; }
  .button-group { gap: 6px; }
}

/* 모션 최소화 */
@media (prefers-reduced-motion: reduce) {
  .popup-content { animation: none !important; }
}

/* 등장 애니메이션 */
@keyframes modal-in {
  from { opacity: 0; transform: translateY(6px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
