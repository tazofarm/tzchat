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
      <RouterLink :to="makePath('report-block')">신고 및 차단 정책</RouterLink>
      을 확인하시거나 고객센터로 문의하세요.
    </p>

    <!-- ✅ CSAE(아동 성적 학대·착취) 금지 및 신고 섹션 추가 -->
    <section class="section">
      <h2>아동 성적 학대 및 착취(CSAE) 금지 및 신고</h2>
      <p>
        회사는 아동 성적 학대 및 착취(CSAE) 자료의 제작·소지·배포·유통·조회 등 일체의 행위를
        절대 금지합니다. 관련 의심 콘텐츠 발견 시 즉시 신고해 주시기 바랍니다. 접수된 신고는
        신속히 검토되며, 필요 시 수사기관 및 관계기관에 통보되고 콘텐츠는 지체 없이 차단·삭제됩니다.
      </p>
      <ul>
        <li>
          <a href="https://ecrm.police.go.kr/minwon/main" target="_blank" rel="noopener">경찰청 사이버범죄 신고시스템(ECRM)</a>
          — 온라인 접수 후 절차에 따라 수사 진행(긴급은 <strong>112</strong> 신고). 
        </li>
        <li>
          <a href="https://www.kocsc.or.kr" target="_blank" rel="noopener">방송통신심의위원회(KCSC)</a>
          — 전자민원 &gt; 불법·유해정보 신고, 상담전화 <strong>1377</strong>.
        </li>
        <li>
          <a href="https://www.missingkids.org/gethelpnow/cybertipline" target="_blank" rel="noopener">NCMEC CyberTipline</a>
          — 국제 신고 창구(해외 서비스/호스팅 연계 사례 포함).
        </li>
      </ul>
      <p class="small">
        ※ 관련 법령 및 정책에 따라, 확인된 불법 콘텐츠는 신속히 삭제·차단되며, 수사기관 요청 시 필요한 정보를 제공할 수 있습니다.
      </p>
      <p class="updated"><small>최종 업데이트: 2025-09-25</small></p>
    </section>
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
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
main {
  max-width: 850px;
  margin: 0 auto;
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
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
.section { margin-top: 2rem; }
h1 { margin-top: 0; }
h2 { margin: 1.2rem 0 .5rem; }
ul { padding-left: 1.2rem; }
.small { font-size: .9rem; color: #555; }
.updated { margin-top: .5rem; color: #666; }
</style>
