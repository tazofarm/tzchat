// routes/index.js
module.exports = (app) => {
   
  app.use((req,res,next)=>{ console.log(`[IN] ${req.method} ${req.originalUrl}`); next(); });
   // User
  // ----------------------------------------------------------
  app.use('/api', require('./user/authRouter'));                 // 역할: 로그인/로그아웃/토큰 발급 등 인증 전담
  app.use('/api', require('./user/profileImageRouter'));         // 역할: 프로필 이미지 업로드·리사이즈·목록·대표 지정·삭제
  app.use('/api', require('./user/userRouter'));                 // 역할: 내 정보 수정(닉네임/지역/자기소개/특징)
  
  
  // ----------------------------------------------------------
  // Admin (특정 경로를 일반 경로보다 먼저 마운트)
  // ----------------------------------------------------------
  app.use('/api/admin', require('./admin/termsRouter'));   // 역할: 관리자 전용 – 약관 (새 버전 발행/목록/활성/비활성)
  app.use('/api/admin', require('./admin/adminRouter'));         // 역할: 관리자 전용 – 시스템 모니터링/유저 관리/채팅 관리/신고 처리/공지/통계/환경

  // ----------------------------------------------------------
  // Public / Legal
   // ----------------------------------------------------------
  app.use('/api/terms', require('./legal/termsPublicRouter'));  // 역할: 약관 관련(최신본 조회/동의/재동의 체크)
  app.use('/api/legal', require('./legal/legalRouter'));  // 역할: 약관 관련(최신본 조회/동의/재동의 체크)

  // ----------------------------------------------------------
  // Chat / Social
  // ----------------------------------------------------------
  app.use('/api', require('./chat/chatRouter'));                 // 역할: 채팅방 생성/조회, 메시지 전송/조회, 읽음처리 등
  app.use('/api', require('./chat/friendRouter'));               // 역할: 친구 신청/수락/거절/차단/해제 및 목록

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------
  app.use('/api', require('./search/targetRouter'));             // 역할: 검색 조건 업데이트 + 다중 지역 기반 사용자 검색
  app.use('/api', require('./search/emergencyRouter'));          // 역할: 긴급모드 on/off, 잔여시간 계산 등

  // ----------------------------------------------------------
  // System
  // ----------------------------------------------------------
  app.use('/api/push', require('./system/pushRouter'));          // 역할: 푸시 디바이스 토큰 등록/해제
  app.use('/api/notices', require('./system/noticeRouter'));            // 역할: 공개 API – 공지사항
  app.use('/api/account', require('./system/accountDeletionRouter'));  // 역할: 회원 탈퇴
  // ----------------------------------------------------------
 
};





