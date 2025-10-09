<template>
  <!-- 빈칸: 홈 버튼, 제스처 영역 피하기 용 -->
  <div class="space" :style="{ height }" aria-hidden="true">
   테스트 일반 회원 ＠ : 10 / # : 10
  </div>
</template>

<script setup>
// ✅ props: height (기본값 '80px')
defineProps({
  height: {
    type: String,
    default: '80px'
  }
})
</script>

<style scoped>
.space {
  width: 100%;
  background: #000000; /* ✅ 블랙 테마 통일 */
  pointer-events: none; /* 클릭 등 상호작용 막음 */

  /* ✅ 세로 중앙 + 가로 오른쪽 정렬 */
  display: flex;
  justify-content: flex-end; /* 👉 오른쪽 정렬 */
  align-items: center;       /* ↕ 세로 중앙 */

  color: white;              /* 보기 쉽게 글자색 추가 */
  font-size: 14px;
  padding-right: 10px;       /* 살짝 여백 */
}
</style>
