<template>
  <div class="main-chat">
    <router-view />
  </div>
</template>

<style scoped>
/* 채팅용 상위 컨테이너:
   - 높이: 동적 뷰포트(dvh) 채택 → 키보드 열릴 때 자동 축소
   - 스크롤: 하위 페이지(ChatroomPage 등)에서 담당
   - 패딩/여백 제거 → 입력창과 키보드 간격 최소화에 유리
*/
.main-chat {
  position: relative;

  /* Fallback → Modern: 지원 브라우저에서 100dvh가 우선 적용됨 */
  height: 100svh;
  height: 100dvh;

  min-height: 0;
  display: flex;
  flex-direction: column;

  /* 스크롤은 자식이 담당 (예: ChatroomPage의 메시지 리스트 영역) */
  overflow: hidden;

  background-color: #121212; /* 다크 베이스 */
}
</style>
