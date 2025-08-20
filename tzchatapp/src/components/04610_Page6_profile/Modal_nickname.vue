<!-- Modal_nickname.vue -->
<template>
  <!-- 오버레이: 오직 배경 클릭 시에만 닫힘 (.self) -->
  <div
    class="popup-overlay"
    role="presentation"
    @click.self="onOverlayClick"
  >
    <!-- 콘텐츠 카드: dialog semantics -->
    <div
      class="popup-content"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-busy="isSubmitting ? 'true' : 'false'"
      @keydown.esc.prevent.stop="onEsc"
      ref="cardRef"
    >
      <h3 :id="titleId">닉네임 수정</h3>

      <!-- 입력창 -->
      <input
        v-model="newNickname"
        type="text"
        placeholder="새 닉네임을 입력하세요"
        class="nickname-input"
        :disabled="isSubmitting"
        @keydown.enter.prevent="submitNickname"
        aria-label="새 닉네임"
      />

      <!-- 결과 메시지 -->
      <p v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg" role="status">{{ successMsg }}</p>

      <!-- 버튼 그룹 -->
      <div class="button-group">
        <ion-button
          expand="block"
          color="medium"
          @click="onClose"
          :disabled="isSubmitting"
        >
          닫기
        </ion-button>

        <ion-button
          expand="block"
          color="primary"
          @click="submitNickname"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? '수정 중…' : '수정' }}
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* ============================================================================
   Modal_nickname.vue
   - 디자인 일관화(검은 텍스트 가독성)
   - 접근성(ARIA), ESC 닫기, 로딩 중 중복 클릭 방지
   - 자세한 콘솔 로그로 추적/분석 용이
   ========================================================================== */
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue' // (자동 등록 환경이면 import만으로 사용 가능)

/* 🔹 Props: 기존 닉네임 전달 */
const props = defineProps({
  message: { type: String, default: '' }
})

/* 🔹 Emits: 닫기(close), 수정 완료(updated) */
const emit = defineEmits(['close', 'updated'])

/* 🔹 State */
const newNickname = ref(props.message || '')
const errorMsg = ref('')
const successMsg = ref('')
const isSubmitting = ref(false)

/* 🔹 접근성: 제목 ID, 카드 ref(포커스 트랩의 시작점 역할) */
const titleId = `modal-title-${Math.random().toString(36).slice(2)}`
const cardRef = ref(null)

/* 🔧 마운트 시 첫 포커스: 입력창이 가장 좋지만, 카드에 먼저 두고 다음 탭으로 이동하는 UX */
onMounted(() => {
  try {
    console.log('[ModalNickname] mounted. props.message =', props.message)
    // 카드에 포커스 주고, 다음 탭에서 input으로 자연스럽게 이동
    cardRef.value?.focus?.()
  } catch (e) {
    console.warn('[ModalNickname] initial focus failed:', e)
  }
})

/* 🔧 닫기 핸들러 */
const onClose = () => {
  console.log('[ModalNickname] 닫기 버튼 클릭')
  emit('close')
}

/* 🔧 오버레이 클릭(배경만)으로 닫기 */
const onOverlayClick = () => {
  console.log('[ModalNickname] overlay click → close')
  emit('close')
}

/* 🔧 ESC로 닫기 */
const onEsc = () => {
  console.log('[ModalNickname] ESC pressed → close')
  emit('close')
}

