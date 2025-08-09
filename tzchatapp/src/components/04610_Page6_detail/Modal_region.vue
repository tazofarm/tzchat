<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>지역 수정</h3>

      <div class="select-group">
        <label for="region1">지역1 (시/도)</label>
        <select id="region1" v-model="selectedRegion1" @change="onRegion1Change">
          <option disabled value="">시/도 선택</option>
          <option v-for="(districts, province) in regions" :key="province">{{ province }}</option>
        </select>

        <label for="region2">지역2 (시/군/구)</label>
        <select id="region2" v-model="selectedRegion2">
          <option disabled value="">시/군/구 선택</option>
          <option v-for="district in region2Options" :key="district">{{ district }}</option>
        </select>
      </div>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitRegion">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { IonButton } from '@ionic/vue'
import axios from '@/lib/axiosInstance'
import { regions } from '@/data/regions.js'

// props 및 emit 정의
const props = defineProps({ message: String }) // 예: '서울 강남구'
const emit = defineEmits(['close', 'updated'])

// 상태 변수
const selectedRegion1 = ref('')
const selectedRegion2 = ref('')
const region2Options = ref([])

const errorMsg = ref('')
const successMsg = ref('')

// 초기 세팅: message를 기반으로 selectedRegion1/2 설정
onMounted(() => {
  const [r1, r2] = props.message.split(' ')
  selectedRegion1.value = r1 || ''
  selectedRegion2.value = r2 || ''
  region2Options.value = regions[r1] || []
})

// 지역1 변경 시 하위 옵션 재설정
const onRegion1Change = () => {
  region2Options.value = regions[selectedRegion1.value] || []
  selectedRegion2.value = ''
}

// 서버 전송
const submitRegion = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const r1 = selectedRegion1.value
  const r2 = selectedRegion2.value

  if (!r1 || !r2) {
    errorMsg.value = '지역을 모두 선택하세요.'
    return
  }

  const combined = `${r1} ${r2}`
  if (combined === props.message) {
    errorMsg.value = '기존 지역과 동일합니다.'
    return
  }

  try {
    const res = await axios.patch('/api/user/region', {
      region1: r1,
      region2: r2
    }, { withCredentials: true })

    if (res.data.message) {
      console.log('[지역 수정 성공]', combined)
      successMsg.value = '지역이 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', combined)
        emit('close')
      }, 1000)
    } else {
      errorMsg.value = res.data.message || '수정 실패'
    }
  } catch (err) {
    console.error('[지역 수정 오류]', err)
    errorMsg.value = '서버 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
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
.select-group {
  margin-top: 1rem;
  text-align: left;
}
.select-group label {
  font-size: 0.9rem;
  margin-bottom: 0.2rem;
  display: block;
  color: #333;
}
.select-group select {
  width: 100%;
  padding: 0.4rem;
  font-size: 0.95rem;
  margin-bottom: 1rem;
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
}
.success-msg {
  color: green;
  font-size: 0.9rem;
}
</style>
