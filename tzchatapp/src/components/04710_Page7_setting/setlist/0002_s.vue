<!-- src/views/LegalDocs.vue -->
<template>
  <div class="page">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h2>법적고지 및 정책 문서2</h2>

    <ul class="doc-list">
      <li>
        <RouterLink to="/legals/privacy">개인정보 처리방침</RouterLink>
        <small>서비스 운영을 위한 개인정보 수집 및 이용에 관한 안내</small>
      </li>
      <li>
        <RouterLink to="/legals/terms">서비스 이용약관</RouterLink>
        <small>회원의 권리, 의무 및 서비스 이용 조건</small>
      </li>
      <li>
        <RouterLink to="/legals/location">위치정보 이용약관</RouterLink>
        <small>위치기반 서비스 제공 시 적용되는 약관</small>
      </li>
      <li>
        <RouterLink to="/legals/delete-account">계정 삭제 안내</RouterLink>
        <small>회원 탈퇴 및 데이터 삭제 절차에 대한 설명</small>
      </li>
      <li>
        <RouterLink to="/legals/youth">청소년 보호정책</RouterLink>
        <small>청소년 이용자 보호를 위한 정책</small>
      </li>
      <li>
        <RouterLink to="/legals/eula">최종 사용자 라이선스 계약 (EULA)</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/cookies">쿠키 정책</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/data-retention">데이터 보관 및 파기 정책</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/marketing-consent">광고성 정보 수신 동의</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/third-parties">제3자 제공 현황</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/processors">업무 처리위탁 현황</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/opensource">오픈소스 라이선스 고지</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/community">커뮤니티 가이드라인</RouterLink>
      </li>
      <li>
        <RouterLink to="/legals/report-block">신고 및 차단 정책</RouterLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
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

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
}

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

a,
:deep(a) {
  text-decoration: none;
  color: #0077cc;
  font-weight: bold;
}

a:hover,
:deep(a:hover) {
  text-decoration: underline;
}

small {
  display: block;
  margin-top: 0.3rem;
  color: #555;
}
</style>
