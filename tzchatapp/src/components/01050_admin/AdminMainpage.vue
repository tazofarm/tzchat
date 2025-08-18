<!-- /src/components/04910_Page9_Admin/adminMainpage.vue -->
<template>
  <div class="admin-mainpage">
    <!-- 제목/설명 영역 (추후 필요시 숨기거나 변경 가능) -->
    <h2 class="title">관리 기능</h2>
    <p class="desc">
      아래 메뉴를 눌러 관리 페이지로 이동하세요. (예시는 라우팅 경로만 연결되어 있습니다)
    </p>

    <!-- 🔹 리스트/버튼 영역 -->
    <div class="menu-list">
      <!-- 1) 서버 연결 점검 -->
      <button
        class="menu-btn"
        @click="go('/admin/server-check')"
        title="서버 연결 상태/지연 체크 페이지로 이동"
      >
        1. 서버 연결 점검
      </button>

      <!-- 2) 회원관리 -->
      <button
        class="menu-btn"
        @click="go('/admin/user-manage')"
        title="회원 목록/검색/수정 페이지로 이동"
      >
        2. 회원관리
      </button>

      <!-- 3) 로그관리 -->
      <button
        class="menu-btn"
        @click="go('/admin/log-manage')"
        title="서버/클라이언트 로그 확인 페이지로 이동"
      >
        3. 로그관리
      </button>

      <!-- ✅ 예시 더미: 이후에 자유롭게 추가 가능 -->
      <!--
      <button class="menu-btn" @click="go('/admin/notice-manage')">4. 공지관리 (예시)</button>
      <button class="menu-btn" @click="go('/admin/statistics')">5. 통계 (예시)</button>
      -->
    </div>

    <!-- (옵션) 하단에 간단 가이드 or 디버그 박스 -->
    <div class="debug-box">
      <div>현재 사용자: <strong>{{ nickname || '(알 수 없음)' }}</strong></div>
      <div>클릭 이벤트는 상위로 emit('navigate', 경로) → 라우터 이동</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ------------------------------------------------------
// adminMainpage.vue
// - 관리자 메인에서 보여줄 리스트/버튼 모음
// - 버튼 클릭 시 상위(AdminDashboard)에 'navigate' 이벤트 emit
// - 추후 props/emit 확장하여 필터/상태/권한 제어 가능
// - 주석/로그 최대화 + 글자색 검정
// ------------------------------------------------------


// 상위에서 닉네임 같은 프리셋을 내려주면 표시용으로 활용
const props = defineProps<{
  nickname?: string
}>()

// 상위로 'navigate' 이벤트를 올려서 AdminDashboard에서 라우터를 실제 실행
const emit = defineEmits<{
  (e: 'navigate', path: string): void
}>()

/** 버튼 클릭 → 상위에 경로 알림 */
function go(path: string) {
  console.log('[adminMainpage] navigate:', path)
  emit('navigate', path)
}
</script>

<style scoped>
/* ── adminMainpage.vue: CSS 보정만 적용 ──
   - 가독성: 기본 글씨 검정 유지
   - 모바일 터치 타깃(≥48px) / 버튼 일관 규격
   - safe-area / 작은 화면 대응
   - 포커스 접근성(:focus-visible) 강화
*/

/* 컨테이너 */
.admin-mainpage {
  color: #000;                         /* 기본 텍스트 톤 고정 */
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  max-width: 800px;                    /* 데스크톱에서 너무 넓지 않게 */
  margin: 0 auto;                      /* 중앙 정렬 */
  box-sizing: border-box;
}

/* 제목/설명 */
.title {
  margin: 4px 0 8px;
  font-size: clamp(18px, 3.6vw, 20px);
  font-weight: 700;
  color: #000;
  line-height: 1.25;
}
.desc {
  margin: 0 0 16px;
  font-size: clamp(14px, 2.8vw, 15px);
  color: #222;
  opacity: 0.9;
  line-height: 1.4;
}

/* 메뉴 리스트 */
.menu-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 버튼: 터치 타깃/가독성/일관성 */
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  width: 100%;
  min-height: 48px;                    /* 터치 타깃 */
  padding: 12px 14px;

  font-size: clamp(15px, 3vw, 16px);
  font-weight: 600;
  line-height: 1.2;

  border: 1px solid #333;
  border-radius: 12px;

  background: #fff;
  color: #000;
  text-align: left;                    /* 번호+텍스트 왼쪽 정렬 */
  cursor: pointer;

  transition: background .15s, transform .06s ease-out, box-shadow .15s;
  -webkit-tap-highlight-color: rgba(0,0,0,0.05);
}
.menu-btn:hover { background: #f0f0f0; }
.menu-btn:active { transform: translateY(1px); }
.menu-btn:disabled { opacity: .6; cursor: not-allowed; }

/* 포커스 접근성 */
.menu-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
}

/* 디버그 박스 */
.debug-box {
  margin-top: 18px;
  padding: 10px 12px;
  border: 1px dashed #aaa;
  border-radius: 10px;
  font-size: clamp(13px, 2.6vw, 14px);
  color: #000;
  background: #fafafa;
  line-height: 1.35;
}

/* 초소형 화면(≤360px) 보정 */
@media (max-width: 360px) {
  .admin-mainpage { padding: 14px 14px; }
  .menu-btn { padding: 12px; }
}

</style>
