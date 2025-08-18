<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>검색 특징 수정</h3>

      <select v-model="preference" class="preference-select">
        <option value="">선택</option>
        <option value="이성친구 - 전체" >이성친구 - 전체</option>
        <option value="이성친구 - 일반" >이성친구 - 일반</option>
        <option value="이성친구 - 특수" disabled>이성친구 - 특수</option>
        <option value="동성친구 - 전체" >동성친구 - 전체</option>
        <option value="동성친구 - 일반" disabled>동성친구 - 일반</option>
        <option value="동성친구 - 특수" disabled>동성친구 - 특수</option>
        

      </select>

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
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'

const props = defineProps({ message: String })
const emit = defineEmits(['close', 'updated'])

const preference = ref('')
const errorMsg = ref('')
const successMsg = ref('')

// 초기값 세팅
onMounted(() => {
  preference.value = props.message || ''
  console.log('▶ 초기 검색특징:', preference.value)
})

// 서버 PATCH 요청
const submit = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (!preference.value) {
    errorMsg.value = '특징을 선택해주세요.'
    return
  }
  if (preference.value === props.message) {
    errorMsg.value = '기존 값과 동일합니다.'
    return
  }

  try {
    const res = await axios.patch('/api/search/preference', {
      preference: preference.value,
    }, { withCredentials: true })

    if (res.data.success) {
      successMsg.value = '검색 특징이 수정되었습니다.'
      console.log('✅ 검색특징 수정 성공:', res.data)

      // ✅ 1초 후 닫기 및 부모 업데이트
      setTimeout(() => {
        emit('updated', preference.value)
        emit('close')
      }, 1000)
    } else {
      errorMsg.value = res.data.message || '수정 실패'
    }
  } catch (err) {
    console.error('❌ 서버 요청 실패:', err)
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
  width: 80%;
  max-width: 320px;
  text-align: center;
  color: #000;
}
.preference-select {
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
