<!-- src/views/legal/LocationTerms.vue -->
<template>
  <main class="container">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>위치정보 이용약관</h1>
    <p class="updated"><small>최종 업데이트: 2025-09-14</small></p>

    <h2>1. 위치기반서비스의 내용</h2>
    <p>
      서비스는 친구 찾기, 주변 사용자 표시, 긴급 기능 제공 등을 위해 단말기의 위치정보를 활용할 수 있습니다.
    </p>

    <h2>2. 동의 및 철회</h2>
    <ul>
      <li>최초 이용 시 명시적 동의가 필요합니다.</li>
      <li>단말 설정 또는 서비스 내 설정에서 언제든지 동의를 철회할 수 있습니다.</li>
    </ul>

    <h2>3. 보관 및 파기</h2>
    <p>
      위치정보는 목적 달성 후 즉시 파기하며, 법령상 보관의무가 있는 경우 그 기간 동안 안전하게 보관합니다.
    </p>

    <h2>4. 제3자 제공</h2>
    <p>정보주체의 동의 또는 법령 근거 없이 제3자에게 제공하지 않습니다.</p>

    <h2>5. 권리와 방법</h2>
    <p>
      정보주체는 위치정보 열람·정정·삭제를 요청할 수 있으며, 문의처는 본 문서 하단의 연락처를 참고하세요.
    </p>

    <h2>6. 문의처</h2>
    <p>이메일: tazocode@gmail.com</p>
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

h1 { margin-top: 0; }
h2 { margin-top: 2rem; }
ul { padding-left: 1.2rem; }

.updated { margin-top: 0.25rem; color: #666; }
</style>
