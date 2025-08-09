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
import { ref, computed, onMounted } from 'vue'
import { IonButton, IonSelect, IonSelectOption } from '@ionic/vue'
import axios from '@/lib/axiosInstance'

const props = defineProps({ message: String })
const emit = defineEmits(['close', 'updated'])

const from = ref('')
const to = ref('')
const errorMsg = ref('')
const successMsg = ref('')

// 최신년도부터 정렬된 연도 목록
const thisYear = new Date().getFullYear()
const maxYear = thisYear - 19
const years = Array.from({ length: maxYear - 1950 + 1 }, (_, i) => maxYear - i)

// 🟡 조건부 필터링된 연도 목록
const filteredFromYears = computed(() => {
  return to.value
    ? years.filter((year) => parseInt(year) <= parseInt(to.value))
    : years
})
const filteredToYears = computed(() => {
  return from.value
    ? years.filter((year) => parseInt(year) >= parseInt(from.value))
    : years
})

// 🔵 초기값 설정 (props.message = '2003~2006' 형태)
onMounted(() => {
  const [f, t] = props.message?.split('~').map((s) => s.trim()) || []

  // 빈 문자열 '' 대신 '전체'도 받을 수 있으니 그걸 ''로 변환해서 선택박스에 맞게 설정
  from.value = f === '전체' ? '' : f || ''
  to.value = t === '전체' ? '' : t || ''
})

// 🔵 제출 버튼 클릭 시 실행
const submit = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  // 유효성 검사
  if (from.value && to.value && parseInt(from.value) > parseInt(to.value)) {
    errorMsg.value = '시작 년도는 끝 년도보다 작거나 같아야 합니다.'
    return
  }

  try {
    // 서버로 보낼 때는 빈 문자열은 '전체'로 바꿔서 보냄
    const payloadYear1 = from.value === '' ? '전체' : from.value
    const payloadYear2 = to.value === '' ? '전체' : to.value

    const res = await axios.patch(
      '/api/search/year',
      { year1: payloadYear1, year2: payloadYear2 },
      { withCredentials: true }
    )
    console.log('✅ 검색 나이 서버 반영 완료', res.data)
    successMsg.value = '검색 나이가 수정되었습니다.'

    setTimeout(() => {
      // ❗ 빈 값 처리 시 물결만 남는 것 방지
      let rangeLabel = ''
      if (from.value && to.value) rangeLabel = `${from.value}~${to.value}`
      else if (from.value) rangeLabel = `${from.value}~`
      else if (to.value) rangeLabel = `~${to.value}`
      else rangeLabel = '' // 아무것도 없으면 빈 문자열

      emit('updated', rangeLabel)
      emit('close')
    }, 1000)
  } catch (err) {
    console.error('❌ 검색 나이 업데이트 실패', err)
    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
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
  color: black;
}
.year-select {
  --background: #f5f5f5;
  --color: #000;
  --placeholder-color: #000;
  --text-color: #000;
  font-size: 0.8rem;
  width: 100%;
  text-align: center;
  color: black !important;
}
ion-select::part(text) {
  color: black !important;
}
ion-select-option {
  color: black !important;
}
.button-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}
.error-msg {
  color: red;
  font-size: 0.9rem;
  margin-top: -0.5rem;
}
.success-msg {
  color: green;
  font-size: 0.9rem;
  margin-top: -0.5rem;
}
</style>
