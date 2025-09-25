<!-- src/views/legal/DataRetention.vue -->
<template>
  <main class="container">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>데이터 보관 및 파기 정책</h1>
    <p>
      회사는 목적 달성 시 지체없이 파기하며, 법령에 의해 보관이 필요한 경우 그 기간 동안 안전하게 보관합니다.
    </p>

    <table class="data-table">
      <thead>
        <tr>
          <th>데이터 항목</th>
          <th>보관기간</th>
          <th>근거/목적</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>계정 정보(필수)</td>
          <td>탈퇴 시 까지</td>
          <td>계약 이행</td>
        </tr>
        <tr>
          <td>로그·접속 IP</td>
          <td>3~12개월</td>
          <td>보안/사고조사·법령</td>
        </tr>
        <tr>
          <td>결제 관련</td>
          <td>5년</td>
          <td>전자상거래 등 소비자보호법</td>
        </tr>
        <tr>
          <td>고객문의</td>
          <td>3년</td>
          <td>민원 처리</td>
        </tr>
      </tbody>
    </table>

    <p>상세 기준은 서비스 고도화 또는 법령 변경 시 업데이트됩니다.</p>
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
  max-width: 950px;
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
  border: 1px solid #e5e5e5;
  padding: 0.7rem;
  text-align: left;
}

.data-table th {
  background: #f7f7f7;
}
</style>
