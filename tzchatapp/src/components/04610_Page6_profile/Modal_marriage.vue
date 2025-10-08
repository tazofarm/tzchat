<template>
  <div class="popup-overlay" @click.self="$emit('close')" role="presentation">
    <div class="popup-content" role="dialog" aria-modal="true" aria-labelledby="marriage-edit-title">
      <h3 id="marriage-edit-title">결혼유무 수정</h3>

      <!-- 🔸 결혼유무 선택 -->
      <select v-model="newMarriage" class="select-box" aria-label="결혼유무 선택">
        <option v-for="opt in MARRIAGE_OPTIONS" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>

      <!-- 🔸 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 🔸 버튼 그룹: 가로 2분할(좌: 닫기 / 우: 수정) -->
      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitMarriage">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* ------------------------------------------------------------------
   Modal_marriage.vue
   - 결혼유무(marriage) 수정 모달
   - /api/user/marriage 로 패치 (withCredentials)
   - 입력 검증 / 에러 핸들링 / 성공 후 부모 updated 이벤트
------------------------------------------------------------------- */
import { ref, onMounted } from 'vue'
import axios from '@/lib/api'
import type { AxiosError } from 'axios'
import { IonButton } from '@ionic/vue'

const props = defineProps<{ message?: string }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', value: string): void
}>()

// 허용 옵션
const MARRIAGE_OPTIONS = ['미혼', '기혼', '돌싱'] as const

const newMarriage = ref<string>('')
const errorMsg = ref('')
const successMsg = ref('')

onMounted(() => {
  // 초기 값: props.message가 유효하지 않으면 '미혼'
  const initial = (props.message || '').trim()
  newMarriage.value = MARRIAGE_OPTIONS.includes(initial as any) ? initial : '미혼'
})

const submitMarriage = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const trimmed = (newMarriage.value || '').trim()
  const prev = (props.message || '').trim()

  if (!MARRIAGE_OPTIONS.includes(trimmed as any)) {
    errorMsg.value = '올바른 결혼유무 값을 선택하세요.'
    return
  }
  if (trimmed === prev) {
    errorMsg.value = '기존 값과 동일합니다.'
    return
  }

  try {
    const res = await axios.patch(
      '/api/user/marriage',
      { marriage: trimmed },
      { withCredentials: true }
    )

    if (res.data?.success) {
      successMsg.value = '결혼유무가 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 800)
    } else {
      errorMsg.value = res.data?.message || '수정 실패'
    }
  } catch (err: unknown) {
    console.error('[Marriage] 업데이트 오류', err)
    // ✅ 안전한 타입 내로잉
    const status = (err as AxiosError)?.response?.status
    if (status === 404) errorMsg.value = 'API 경로가 없습니다. 서버를 확인하세요.'
    else if (status === 500) errorMsg.value = '서버 오류가 발생했습니다.'
    else errorMsg.value = '알 수 없는 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* ===========================================================
   결혼유무 수정 모달 - 기준 템플릿
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

/* 버튼 그룹 */
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
