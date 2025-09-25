<!-- src/views/legal/CookiesPolicy.vue -->
<template>
  <main class="container">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>쿠키 정책</h1>
    <p>
      쿠키는 서비스 이용 편의를 위해 단말기에 저장되는 작은 텍스트 파일입니다.
    </p>

    <h2>사용 목적</h2>
    <ul>
      <li>세션 유지, 로그인 상태 확인</li>
      <li>보안 및 이상행위 감지</li>
      <li>서비스 품질 및 사용성 개선</li>
    </ul>

    <h2>관리 방법</h2>
    <p>
      브라우저 설정에서 쿠키 수신을 거부하거나 삭제할 수 있습니다.
      다만 일부 기능이 제한될 수 있습니다.
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
  max-width: 760px;
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
h2 { margin-top: 2rem; }
ul { padding-left: 1.2rem; }
</style>
