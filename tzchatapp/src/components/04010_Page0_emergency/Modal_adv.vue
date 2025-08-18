<template> 
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>보상형 광고 beta</h3>
      <h3>Yes? Yes!</h3>
      <h3>네네~ Chat!!</h3>

      

      <!-- 🔸 오류/성공 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 🔸 버튼 그룹: 닫기 / 수정 -->
      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from '@/lib/axiosInstance' // ✅ 공통 설정된 axios 인스턴스
import { IonButton } from '@ionic/vue'

// 🔹 Props: 초기 소개 메시지 (부모 컴포넌트로부터 전달됨)
const props = defineProps({
  message: String
})

// 🔹 Emits: 모달 닫기 및 업데이트 알림
const emit = defineEmits(['close', 'updated'])

// 🔹 상태 관리
const newIntro = ref(props.message || '')           // 수정된 소개 내용
const errorMsg = ref('')                            // 에러 메시지
const successMsg = ref('')                          // 성공 메시지

// 🔧 소개 수정 요청 함수
const submitIntro = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  const trimmed = newIntro.value.trim()

  // 🔍 입력 유효성 검사
  if (trimmed === '') {
    errorMsg.value = '소개를 입력해주세요.'
    return
  }

  if (trimmed === props.message) {
    errorMsg.value = '기존 소개와 동일합니다.'
    return
  }

  try {
    console.log('[소개 수정 요청 시작]', trimmed)

    const res = await axios.put(
      '/api/update-selfintro',
      { selfintro: trimmed },
      { withCredentials: true }
    )

    if (res.data.success) {
      console.log('[소개 수정 성공]', res.data)
      successMsg.value = '소개가 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', trimmed) // 부모에게 새로운 값 전달
        emit('close')            // 모달 닫기
      }, 1000)
    } else {
      errorMsg.value = res.data.message || '소개 수정 실패'
      console.warn('[소개 수정 실패]', errorMsg.value)
    }

  } catch (err) {
    console.error('[소개 수정 오류]', err)

    if (err.code === 'ERR_NETWORK') {
      console.error('[네트워크 오류] 백엔드 서버가 꺼졌거나 CORS 설정이 잘못되었을 수 있습니다.')
    }

    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* ── ModalAdv (보상형 광고 beta): CSS 보정만 적용 ─────────────────────────
   - 오버레이: 전체 덮기, 배경 블러/딤, 스크롤 체인 방지
   - 콘텐츠 카드: 가독성(검정), 라운드, 그림자, 반응형 폭/패딩
   - 제목 타이포 스케일 통일, 간격 정리
   - 버튼: 터치 타깃(≥40px), 라운드/포커스 링
   - 오류/성공 메시지 가독성
   - safe-area(inset), 모션 축소 환경 대응
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
  backdrop-filter: blur(2px);             /* 가벼운 블러 */

  padding: env(safe-area-inset-top, 0px)
           env(safe-area-inset-right, 0px)
           env(safe-area-inset-bottom, 0px)
           env(safe-area-inset-left, 0px);

  overscroll-behavior: contain;           /* 스크롤 체인/바운스 방지 */
  z-index: 1000;
  cursor: default;
}

/* 콘텐츠 카드 */
.popup-content {
  width: min(92vw, 360px);                /* 반응형 폭 */
  max-height: min(86vh, 640px);           /* 너무 커지지 않도록 */
  overflow: auto;                         /* 내용 많을 때 스크롤 */

  background: #ffffff;
  color: #000000;                         /* 기본 글자색: 검정 */
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
.popup-content h3:first-of-type {
  margin-top: 2px;
}
.popup-content h3:last-of-type {
  margin-bottom: 10px;
}

/* 버튼 그룹 */
.button-group {
  display: grid;
  grid-auto-flow: row;
  gap: 8px;
  margin-top: 12px;
}

/* Ion 버튼 톤/사이즈(닫기 버튼 등) */
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;                       /* 터치 타깃 */
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

/* (컴포넌트에 이미 포함됨) 소개 입력창 공통 톤 - 재확인용 */
.intro-textarea {
  width: 100%;
  padding: 10px 12px;
  font-size: clamp(14px, 2.8vw, 15px);
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  resize: none;
  line-height: 1.4;
  color: #000;
  background: #fff;
}

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
