<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>지역 정보</h3>

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

      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="saveRegion">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { IonButton } from '@ionic/vue'
import { regions } from '@/data/regions.js'

const props = defineProps({
  message: String // 예: '서울 강남구'
})
const emit = defineEmits(['close', 'save'])

const selectedRegion1 = ref('')
const selectedRegion2 = ref('')
const region2Options = ref([])

// 초기값 분리
const parseMessage = () => {
  const [r1, r2] = props.message.split(' ')
  selectedRegion1.value = r1 || ''
  selectedRegion2.value = r2 || ''
  region2Options.value = regions[r1] || []
}

const onRegion1Change = () => {
  region2Options.value = regions[selectedRegion1.value] || []
  selectedRegion2.value = ''
}

const saveRegion = () => {
  emit('save', selectedRegion1.value, selectedRegion2.value)
  emit('close')
}

parseMessage() // 최초 로딩 시 message 파싱
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
</style>
