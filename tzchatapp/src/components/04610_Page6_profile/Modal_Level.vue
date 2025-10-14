<!-- Modal_Level.vue → "회원 등급 수정" 모달로 전환 -->
<template>
  <div class="popup-overlay" @click.self="$emit('close')" role="presentation">
    <div class="popup-content" role="dialog" aria-modal="true" aria-labelledby="grade-edit-title">
      <h3 id="grade-edit-title">회원 등급 수정 (TEST)</h3>

      <!-- 🔸 등급 선택 -->
      <select v-model="selectedGrade" class="select-box" aria-label="회원 등급 선택">
        <option value="일반회원">일반회원</option>
        <option value="여성회원">여성회원</option>
        <option value="프리미엄">프리미엄</option>
      </select>

      <!-- 🔸 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 🔸 버튼 그룹: 가로 2분할(좌: 닫기 / 우: 수정) -->
      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitGrade">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* ------------------------------------------------------------------
   Modal_preference.vue (개조)
   - 회원 등급(user_level) 수정 모달 (테스트용)
   - DB 변경 없음: user_level만 PATCH
   - PATCH /api/user/grade  { grade: '일반회원|여성회원|프리미엄' }
   - 성공 시 부모로 'updated' 이벤트로 새 값 전달
------------------------------------------------------------------- */
import { ref, onMounted } from 'vue'
import axios from '@/lib/api'
import { IonButton } from '@ionic/vue'

// 현재 등급을 부모에서 내려받아 초기화
const props = defineProps({
  current: { type: String, default: '' }
})
const emit = defineEmits(['close', 'updated'])

const selectedGrade = ref('일반회원')
const errorMsg = ref('')
const successMsg = ref('')

onMounted(() => {
  const init = (props.current || '').trim()
  selectedGrade.value = ['일반회원','여성회원','프리미엄'].includes(init) ? init : '일반회원'
})

const submitGrade = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const next = (selectedGrade.value || '').trim()
  const prev = (props.current || '').trim()

  if (!next) {
    errorMsg.value = '등급을 선택하세요.'
    return
  }
  if (next === prev) {
    errorMsg.value = '기존 등급과 동일합니다.'
    return
  }

  try {
    const res = await axios.patch(
      '/api/user/grade',
      { grade: next },
      { withCredentials: true }
    )

    if (res.data?.success) {
      successMsg.value = '회원 등급이 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', next)
        emit('close')
      }, 600)
    } else {
      errorMsg.value = res.data?.message || '수정 실패'
    }
  } catch (err) {
    console.error('[Grade] 업데이트 오류', err)
    const status = err?.response?.status
    if (status === 401) errorMsg.value = '로그인이 필요합니다.'
    else if (status === 404) errorMsg.value = 'API 경로가 없습니다. 서버를 확인하세요.'
    else if (status === 500) errorMsg.value = '서버 오류가 발생했습니다.'
    else errorMsg.value = '알 수 없는 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* ===========================================================
   회원 등급 수정 모달 (기존 템플릿 스타일 유지)
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
  margin: 0 0 12px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: .1px;
}

/* 셀렉트 박스 */
.select-box {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  margin: 12px 0 8px;
  font-size: clamp(14px, 2.6vw, 15px);
  color: #000;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 12px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  appearance: none;
}
.select-box:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}

/* 버튼 그룹: 항상 가로 2분할 (좌 닫기 / 우 수정) */
.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

/* IonButton 공통 */
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 10px;
  --padding-bottom: 10px;
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

/* 접근성 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 12px;
}

/* 초소형 화면 보정 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; width: 94vw; }
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
