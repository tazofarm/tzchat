<template> 
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>보상형 광고 beta</h3>
      <h3>Yes? Yes!</h3>
      <h3>네네~ Chat!!</h3>

      <!-- 🔸 오류/성공 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 🔸 버튼 그룹: 닫기 -->
      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* ------------------------------------------------------------------
   Modal_adv.vue
   - 광고 안내 모달 (베타)
   - 전역 axios 인스턴스 사용 준비(향후 서버 연동 대비)
   - 구조 최소 변경, 로그/에러 핸들링 보강
------------------------------------------------------------------- */
import { ref } from 'vue'
import axios from '@/lib/axiosInstance'   // ✅ 공통 설정된 axios 인스턴스
import { IonButton } from '@ionic/vue'   // SFC 내 사용 등록

// 🔹 Props (필요 시 부모가 초기 문구 전달)
const props = defineProps({
  message: { type: String, default: '' }
})

// 🔹 Emits
const emit = defineEmits(['close', 'updated'])

// 🔹 상태
const newIntro = ref(props.message || '')
const errorMsg = ref('')
const successMsg = ref('')

/**
 * (옵션) 소개 수정 요청 예시
 * - 현재 UI에는 노출되지 않지만, 향후 보상형 광고 참여/인증 등의
 *   서버 상호작용을 위한 예시로 유지합니다.
 */
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
    console.log('[ModalAdv] 소개 수정 요청 시작', trimmed)
    const res = await axios.put(
      '/api/update-selfintro',
      { selfintro: trimmed },
      { withCredentials: true }
    )

    if (res.data?.success) {
      console.log('[ModalAdv] 소개 수정 성공', res.data)
      successMsg.value = '소개가 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 800)
    } else {
      errorMsg.value = res.data?.message || '소개 수정 실패'
      console.warn('[ModalAdv] 소개 수정 실패', errorMsg.value)
    }
  } catch (err) {
    console.error('[ModalAdv] 소개 수정 오류', err)
    if (err?.code === 'ERR_NETWORK') {
      console.error('[네트워크 오류] 서버 미동작/CORS 가능성')
    }
    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* ── ModalAdv (보상형 광고 beta): CSS 보정 ─────────────────────────
   - 오버레이: 전체 덮기, 배경 블러/딤, 스크롤 체인 방지
   - 콘텐츠 카드: 가독성(검정), 라운드, 그림자, 반응형 폭/패딩
   - 제목 타이포 스케일 통일, 간격 정리
   - 버튼: 터치 타깃(≥40px), 라운드/포커스 링
   - 오류/성공 메시지 가독성
   - safe-area(inset), 모션 축소 환경 대응
──────────────────────────────────────────────────────────────── */

.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  background-color: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);

  padding: env(safe-area-inset-top, 0px)
           env(safe-area-inset-right, 0px)
           env(safe-area-inset-bottom, 0px)
           env(safe-area-inset-left, 0px);

  overscroll-behavior: contain;
  z-index: 1000;
  cursor: default;
}

.popup-content {
  width: min(92vw, 360px);
  max-height: min(86vh, 640px);
  overflow: auto;

  background: #ffffff;
  color: #000000;
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.20);
  padding: 16px 18px;

  animation: modal-in .18s ease-out;
  transform-origin: center;
  -webkit-font-smoothing: antialiased;
}

/* 제목(반복 h3) */
.popup-content h3 {
  margin: 0 0 6px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
  color: #000;
  letter-spacing: 0.1px;
  text-wrap: balance;
}
.popup-content h3:first-of-type { margin-top: 2px; }
.popup-content h3:last-of-type { margin-bottom: 10px; }

/* 버튼 그룹 */
.button-group {
  display: grid;
  grid-auto-flow: row;
  gap: 8px;
  margin-top: 12px;
}

/* Ion 버튼 톤/사이즈 */
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;
  font-weight: 600;
}

/* 메시지(에러/성공) */
.error-msg,
.success-msg {
  margin: 6px 0 0;
  font-size: clamp(13px, 2.8vw, 14px);
  line-height: 1.35;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 접근성: 키보드 포커스 링 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.35);
  border-radius: 10px;
}

/* 모션 최소화 환경 */
@media (prefers-reduced-motion: reduce) {
  .popup-content { animation: none !important; }
}

/* 초소형 기기 보정 */
@media (max-width: 360px) {
  .popup-content { padding: 14px 14px; }
}

/* 등장 애니메이션 */
@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
