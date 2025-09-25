<!-- src/views/legal/ReportBlock.vue -->
<template>
  <main class="container">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>신고 및 차단 정책</h1>

    <h2>신고 대상</h2>
    <p>
      불법·유해 콘텐츠, 스팸, 괴롭힘, 지식재산권 침해 등 가이드라인 위반 행위
    </p>

    <h2>신고 방법</h2>
    <ol>
      <li>앱 내 신고 버튼 이용(가능한 경우)</li>
      <li>
        고객센터 메일:
        <a href="mail to:tazocode@gmail.com">tazocode@gmail.com</a>
      </li>
    </ol>

    <h2>차단</h2>
    <p>
      사용자는 특정 사용자를 차단하여 대화·노출을 제한할 수 있습니다. 반복 위반자는
      서비스 이용 제한이 있을 수 있습니다.
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
  max-width: 820px;
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

h2 {
  margin-top: 2rem;
}

ol {
  padding-left: 1.2rem;
}
</style>
