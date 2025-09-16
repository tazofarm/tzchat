<template>
  <div
    class="popup-overlay"
    @click.self="$emit('close')"
    role="presentation"
  >
    <div
      class="popup-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-year-title"
    >
      <h3 id="search-year-title">검색 나이 수정</h3>

      <div class="select-group" role="group" aria-label="검색 연령 범위 선택">
        <!-- 시작년도 -->
        <div class="select-container">
          <label class="select-label" for="year-from">시작년도</label>
          <ion-select
            id="year-from"
            v-model="from"
            interface="popover"
            class="year-select"
            :aria-label="'시작년도 선택'"
          >
            <ion-select-option value="">전체</ion-select-option>
            <ion-select-option
              v-for="year in filteredFromYears"
              :key="'from-' + year"
              :value="String(year)"
            >
              {{ year }}
            </ion-select-option>
          </ion-select>
        </div>

        <!-- 끝년도 -->
        <div class="select-container">
          <label class="select-label" for="year-to">끝년도</label>
          <ion-select
            id="year-to"
            v-model="to"
            interface="popover"
            class="year-select"
            :aria-label="'끝년도 선택'"
          >
            <ion-select-option value="">전체</ion-select-option>
            <ion-select-option
              v-for="year in filteredToYears"
              :key="'to-' + year"
              :value="String(year)"
            >
              {{ year }}
            </ion-select-option>
          </ion-select>
        </div>
      </div>

      <!-- 메시지 -->
      <p v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg" role="status">{{ successMsg }}</p>

      <!-- 버튼: 항상 가로 2분할(좌 닫기 / 우 수정), 명확한 색상 적용 -->
      <div class="button-group">
        <ion-button expand="block" class="btn-close" @click="$emit('close')">닫기</ion-button>
        <ion-button
          expand="block"
          class="btn-submit"
          @click="submit"
          :disabled="submitting || invalidRange"
        >
          {{ submitting ? '수정 중…' : '수정' }}
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
// ✅ DB에서 받은 초기값을 정확히 반영 + 접근성/에러로그 강화
import { ref, computed, onMounted, watch } from 'vue'
import { IonButton, IonSelect, IonSelectOption } from '@ionic/vue'
import axios from '@/lib/api'

const props = defineProps({
  initialFrom: { type: [String, Number, null], default: '' },
  initialTo:   { type: [String, Number, null], default: '' },
})
const emit = defineEmits(['close', 'updated'])

const from = ref('')  // '' = 전체
const to   = ref('')  // '' = 전체
const errorMsg = ref('')
const successMsg = ref('')
const submitting = ref(false)

// 📅 최신년도 기준: 만 19세 이상만 허용
const thisYear = new Date().getFullYear()
const maxYear = thisYear - 19
const years = Array.from({ length: maxYear - 1950 + 1 }, (_, i) => maxYear - i)

// 🔍 선택값에 맞춘 필터
const filteredFromYears = computed(() => (to.value ? years.filter(y => y <= parseInt(to.value)) : years))
const filteredToYears   = computed(() => (from.value ? years.filter(y => y >= parseInt(from.value)) : years))

const invalidRange = computed(() => from.value && to.value && parseInt(from.value) > parseInt(to.value))

function syncFromProps() {
  const pf = props.initialFrom ?? ''
  const pt = props.initialTo ?? ''
  from.value = (pf === '전체' || pf === null) ? '' : String(pf)
  to.value   = (pt === '전체' || pt === null) ? '' : String(pt)
  if (from.value && to.value && parseInt(from.value) > parseInt(to.value)) {
    to.value = from.value
  }
  console.log('[SearchYearModal] syncFromProps:', {
    initialFrom: props.initialFrom, initialTo: props.initialTo, from: from.value, to: to.value
  })
}

onMounted(syncFromProps)
watch(() => [props.initialFrom, props.initialTo], syncFromProps)

// 🟦 저장
const submit = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (invalidRange.value) {
    errorMsg.value = '시작 년도는 끝 년도보다 작거나 같아야 합니다.'
    return
  }

  try {
    submitting.value = true
    const payload = {
      year1: from.value === '' ? '' : from.value,
      year2: to.value   === '' ? '' : to.value,
    }
    console.log('▶ [SearchYearModal] PATCH /api/search/year payload:', payload)

    const res = await axios.patch('/api/search/year', payload, { withCredentials: true })
    console.log('✅ 검색 나이 서버 반영 완료', res.data)
    successMsg.value = '검색 나이가 수정되었습니다.'

    setTimeout(() => {
      emit('updated', { from: from.value, to: to.value })
      emit('close')
    }, 700)
  } catch (err) {
    console.error('❌ 검색 나이 업데이트 실패', err)
    errorMsg.value = err?.response?.data?.message || '서버 오류가 발생했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* ===========================================================
   Search_Year_Modal - 기준 템플릿 + 버튼 선명 색상
   - dim+blur 오버레이, safe-area 패딩
   - 카드: 화이트, 검정 텍스트, 폭 min(92vw, 420px)
   - 버튼: 항상 가로 2분할 (닫기=회색, 수정=노랑)
=========================================================== */

.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px calc(env(safe-area-inset-bottom, 0px) + 12px);
  z-index: 1000;
  overscroll-behavior: contain;
}

.popup-content {
  background: #fff;
  color: #000;
  width: min(92vw, 420px);
  max-height: min(86vh, 640px);
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0,0,0,.18);
  padding: 16px 18px;
  text-align: center;
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
  color: #000;
}

/* 선택 그룹 */
.select-group {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 12px 0 8px;
  width: 100%;
}
.select-container {
  display: flex;
  flex-direction: column;
  width: 48%;
  min-width: 120px;
}
.select-label {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: #000;
}

/* Ion Select */
.year-select {
  --background: #f9f9f9;
  --color: #000;
  --placeholder-color: #000;
  --text-color: #000;
  width: 100%;
  text-align: center;
  font-size: 0.9rem;
  border-radius: 10px;
}
ion-select::part(text) { color: #000 !important; }
ion-select-option { color: #000 !important; }

/* 버튼: 항상 가로 2분할 (좌 닫기 / 우 수정) */
.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

/* ▶ 명확한 색상 지정 */
.button-group .btn-close {
  --background: #b5b5bb;                 /* 진한 회색 */
  --background-hover: #a6a6ad;
  --background-focused: #a6a6ad;
  --background-activated: #9a9aa1;
  --color: #ffffff;                       /* 흰 글씨 */
  font-weight: 700;
}
.button-group .btn-submit {
  --background: #f8d146;                 /* 선명한 노랑 */
  --background-hover: #f6c600;
  --background-focused: #f6c600;
  --background-activated: #efbd00;
  --color: #000000;                       /* 검정 글씨 */
  font-weight: 700;
}
/* disabled 시 톤 다운 */
.button-group .btn-submit.button-disabled,
.button-group .btn-close.button-disabled {
  opacity: .6;
  pointer-events: none;
}

.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 10px;
  --padding-bottom: 10px;
  min-height: 44px;
}

/* 메시지 */
.error-msg,
.success-msg {
  margin-top: 6px;
  font-size: 0.9rem;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 접근성 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 10px;
}

/* 초소형 화면 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; width: 94vw; }
  .select-group { gap: 10px; }
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
