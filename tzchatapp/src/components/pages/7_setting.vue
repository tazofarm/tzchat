<template>
  <div>
    <label>지역1 (시/도):</label>
    <select v-model="selectedProvince" @change="updateDistricts">
      <option disabled value="">시/도 선택</option>
      <option v-for="(districts, province) in regions" :key="province">{{ province }}</option>
    </select>

    <label v-if="districts.length">지역2 (시/군/구):</label>
    <select v-if="districts.length" v-model="selectedDistrict">
      <option disabled value="">시/군/구 선택</option>
      <option v-for="district in districts" :key="district">{{ district }}</option>
    </select>

    <div v-if="selectedProvince && selectedDistrict">
      <p>선택된 지역: {{ selectedProvince }} {{ selectedDistrict }}</p>
    </div>
  </div>
</template>

<script>
import { regions } from '@/data/regions.js'; // 위에서 만든 데이터

export default {
  data() {
    return {
      regions,
      selectedProvince: '',
      selectedDistrict: '',
      districts: [],
    };
  },
  methods: {
    updateDistricts() {
      this.districts = this.regions[this.selectedProvince] || [];
      this.selectedDistrict = '';
    },
  },
};
</script>

<style scoped>
select {
  margin: 0.5rem;
  padding: 0.4rem;
  font-size: 1rem;
}
label {
  display: block;
  margin-top: 1rem;
}
</style>