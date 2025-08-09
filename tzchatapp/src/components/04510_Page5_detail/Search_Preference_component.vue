<template>
  <div class="card editable-card" @click="$emit('open')">
    <div class="card-title">검색특징</div>
    <div class="card-value">{{ preference || '전체' }}</div>
  </div>
</template>

<script setup>
defineProps({ preference: String })
defineEmits(['open'])
</script>

<style scoped>
.card {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: #fff;
  color: #222;
}
.editable-card {
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.editable-card:hover {
  background-color: #f5f5f5;
}
.card-title {
  font-weight: bold;
  font-size: 0.95rem;
  margin-bottom: 0.4rem;
  color: #333;
}
.card-value {
  font-size: 0.95rem;
  color: #000;
}
</style>
