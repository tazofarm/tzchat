<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>닉네임 수정</h3>

      <input
        v-model="newNickname"
        type="text"
        placeholder="새 닉네임을 입력하세요"
        class="nickname-input"
      />

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitNickname">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'

// 🔹 Props: 기존 닉네임 전달받음
const props = defineProps({
  message: String
})

// 🔹 Emits: 부모에 닫기(close) 및 수정 완료(updated) 전달
const emit = defineEmits(['close', 'updated'])

const newNickname = ref(props.message || '')
const errorMsg = ref('')
const successMsg = ref('')

// 🔧 닉네임 수정 요청
const submitNickname = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const trimmed = newNickname.value.trim()

  // 입력 유효성 검사
  if (!trimmed) {
    errorMsg.value = '닉네임을 입력하세요.'
    return
  }
  if (trimmed === props.message) {
    errorMsg.value = '기존 닉네임과 동일합니다.'
    return
  }

  try {
    // 닉네임 PUT 요청
    const response = await axios.put(
      '/api/update-nickname',
      { nickname: trimmed },
      { withCredentials: true }
    )

    if (response.data.success) {
      console.log(`[닉네임 수정 성공] → ${trimmed}`)
      successMsg.value = '닉네임이 성공적으로 수정되었습니다.'

      // 1초 후 닫기 및 부모에 변경 알림
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 1000)
    } else {
      errorMsg.value = response.data.message || '닉네임 수정 실패'
      console.warn(`[닉네임 수정 실패] → ${errorMsg.value}`)
    }
  } catch (err) {
    console.error('[닉네임 수정 중 오류]', err)
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
  text-align: center;
  width: 80%;
  max-width: 320px;
  color: #000;
}

.nickname-input {
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
  margin: 1rem 0;
  border: 1px solid #ccc;
  border-radius: 4px;
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
