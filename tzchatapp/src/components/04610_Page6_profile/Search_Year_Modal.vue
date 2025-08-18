<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>검색 나이 수정</h3>

      <div class="select-group">
        <!-- 시작년도 -->
        <div class="select-container">
          <label class="select-label">시작년도</label>
          <ion-select v-model="from" interface="popover" class="year-select">
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
          <label class="select-label">끝년도</label>
          <ion-select v-model="to" interface="popover" class="year-select">
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
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submit">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
// ✅ DB에서 받은 초기값을 정확히 반영하도록 수정
import { ref, computed, onMounted, watch } from 'vue'
import { IonButton, IonSelect, IonSelectOption } from '@ionic/vue'
import axios from '@/lib/axiosInstance'

// 🔹 부모에서 내려주는 초기값(문자열 or null 가능)
//   - parent 예시: :initial-from="user?.search_birthyear1 ?? ''"
//                  :initial-to="user?.search_birthyear2 ?? ''"
const props = defineProps({
  initialFrom: { type: [String, Number, null], default: '' },
  initialTo:   { type: [String, Number, null], default: '' },
})
const emit = defineEmits(['close', 'updated'])

const from = ref('')  // '' = 전체
const to   = ref('')  // '' = 전체
const errorMsg = ref('')
const successMsg = ref('')

// 📅 최신년도부터 역순
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

// 🟦 공통: prop → 내부상태로 동기화
function syncFromProps() {
  // '전체' 또는 null/undefined → ''
  const pf = props.initialFrom ?? ''
  const pt = props.initialTo ?? ''
  from.value = (pf === '전체' || pf === null) ? '' : String(pf)
  to.value   = (pt === '전체' || pt === null) ? '' : String(pt)
  console.log('[YearModal] syncFromProps:', { initialFrom: props.initialFrom, initialTo: props.initialTo, from: from.value, to: to.value })
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
  if (from.value && to.value && parseInt(from.value) > parseInt(to.value)) {
    errorMsg.value = '시작 년도는 끝 년도보다 작거나 같아야 합니다.'
    return
  }

  try {
    // 서버에는 year1/year2로 전달 (''는 라우터에서 null 처리됨)
    const payload = {
      year1: from.value === '' ? '' : from.value,
      year2: to.value   === '' ? '' : to.value,
    }
    console.log('▶ [YearModal] PATCH /api/search/year payload:', payload)

    const res = await axios.patch('/api/search/year', payload, { withCredentials: true })
    console.log('✅ 검색 나이 서버 반영 완료', res.data)
    successMsg.value = '검색 나이가 수정되었습니다.'

    setTimeout(() => {
      // 부모는 {from,to}도 처리 가능 (이미 파싱 로직 있음)
      emit('updated', { from: from.value, to: to.value })
      emit('close')
    }, 800)
  } catch (err) {
    console.error('❌ 검색 나이 업데이트 실패', err)
    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* 가독성: 검정 글씨 기본 */
.popup-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.popup-content {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  width: 90%;
  max-width: 320px;
  text-align: center;
  box-sizing: border-box;
  color: #000;
}
.select-group {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 1rem 0;
  width: 100%;
}
.select-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 45%;
}
.select-label {
  font-size: 0.8rem;
  margin-bottom: 0.2rem;
  color: #000;
}
.year-select {
  --background: #f5f5f5;
  --color: #000;
  --placeholder-color: #000;
  --text-color: #000;
  font-size: 0.8rem;
  width: 100%;
  text-align: center;
  color: #000 !important;
}
ion-select::part(text) { color: #000 !important; }
ion-select-option { color: #000 !important; }

.button-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}
.error-msg { color: #c0392b; font-size: 0.9rem; margin-top: -0.5rem; }
.success-msg { color: #2d7a33; font-size: 0.9rem; margin-top: -0.5rem; }
</style>
