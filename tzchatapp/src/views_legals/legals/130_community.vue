<!-- src/views/legal/CommunityGuidelines.vue -->
<template>
  <main class="container">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>커뮤니티 가이드라인</h1>
    <ul>
      <li>타인 존중: 혐오·차별·괴롭힘 금지</li>
      <li>안전 우선: 폭력·자해·불법행위 조장 금지</li>
      <li>프라이버시 보호: 민감정보 무단 공유 금지</li>
      <li>지식재산 존중: 무단복제·도용 금지</li>
      <li>스팸 금지: 도배·광고성 활동 제한</li>
    </ul>
    <p>
      위반 시 경고, 콘텐츠 삭제, 계정 제한/해지 등 조치가 취해질 수 있습니다.
    </p>
  </main>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// 현재 URL이 /home 으로 시작하면 홈용 경로 프리픽스 적용
const basePath = computed(() => (route.path.startsWith('/home') ? '/home' : ''));

// 슬러그를 받아 환경에 맞는 전체 경로 생성
const makePath = (slug) => `${basePath.value}/legals/${slug}`;

const goBack = () => {
  window.history.back();
};
</script>


<style scoped>
.container {
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  margin: 0;
  padding: 2rem;
  line-height: 1.7;
  background: #fafafa;
  color: #111;
  min-height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* iOS 부드러운 스크롤 */
  overscroll-behavior: contain;      /* 상하단 바운스 시 상위 스크롤 방지 */
  scrollbar-gutter: stable;          /* 스크롤바 점프 방지(지원 브라우저) */
}

main {
  max-width: 900px;
  margin: 0 auto;
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}

.back-wrap {
  margin-bottom: 1rem;
}

.back-btn {
  background-color: #0077cc;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}

h1 {
  margin-top: 0;
}

ul {
  padding-left: 1.2rem;
}
</style>
