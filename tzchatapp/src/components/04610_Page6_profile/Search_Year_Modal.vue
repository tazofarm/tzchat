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

      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button
          expand="block"
          color="primary"
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

// 🔹 부모에서 내려주는 초기값(문자열/숫자/빈값/null 허용)
//   예: :initial-from="user?.search_birthyear1 ?? ''"
//       :initial-to="user?.search_birthyear2 ?? ''"
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

// 📅 최신년도 기준: 만 19세 이상만 허용(예: 2025년이면 2006년생까지 제외)
const thisYear = new Date().getFullYear()
const maxYear = thisYear - 19
const years = Array.from({ length: maxYear - 1950 + 1 }, (_, i) => maxYear - i)

// 🔍 선택값에 맞춘 필터
const filteredFromYears = computed(() => {
  return to.value
    ? years.filter((y) => y <= parseInt(to.value))
    : years
})
const filteredToYears = computed(() => {
  return from.value
    ? years.filter((y) => y >= parseInt(from.value))
    : years
})

const invalidRange = computed(() => {
  return from.value && to.value && parseInt(from.value) > parseInt(to.value)
})

// 🟦 공통: prop → 내부상태로 동기화
function syncFromProps() {
  // '전체'/null/undefined → ''
  const pf = props.initialFrom ?? ''
  const pt = props.initialTo ?? ''
  from.value = (pf === '전체' || pf === null) ? '' : String(pf)
  to.value   = (pt === '전체' || pt === null) ? '' : String(pt)
  // 만일 역전된 범위라면 보정(UX 보호)
  if (from.value && to.value && parseInt(from.value) > parseInt(to.value)) {
    // 끝년도를 시작년도로 맞춤
    to.value = from.value
  }
  // 선택 가능한 옵션 즉시 반영
  // (IonSelect는 v-model만으로 충분하므로 별도 처리 불필요)
  // 로깅
  console.log('[SearchYearModal] syncFromProps:', {
    initialFrom: props.initialFrom,
    initialTo: props.initialTo,
    from: from.value,
    to: to.value
  })
}

// 최초 진입 시
onMounted(() => {
  syncFromProps()
})

// 부모가 비동기로 값을 채운 뒤 모달을 열어도 반영되도록 watch
watch(() => [props.initialFrom, props.initialTo], syncFromProps)

// 🟦 저장
const submit = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  // 유효성
  if (invalidRange.value) {
    errorMsg.value = '시작 년도는 끝 년도보다 작거나 같아야 합니다.'
    return
  }

  try {
    submitting.value = true
    // 서버에는 year1/year2로 전달 (''는 라우터/서버에서 무시 또는 null 처리)
    const payload = {
      year1: from.value === '' ? '' : from.value,
      year2: to.value   === '' ? '' : to.value,
    }
    console.log('▶ [SearchYearModal] PATCH /api/search/year payload:', payload)

    const res = await axios.patch('/api/search/year', payload, { withCredentials: true })
    console.log('✅ 검색 나이 서버 반영 완료', res.data)
    successMsg.value = '검색 나이가 수정되었습니다.'

    setTimeout(() => {
      // 부모는 {from,to}를 그대로 받아 상태 동기화
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
/* ──────────────────────────────────────────────────────────────
   Search_Year_Modal - CSS 보정
   - 모바일 가독성(검정) & 터치 타깃 강화(≥44px)
   - 안전영역(safe-area) / 작은 화면 스크롤 안정성
   - 포커스 접근성(:focus-visible) / 모션 최소화 대응
   - 반응형 폰트 스케일
────────────────────────────────────────────────────────────── */

.popup-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: calc(env(safe-area-inset-top, 0px) + 12px)
           12px
           calc(env(safe-area-inset-bottom, 0px) + 12px);
  z-index: 1000;
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  overscroll-behavior: contain;
}

.popup-content {
  background: #fff;
  color: #000;
  width: min(92vw, 360px);
  max-width: 360px;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 10px 28px rgba(0,0,0,.18);
  border: 1px solid #eaeaea;
  text-align: center;
  box-sizing: border-box;
  animation: modal-in .18s ease-out;
}

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
  align-items: stretch;
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
/* 보조: 일부 브라우저에서 텍스트 톤 확실히 */
ion-select::part(text) { color: #000 !important; }
ion-select-option { color: #000 !important; }

/* 버튼들 */
.button-group {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 44px;
  font-weight: 700;
}

/* 메시지 */
.error-msg {
  color: #c0392b;
  font-size: 0.9rem;
  margin-top: 6px;
}
.success-msg {
  color: #2d7a33;
  font-size: 0.9rem;
  margin-top: 6px;
}

/* 포커스 접근성 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 10px;
}

/* 초소형 화면 대응 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; }
  .select-group { gap: 10px; }
}

/* 모션 최소화 */
@media (prefers-reduced-motion: reduce) {
  .popup-content { animation: none !important; }
}

/* 등장 애니메이션 */
@keyframes modal-in {
  from { opacity: 0; transform: translateY(6px) scale(.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
</style>
