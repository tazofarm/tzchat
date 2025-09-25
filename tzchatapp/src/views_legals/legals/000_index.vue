<!-- src/views/LegalDocs.vue -->
<template>
  <div class="page">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h2>법적고지 및 정책 문서</h2>

    <ul class="doc-list">
      <li>
        <RouterLink class="doc-link" :to="makePath('privacy')">개인정보 처리방침</RouterLink>
        <small>서비스 운영을 위한 개인정보 수집 및 이용에 관한 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('terms')">서비스 이용약관</RouterLink>
        <small>회원의 권리, 의무 및 서비스 이용 조건</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('location')">위치정보 이용약관</RouterLink>
        <small>위치기반 서비스 제공 시 적용되는 약관</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('delete-account')">계정 삭제 안내</RouterLink>
        <small>회원 탈퇴 및 데이터 삭제 절차에 대한 설명</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('youth')">청소년 보호정책</RouterLink>
        <small>청소년 이용자 보호를 위한 정책</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('eula')">최종 사용자 라이선스 계약 (EULA)</RouterLink>
        <small>소프트웨어 사용 조건 및 제약 사항 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('cookies')">쿠키 정책</RouterLink>
        <small>쿠키 저장 및 활용 방식에 관한 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('data-retention')">데이터 보관 및 파기 정책</RouterLink>
        <small>개인정보의 보관 기간과 안전한 파기 절차 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('marketing-consent')">광고성 정보 수신 동의</RouterLink>
        <small>마케팅 및 프로모션 정보 수신 여부에 대한 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('third-parties')">제3자 제공 현황</RouterLink>
        <small>개인정보가 제공되는 제3자 현황 및 목적 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('processors')">업무 처리위탁 현황</RouterLink>
        <small>개인정보 처리 업무 위탁 현황 및 관리 방안 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('opensource')">오픈소스 라이선스 고지</RouterLink>
        <small>사용된 오픈소스 소프트웨어 및 라이선스 고지</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('community')">커뮤니티 가이드라인</RouterLink>
        <small>이용자가 지켜야 할 커뮤니티 규칙과 매너 안내</small>
      </li>
      <li>
        <RouterLink class="doc-link" :to="makePath('report-block')">신고 및 차단 정책</RouterLink>
        <small>부적절한 이용자 신고 및 차단 처리 절차 안내</small>
      </li>
    </ul>
  </div>
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
.page {
  font-family: "Segoe UI", Arial, sans-serif;
  background: #fafafa;
  margin: 0;
  padding: 2rem;
  line-height: 1.6;

    /* 🔽 외부 레이아웃이 overflow를 막아도, 이 컴포넌트 안에서 스크롤 가능하게 */
  height: 100dvh;           /* 모바일 주소창 대응되는 뷰포트 단위 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* iOS 부드러운 스크롤 */
}

.back-wrap { margin-bottom: 1rem; }
.back-btn {
  background-color: #0077cc;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}

h2 { text-align: center; margin-bottom: 1.5rem; }

.doc-list {
  list-style: none;
  padding: 0;
  max-width: 600px;
  margin: 0 auto;
}

.doc-list li {
  background: #fff;
  margin-bottom: 0.8rem;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* ✅ 링크 색상 고정 */
:deep(.doc-link),
:deep(.doc-link:visited),
:deep(.doc-link:active),
:deep(.doc-link.router-link-active),
:deep(.doc-link:hover),
:deep(.doc-link:focus) {
  color: #000 !important;
  text-decoration: none;
  font-weight: bold;
}

small {
  display: block;
  margin-top: 0.3rem;
  color: #555;
}
</style>
