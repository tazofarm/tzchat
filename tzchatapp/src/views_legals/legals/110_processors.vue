<!-- src/views/legal/Processors.vue -->
<template>
  <main class="container">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>업무 처리위탁 현황</h1>
    <p>
      회사는 서비스 제공을 위해 일부 업무를 외부 전문업체에 위탁할 수 있으며,
      위탁업무·수탁자·보유기간 등은 아래와 같습니다.
    </p>

    <table class="data-table">
      <thead>
        <tr>
          <th>수탁자</th>
          <th>위탁업무</th>
          <th>제공 항목</th>
          <th>보유·이용기간</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
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
  max-width: 1000px;
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

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.data-table th,
.data-table td {
  border: 1px solid #111111;
  padding: 0.7rem;
  text-align: left;
}

.data-table th {
  background: #5f5f5f;
}
</style>
