<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>검색 특징 수정</h3>

      <!-- ✅ DB값(현재 저장값)이 항상 먼저 선택되도록 v-model 초기화/동기화 -->
      <!-- ✅ 비활성 옵션도 "현재 값"일 때는 선택된 상태로 표시되도록 disabled 동적 제어 -->
      <select v-model="preference" class="preference-select">
        <option value="">선택</option>
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
          :disabled="isOptionDisabled(opt.value)"
        >
          {{ opt.label }}
        </option>
      </select>

      <!-- 인라인 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 버튼 -->
      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submit">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* ============================================================
   Search_Preference_Modal.vue
   - DB에서 받은 값(props.message)이 항상 우선 보이도록 구현
   - 비활성 옵션도 "현재 DB값"일 경우엔 선택 상태 유지(비활성 해제)
   - 변경 요청 외 나머지는 최대한 유지 / 상세 로그 포함
============================================================ */
import { ref, onMounted, watch } from 'vue'
import axios from '@/lib/api'
import { IonButton } from '@ionic/vue'

/* 🔹 부모가 넘겨주는 현재 저장값 */
const props = defineProps({
  message: { type: String, default: '' } // 예: "이성친구 - 전체"
})
const emit = defineEmits(['close', 'updated'])

/* 🔹 상태 */
const preference = ref('')      // 현재 선택 값(초기/재오픈 시 props.message로 동기화)
const errorMsg   = ref('')
const successMsg = ref('')

/* 🔹 옵션 목록 (기본 disabled 포함) */
const options = [
  { label: '이성친구 - 전체', value: '이성친구 - 전체', disabled: false },
  { label: '이성친구 - 일반', value: '이성친구 - 일반', disabled: false },
  { label: '이성친구 - 특수', value: '이성친구 - 특수', disabled: true  },
  { label: '동성친구 - 전체', value: '동성친구 - 전체', disabled: false },
  { label: '동성친구 - 일반', value: '동성친구 - 일반', disabled: true  },
  { label: '동성친구 - 특수', value: '동성친구 - 특수', disabled: true  },
]

/* 🔹 옵션 disabled 여부 계산
   - 기본은 opt.disabled 값을 따름
   - 단, 현재 선택값(preference.value)과 같으면 선택 가능하도록 disabled 해제
     → DB값이 비활성 옵션이어도 모달을 열었을 때 "현재 값"이 그대로 보이게 함 */
function isOptionDisabled(value) {
  const opt = options.find(o => o.value === value)
  if (!opt) return false
  if (value === preference.value) return false
  return !!opt.disabled
}

/* 🔹 초기값/재오픈 동기화: DB값이 항상 먼저 보이도록 */
function syncFromProps() {
  preference.value = props.message || ''
  console.log('▶ [SearchPreferenceModal] 초기/동기화 preference:', preference.value)
}
onMounted(syncFromProps)
watch(() => props.message, syncFromProps)

/* 🔹 서버 PATCH */
const submit = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  // 유효성
  if (!preference.value) {
    errorMsg.value = '특징을 선택해주세요.'
    return
  }
  if (preference.value === (props.message || '')) {
    errorMsg.value = '기존 값과 동일합니다.'
    return
  }

  try {
    console.log('▶ [SearchPreferenceModal] PATCH /api/search/preference', { preference: preference.value })
    const res = await axios.patch(
      '/api/search/preference',
      { preference: preference.value },
      { withCredentials: true }
    )

    if (res.data?.success) {
      successMsg.value = '검색 특징이 수정되었습니다.'
      console.log('✅ 검색특징 수정 성공:', res.data)
      setTimeout(() => {
        emit('updated', preference.value) // 부모 UI 즉시 반영
        emit('close')
      }, 800)
    } else {
      errorMsg.value = res.data?.message || '수정 실패'
      console.warn('❗ 검색특징 수정 실패:', res.data)
    }
  } catch (err) {
    console.error('❌ 서버 요청 실패:', err)
    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* 가독성: 기본 검정 글씨 유지 + 모달 레이아웃 */
.popup-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.popup-content {
  background: #fff;
  color: #000;
  padding: 1.5rem;
  border-radius: 10px;
  width: 80%;
  max-width: 320px;
  text-align: center;
  box-sizing: border-box;
}
.preference-select {
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
  margin: 1rem 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #000;
}
.button-group { display: flex; gap: 0.5rem; margin-top: 1rem; }
.error-msg   { color: #c0392b; font-size: 0.9rem; margin-top: -0.5rem; }
.success-msg { color: #2d7a33; font-size: 0.9rem; margin-top: -0.5rem; }
</style>
