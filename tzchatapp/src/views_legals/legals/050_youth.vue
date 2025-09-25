<!-- src/views/legal/YouthPolicy.vue -->
<template>
  <main class="container">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>청소년 보호정책</h1>
    <p>
      회사는 청소년이 유해정보에 노출되거나 유해행위를 하지 않도록 다음의 보호조치를 시행합니다.
    </p>
    <ul>
      <li>유해 콘텐츠(음란물, 폭력, 불법행위 조장 등) 탐지 및 신고/차단 체계 운영</li>
      <li>커뮤니티 가이드라인 준수 교육 및 위반 시 조치</li>
      <li>필요 시 연령확인 절차 운영 및 부모 등 법정대리인 요청 대응</li>
    </ul>
    <p>
      신고/상담:
      <router-link to='report-block'>신고 및 차단 정책</router-link>
      을 확인하시거나 고객센터로 문의하세요.
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
  max-width: 850px;
  box-sizing: border-box;
  margin-left: auto;
  margin-right: auto;
  background-clip: padding-box;
  border-radius: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* iOS 부드러운 스크롤 */
  overscroll-behavior: contain;      /* 상하단 바운스 시 상위 스크롤 방지 */
  scrollbar-gutter: stable;          /* 스크롤바 점프 방지(지원 브라우저) */
}

main {
  max-width: 850px;
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

h1 { margin-top: 0; }
ul { padding-left: 1.2rem; }
</style>
