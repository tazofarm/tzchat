<!-- src/views/legal/PrivacyPolicy.vue -->
<template>
  <!-- 🔽 /home 접속 시 'is-home' 클래스를 붙여 CSS 분기 -->
  <main class="container" :class="{ 'is-home': isHome }">
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>개인정보 처리방침</h1>
    <p class="updated"><small>최종 업데이트: 2025-09-14</small></p>

    <p>
      본 개인정보 처리방침은 "네네챗"(이하 “회사”)가 제공하는 서비스(이하 “서비스”) 이용과 관련하여,
      정보주체의 개인정보를 어떤 목적으로, 어떤 방식으로 처리하는지 및 정보주체의 권리를 어떻게 보장하는지 설명합니다.
    </p>

    <h2>1. 수집하는 개인정보</h2>
    <ul>
      <li>필수: 계정 ID, 비밀번호(해시), 닉네임, 이메일, 기기식별정보(로그인/보안), 서비스 이용기록, 접속 로그, IP</li>
      <li>선택: 프로필 이미지, 상태메시지, 연락처 동기화 정보(선택 동의 시)</li>
      <li>
        위치기반 서비스 이용 시:
        기기 위치정보(별도 동의 시,
        <router-link :to="makePath('location')">위치정보 이용약관</router-link>
        참조)
      </li>
    </ul>

    <h2>2. 처리 목적</h2>
    <ul>
      <li>회원 가입·인증 및 서비스 제공, 안정적 운영 및 장애 대응</li>
      <li>부정이용 방지, 보안 및 안전 확보</li>
      <li>고객문의 대응, 민원처리, 공지사항 전달</li>
      <li>
        선택 동의 시, 마케팅 정보 제공(
        <router-link :to="makePath('marketing-consent')">광고성 정보 수신 동의</router-link>
        )
      </li>
    </ul>

    <h2>3. 처리 및 보관 기간</h2>
    <p>
      개인정보는 목적 달성 시 지체없이 파기합니다. 단, 법령에 따라 일정 기간 보관할 수 있으며
      상세는 <router-link :to="makePath('data-retention')">데이터 보관 및 파기 정책</router-link>을 따릅니다.
    </p>

    <h2>4. 제3자 제공 및 처리위탁</h2>
    <p>
      회사는 원칙적으로 개인정보를 외부에 제공하지 않습니다. 불가피하게 제공이 필요한 경우,
      정보주체에게 사전 고지·동의를 받습니다. 처리위탁 시 수탁자와 목적, 보유기간 등은
      <router-link :to="makePath('processors')">처리위탁 현황</router-link>에 공개합니다.
      제3자 제공이 발생할 경우 <router-link :to="makePath('third-parties')">제3자 제공 현황</router-link>에 공개합니다.
    </p>

    <h2>5. 국외 이전</h2>
    <p>
      국외 이전이 필요한 경우 법령에 따라 필요한 고지·동의 및 보호조치를 이행합니다.
    </p>

    <h2>6. 정보주체의 권리</h2>
    <ul>
      <li>열람·정정·삭제·처리정지 요구권</li>
      <li>동의 철회 및 탈퇴(<router-link :to="makePath('delete-account')">계정 삭제 안내</router-link>)</li>
      <li>권리행사 방법: 서비스 내 설정 또는 아래 연락처로 요청</li>
    </ul>

    <h2>7. 아동·청소년 보호</h2>
    <p>
      미성년자의 개인정보는 법정대리인의 동의가 필요한 경우에 한해 수집·이용하며,
      유해정보로부터의 보호 원칙은
      <router-link :to="makePath('youth')">청소년 보호정책</router-link>에 따릅니다.
    </p>

    <h2>8. 쿠키 이용</h2>
    <p>
      서비스 품질 향상 및 보안 유지를 위해 쿠키를 사용할 수 있습니다.
      자세한 내용은 <router-link :to="makePath('cookies')">쿠키 정책</router-link>을 확인하세요.
      브라우저 설정에서 쿠키 수신을 거부할 수 있습니다.
    </p>

    <h2>9. 보안조치</h2>
    <ul>
      <li>암호화 저장(비밀번호 해시), 전송구간 암호화(HTTPS)</li>
      <li>접근통제, 권한관리, 로그 모니터링, 취약점 점검</li>
    </ul>

    <h2>10. 변경 고지</h2>
    <p>방침 변경 시 시행일 최소 7일 전 공지합니다(중요 변경은 30일 전).</p>

    <h2>11. 문의처</h2>
    <div class="box">
      <p>개인정보 보호책임자 : 김영주</p>
      <p>이메일 : tazocode@gmail.com</p>
      <p>주소 : (예) 서울특별시 광진구 </p>
    </div>
  </main>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

/** /home 접속 여부 */
const isHome = computed(() => route.path.startsWith('/home'));

/** 현재 위치에 맞는 프리픽스 */
const basePath = computed(() => (isHome.value ? '/home' : ''));

/** 링크 경로 생성기 */
const makePath = (slug) => `${basePath.value}/legals/${slug}`;

const goBack = () => window.history.back();
</script>

<style scoped>
/* 기본: 외부(비-홈)에서 자체 스크롤 */
.container {
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  margin: 0;
  padding: 2rem;
  line-height: 1.7;
  background: #111;          /* 스크린샷 톤 맞춤(원래 색 쓰셔도 됩니다) */
  color: #eee;               /* 다크 배경 대비 */
  box-sizing: border-box;

  height: 100dvh;            /* 자체 스크롤 컨테이너 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

/* ✅ /home(ion-content 내부)에서는 높이 고정 금지 + 탭바 높이만큼 여백 */
.container.is-home {
  height: auto;              /* ion-content가 높이/스크롤 관리 */
  min-height: 100%;
  overflow-y: visible;       /* 내부에서 별도 스크롤 생성 금지 */
  padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px) + 72px); 
  /* ↑ 탭바(≈56~64px) + 안전영역 + 여유 */
}

main {
  max-width: 900px;
  margin: 0 auto;
  background: #1b1b1b;
  color: #eee;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.25);
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

h1 { margin-top: 0; }
h2 { margin-top: 2rem; }

code, b {
  background: #2a2a2a;
  padding: .08rem .35rem;
  border-radius: 4px;
}

ul { padding-left: 1.2rem; }

/* 본문 크기 조절 */
p { font-size: 12px; }
.container li { font-size: 12px; }

/* 링크 */
a, :deep(a) { color: #66b3ff; text-decoration: none; }
a:hover, :deep(a:hover) { text-decoration: underline; }

.box {
  background: #151a1f;
  border: 1px solid #26313d;
  padding: 1rem;
  border-radius: 10px;
}
</style>
