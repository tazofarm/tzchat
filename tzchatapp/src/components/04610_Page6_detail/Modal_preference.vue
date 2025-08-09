<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>특징 수정</h3>

      <!-- 셀렉트 박스 -->
      <select v-model="newPreference" class="select-box">
        <option value="이성친구 - 일반">이성친구 - 일반</option>
        <option value="이성친구 - 특수">이성친구 - 특수</option>
      </select>

      <!-- 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 버튼 -->
      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitPreference">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'

const props = defineProps({ message: String })
const emit = defineEmits(['close', 'updated'])

const newPreference = ref('')
const errorMsg = ref('')
const successMsg = ref('')

onMounted(() => {
  newPreference.value = props.message || '이성친구 - 일반'
})

const submitPreference = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const trimmed = newPreference.value.trim()

  if (!trimmed) {
    errorMsg.value = '값을 선택하세요.'
    return
  }

  if (trimmed === props.message) {
    errorMsg.value = '기존 값과 동일합니다.'
    return
  }

  try {
    const res = await axios.patch('/api/user/preference', {
      preference: trimmed
    }, { withCredentials: true })

    if (res.data.success) {
      console.log('[특징 수정 성공]', trimmed)
      successMsg.value = '특징이 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 1000)
    } else {
      errorMsg.value = res.data.message || '수정 실패'
    }
  } catch (err) {
    console.error('[특징 수정 오류]', err)

    if (err.response?.status === 404) {
      errorMsg.value = 'API 경로가 없습니다. 서버를 확인하세요.'
    } else if (err.response?.status === 500) {
      errorMsg.value = '서버 오류가 발생했습니다.'
    } else {
      errorMsg.value = '알 수 없는 오류가 발생했습니다.'
    }
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
  text-align: center;
  width: 80%;
  max-width: 320px;
  color: #000;
}

.select-box {
  width: 100%;
  padding: 0.6rem;
  font-size: 1rem;
  margin: 1rem 0;
  border-radius: 4px;
  border: 1px solid #ccc;
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
