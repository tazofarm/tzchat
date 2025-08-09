<template>
  <div class="card editable-card" @click="$emit('open')">
    <div class="card-title">검색나이</div>
    <div class="card-value">
      {{
        (birthyear1 === '' ? '전체' : birthyear1) +
        ' ~ ' +
        (birthyear2 === '' ? '전체' : birthyear2)
      }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  birthyear1: String,
  birthyear2: String
})
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
