<template>
  <!-- ✅ 카드 클릭 시 부모에게 open 이벤트만 보냄 -->
  <div class="card editable-card" @click="$emit('open')">
    <div class="card-title">검색지역</div>
    <div class="card-value">
      {{ displayRegion }}
    </div>
  </div>
</template>

<script setup>
// ✅ 지역 문자열은 props.regions 기반으로 표시
import { computed } from 'vue'

const props = defineProps({
  // 예: [{ region1:'전체', region2:'전체' }] 또는 [{ region1:'서울', region2:'전체' }, { region1:'서울', region2:'강남구' }]
  regions: {
    type: Array,
    default: () => []
  }
})
defineEmits(['open'])

// ✅ 사용자 표시용 문자열
const displayRegion = computed(() => {
  if (!Array.isArray(props.regions) || props.regions.length === 0) return '전체'
  // 보기 좋은 문자열로 변환
  const tokens = props.regions.map(r => {
    if (!r?.region1 || r.region1 === '전체') return '전체'
    if (!r?.region2 || r.region2 === '전체') return `${r.region1} 전체`
    return `${r.region1} - ${r.region2}`
  })
  // 중복 제거
  const uniq = Array.from(new Set(tokens))
  return uniq.join(', ')
})
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
}
.card-title {
  font-weight: bold;
  font-size: 0.95rem;
  margin-bottom: 0.4rem;
  color: #333;
}
.card-value {
  font-size: 0.95rem;
  color: #000; /* 검정 글씨(가독성) */
}
</style>
