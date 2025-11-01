<!-- @/components/02010_minipage/mini_profile/Modal_PremiumRequest.vue -->
<template>
  <!-- ✅ 단일 루트 엘리먼트 유지 -->
  <div class="popup-overlay" @click.self="onClose">
    <div class="popup-modal">
      <!-- 헤더 -->
      <div class="modal-header">
        <h3 class="title">🤝 프리미엄 신청</h3>
        <!-- 필요 시 닫기 버튼 복구 -->
        <!-- <IonButton size="small" class="btn-outline" @click="onClose">닫기</IonButton> -->
      </div>

      <!-- 본문 -->
      <div class="modal-body">
        <label class="label" for="friend-msg">인사말 (선택)</label>
        <textarea
          id="friend-msg"
          v-model.trim="message"
          class="message-input"
          rows="5"
          placeholder="예) 안녕하세요! 친하게 지내요 :)"
        ></textarea>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>
      </div>

      <!-- 풋터 -->
      <div class="modal-footer">
        <IonButton
          expand="block"
          class="btn-primary glow"
          :disabled="isSubmitting"
          @click="onSubmit"
        >
          {{ isSubmitting ? '전송 중...' : '신청하기❤️40' }}
        </IonButton>
        <IonButton
          expand="block"
          class="btn-muted"
          :disabled="isSubmitting"
          @click="onCancel"
        >
          취소
        </IonButton>
      </div>
    </div>
  </div>
</template>

<script setup>
// --------------------------------------------------------------
// Modal_PremiumRequest.vue
// - 프리미엄 친구 신청 모달
// - 요청 body key는 `to` 사용 (백엔드 규격 일치)
// - 공통 axios 인스턴스 사용(토큰/쿠키 처리 일원화)
// - 부모 이벤트 규격: submitted / cancel / close
// --------------------------------------------------------------
import { ref, onMounted } from 'vue'
import { IonButton } from '@ionic/vue'
import axios from '@/lib/api' // ✅ 공통 인스턴스

const props = defineProps({
  toUserId: { type: String, required: true },
  defaultMessage: { type: String, default: '' }
})

// 부모로 내보낼 이벤트: 제출 완료/취소/닫기
const emit = defineEmits(['submitted', 'cancel', 'close'])

const message = ref(props.defaultMessage || '')
const isSubmitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

onMounted(() => {
  console.log('[ModalPremiumRequest] mounted', {
    toUserId: props.toUserId,
    defaultMessage: props.defaultMessage
  })
})

function onClose () {
  console.log('[ModalPremiumRequest] close clicked')
  emit('close')
}

function onCancel () {
  console.log('[ModalPremiumRequest] cancel clicked')
  emit('cancel')
  emit('close')
}

async function onSubmit () {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const payload = {
      to: props.toUserId,              // ✅ 핵심: toUserId → to
      message: message.value || ''
    }
    console.log('[ModalPremiumRequest] submit start', { ...payload, msgLen: message.value.length })

    // ✅ 프리미엄 전용 엔드포인트 호출
    const { status, data } = await axios.post('/api/friend-request-premium', payload, { withCredentials: true })
    console.log('[ModalPremiumRequest] submit response', { status, data })

    successMsg.value = '프리미엄 친구 신청이 전송되었습니다.'

    // 서버가 반환한 요청 id 전달(가능한 키들 안전하게 탐색)
    const requestId =
      data?._id ??
      data?.id ??
      data?.request?._id ??
      data?.result?._id ??
      null

    emit('submitted', { requestId, raw: data })
    setTimeout(() => emit('close'), 300)
  } catch (err) {
    const status = err?.response?.status
    const data = err?.response?.data
    const msg = data?.error || data?.message || err?.message || '친구 신청에 실패했습니다.'
    errorMsg.value = msg
    console.error('[ModalPremiumRequest] submit failed:', { status, msg, data })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
/* ===========================================================
   GOLD THEME 적용
   - 색상 하드코딩 제거 → 테마 변수 사용
   - 사용 변수: --bg / --panel / --panel-border / --text / --text-dim
               --gold / --gold-strong / --danger
   =========================================================== */

/* 오버레이 (반투명 블랙) */
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);              /* 다크 오버레이 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* 모달 박스 */
.popup-modal {
  width: min(560px, 92vw);
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,.35),
              0 0 0 1px rgba(255,213,79,.06) inset;
  padding: 14px;
  color: var(--text);
}

/* 헤더 */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 10px 2px;
  border-bottom: 1px solid var(--panel-border);
}
.title { margin: 0; font-size: 16px; font-weight: 800; color: var(--text); }

/* 본문 */
.modal-body { padding: 12px 2px; }
.label { display: block; margin-bottom: 6px; font-weight: 700; color: var(--text); }
.message-input {
  width: 100%;
  min-height: 120px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 10px;
  line-height: 1.4;
  font-size: 14px;
  color: var(--text);
  background: #141414;
  outline: none;
}
.message-input::placeholder { color: var(--text-dim); }
.message-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(255,213,79,.20);
}

/* 메시지 */
.error-msg { margin-top: 8px; font-size: 13px; color: var(--danger); }
.success-msg { margin-top: 8px; font-size: 13px; color: #1db954; }

/* 풋터 */
.modal-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--panel-border);
}

/* IonButton 테마 클래스(전역 theme-gold.css와 톤 맞춤) */
.btn-primary {
  --background: var(--gold);
  --background-hover: var(--gold-strong);
  --background-activated: var(--gold-strong);
  --color: #1a1a1a;
  --border-radius: 12px;
  font-weight: 700;
}
.btn-muted {
  --background: transparent;
  --color: var(--text-dim);
  --border-color: var(--panel-border);
  --border-style: solid;
  --border-width: 1px;
  --border-radius: 12px;
  font-weight: 700;
}
.btn-outline {
  --background: transparent;
  --color: var(--gold);
  --border-color: var(--gold);
  --border-style: solid;
  --border-width: 1px;
  --border-radius: 12px;
  font-weight: 700;
}

/* 살짝 반짝이는 강조 */
.glow {
  box-shadow:
    0 0 16px rgba(255,213,79,.12),
    inset 0 0 0 1px rgba(255,213,79,.15);
}

/* 접근성 포커스 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255,213,79,.25);
  border-radius: 10px;
}
</style>