/* 🔧 닉네임 수정 요청 */
const submitNickname = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const trimmed = newNickname.value.trim()
  console.log('[ModalNickname] submit start. input =', trimmed)

  // 유효성 검사
  if (!trimmed) {
    errorMsg.value = '닉네임을 입력하세요.'
    console.warn('[ModalNickname] validation: empty nickname')
    return
  }
  if (trimmed === props.message) {
    errorMsg.value = '기존 닉네임과 동일합니다.'
    console.warn('[ModalNickname] validation: same as previous')
    return
  }

  try {
    isSubmitting.value = true
    console.time('[ModalNickname] PUT /api/update-nickname') // ⏱ 로그분석용 타이머
    const response = await axios.put(
      '/api/update-nickname',
      { nickname: trimmed },
      { withCredentials: true }
    )
    console.timeEnd('[ModalNickname] PUT /api/update-nickname')

    if (response?.data?.success) {
      console.log('[ModalNickname] ✅ 닉네임 수정 성공 →', trimmed)
      successMsg.value = '닉네임이 성공적으로 수정되었습니다.'

      // 1초 후 닫기 및 부모에 변경 알림
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 1000)
    } else {
      errorMsg.value = response?.data?.message || '닉네임 수정 실패'
      console.warn('[ModalNickname] ❌ 닉네임 수정 실패:', errorMsg.value)
    }
  } catch (err) {
    console.error('[ModalNickname] 🔥 서버 오류', err)
    errorMsg.value = '서버 오류가 발생했습니다.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
/* ============================================================================
   Modal_nickname.vue — Black + Gold Theme (CSS only 변경)
   - 다크카드(블랙) + 포인트(골드) + 가독성 높은 라이트 텍스트
   - IonButton은 섀도우 DOM 변수로 스타일 지정(--background 등)
   - 접근성: 포커스 링/대비 보장, 최소 모션 대응
   ========================================================================== */

/* 컬러 토큰 (스코프 내에서만 사용) */
:root {
  --gold: #c6a15b;               /* 메인 골드 */
  --gold-strong: #d4b163;        /* hover/active용 살짝 밝은 골드 */
  --gold-soft: rgba(198,161,91,0.35);
  --bg-card: #0c0c10;            /* 카드 배경 블랙 */
  --bg-overlay: rgba(0,0,0,0.5); /* 오버레이 딤 */
  --text-strong: #f5f6f7;        /* 본문 텍스트 (밝은 회백) */
  --text-muted: #c7c9cc;
  --line: rgba(255,255,255,0.08);/* 경계선 */
  --danger: #e65c5c;             /* 에러 */
  --success: #49b06f;            /* 성공 */
}

/* 오버레이(뒷배경) */
.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  background-color: var(--bg-overlay);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);

  padding:
    env(safe-area-inset-top, 0px)
    env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);

  overscroll-behavior: contain;
  z-index: 1000;
  cursor: default;
}

/* 콘텐츠 카드 */
.popup-content {
  width: min(92vw, 360px);
  max-height: min(86vh, 640px);
  overflow: auto;

  background: var(--bg-card);
  color: var(--text-strong);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow:
    0 18px 50px rgba(0,0,0,0.45),
    0 0 0 1px rgba(255,255,255,0.02) inset;
  padding: 16px 18px;

  animation: modal-in .18s ease-out;
  transform-origin: center;
  -webkit-font-smoothing: antialiased;

  outline: none;
}
.popup-content:focus { outline: none; }

/* 제목 */
.popup-content h3 {
  margin: 0 0 12px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
  color: var(--gold);
  letter-spacing: 0.1px;
  text-wrap: balance;
  text-shadow: 0 0 0.01px currentColor;
}

/* 입력창 */
.nickname-input {
  width: 100%;
  padding: 11px 12px;
  margin: 12px 0;
  font-size: clamp(14px, 2.8vw, 15px);
  line-height: 1.4;

  background: #121218;
  color: var(--text-strong);
  border: 1px solid var(--line);
  border-radius: 10px;

  transition: box-shadow .15s, border-color .15s, background-color .15s;
}
.nickname-input::placeholder {
  color: var(--text-muted);
}
.nickname-input:focus-visible {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-soft);
}
.nickname-input:disabled {
  background: #191922;
  opacity: .75;
  cursor: not-allowed;
}

/* 메시지 */
.error-msg,
.success-msg {
  margin: 6px 0 0;
  font-size: clamp(13px, 2.8vw, 14px);
  line-height: 1.35;
}
.error-msg { color: var(--danger); }
.success-msg { color: var(--success); }

/* 버튼 그룹 */
.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 닫기 | 수정 */
  gap: 8px;
  margin-top: 14px;
}

/* IonButton 커스텀 (닫기: 아웃라인 골드, 수정: 골드 필드) */
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 42px;
  font-weight: 800;
  letter-spacing: .2px;
}

/* 닫기 버튼 (첫 번째) → 투명 배경 + 골드 테두리/텍스트 */
.button-group ion-button:first-child {
  --background: transparent;
  --background-hover: rgba(198,161,91,0.08);
  --background-activated: rgba(198,161,91,0.12);
  --color: var(--gold);
  --border-color: var(--gold);
  --border-style: solid;
  --border-width: 1px;
  --ripple-color: var(--gold-soft);
  filter: drop-shadow(0 0 0.001px var(--gold));
}

/* 수정 버튼 (두 번째) → 골드 필드 + 블랙 텍스트 */
.button-group ion-button:last-child {
  --background: var(--gold);
  --background-hover: var(--gold-strong);
  --background-activated: var(--gold-strong);
  --color: #0c0c10;
  --ripple-color: rgba(0,0,0,0.25);
  box-shadow: 0 6px 16px rgba(198,161,91,0.25);
}

.button-group ion-button[disabled] {
  opacity: .6;
  pointer-events: none;
  box-shadow: none;
}

/* 초소형 기기(≤360px)에서는 버튼 세로 스택 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; }
  .button-group { grid-template-columns: 1fr; }
}

/* 접근성: 키보드 포커스 링(안전망) */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--gold-soft);
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
