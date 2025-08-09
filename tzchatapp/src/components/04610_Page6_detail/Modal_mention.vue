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
/* 🔹 팝업 오버레이 */
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

/* 🔹 팝업 내용 */
.popup-content {
  background: white;
  padding: 1.5rem;
  border-radius: 10px;
  text-align: center;
  width: 80%;
  max-width: 320px;
  color: #000;
}

/* 🔹 입력창 스타일 */
.intro-textarea {
  width: 100%;
  padding: 0.7rem;
  font-size: 1rem;
  margin: 1rem 0;
  border: 1px solid #ccc;
  border-radius: 6px;
  resize: none;
}

/* 🔹 버튼 그룹 */
.button-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* 🔹 메시지 스타일 */
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
