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
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitIntro">수정</ion-button>
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
/* ──────────────────────────────────────────────────────────────
   소개 수정 모달 - CSS 보정(HTML/JS 변경 없음)
   목적
   - 모바일 가독성(검정 글씨) & 터치 타깃 강화(≥44px)
   - 안전영역(safe-area) / 작은 화면 스크롤 안정성
   - 포커스 접근성(:focus-visible) / 모션 최소화 대응
   - 일관된 여백·그림자·라운드 및 반응형 폰트 스케일
   로그분석은 CSS 범위를 벗어나므로 주석으로 맥락을 남깁니다.
────────────────────────────────────────────────────────────── */

/* 오버레이: 화면 전체 덮기 + 살짝 블러 */
.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;             /* 세로 중앙 */
  justify-content: center;         /* 가로 중앙 */
  background-color: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  z-index: 1000;

  /* 스크롤 체인/바운스 방지 + 안전영역 반영 */
  overscroll-behavior: contain;
  padding: calc(env(safe-area-inset-top, 0px) + 12px)
           12px
           calc(env(safe-area-inset-bottom, 0px) + 12px);
}

/* 모달 카드 */
.popup-content {
  background: #fff;
  color: #000;                     /* 가독성: 기본 검정 */
  width: min(92vw, 420px);
  max-height: min(86vh, 640px);    /* 작은 화면에서 넘치면 내부 스크롤 */
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.18);
  padding: 16px 18px;
  text-align: center;              /* 기존 가운데 정렬 유지 */
  overflow: auto;                  /* 내부 스크롤 */
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

/* 입력창: iOS 확대 방지(16px), 포커스 링 추가 */
.intro-textarea {
  width: 100%;
  min-height: 120px;               /* 입력 영역 기본 높이 */
  padding: 12px;
  margin: 12px 0;
  font-size: 16px;                 /* iOS 줌 방지 기준값 */
  line-height: 1.45;
  background: #fff;
  color: #111;
  border: 1px solid #ccc;
  border-radius: 10px;
  resize: none;                    /* 텍스트 영역 크기 고정(모바일 안정) */
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.intro-textarea::placeholder { color: #999; }
.intro-textarea:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}

/* 버튼 그룹: 가로 나란히(좁을 땐 자동 랩) */
.button-group {
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
  margin-top: 12px;
}
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px; --padding-end: 12px;
  --padding-top: 8px; --padding-bottom: 8px;
  min-height: 44px;                /* 터치 타깃 강화 */
  font-weight: 700;
}

/* 메시지(오류/성공) */
.error-msg,
.success-msg {
  margin: 6px 0 0;
  font-size: clamp(14px, 2.8vw, 15px);
  line-height: 1.3;
  word-break: break-word;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 키보드 포커스 접근성(공통) */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 10px;
}

/* 초소형 화면(≤360px) 보정 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; width: 94vw; }
  .button-group { gap: 6px; }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  .popup-content { animation: none !important; }
}

/* 가벼운 등장 애니메이션 */
@keyframes modal-in {
  from { opacity: 0; transform: translateY(6px) scale(.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}

</style>
