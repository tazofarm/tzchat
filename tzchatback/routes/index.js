// routes/index.js
module.exports = (app) => {
  // 간단 인바운드 로그
  app.use((req, res, next) => {
    console.log(`[IN] ${req.method} ${req.originalUrl}`);
    next();
  });

  // ----------------------------------------------------------
  // ✅ Public / Open — 로그인 불필요 엔드포인트들을 "먼저" 마운트
  //    (catch-all 성격의 일반 /api 라우터보다 선행해야 합니다)
  // ----------------------------------------------------------
 
  app.use('/api/auth/pass', require('./pass/passRouter')); // PASS (정상 공급사 연동)
  
  app.use('/api/auth/passmanual', require('./pass/passManualRouter'));// PASS Manual (로컬/특수 상황용 수동 입력 전용) 
  app.use('/api/auth/pass', require('./pass/tempLoginRouter')); //temp login
  app.use('/api/user/pass-phone', require('./pass/phoneUpdateRouter')); //전화번호 업데이트

  // 공개 약관/정책/공지
  app.use('/api/terms', require('./legal/termsPublicRouter'));   // 공개 약관/정책 조회, 버전 목록 등 (비인증)
  app.use('/api/legal', require('./legal/legalRouter'));         // 공개/동의 엔드포인트 혼재 (경로별 인증 구분)
  app.use('/api/notices', require('./system/noticeRouter'));     // 공개 공지사항

  // ----------------------------------------------------------
  // Admin (특정 경로를 일반 경로보다 먼저 마운트)
  // ----------------------------------------------------------
  app.use('/api/admin', require('./admin/termsRouter'));         // 관리자 전용 – 약관
  app.use('/api/admin', require('./admin/adminRouter'));         // 관리자 전용 – 시스템/유저/채팅/공지/통계/환경
  app.use('/api/admin', require('./admin/migrationRouter'));     // 관리자 전용 – migration

  // ----------------------------------------------------------
  // User / Auth / Profile 등 일반 /api 라우터 (인증 요구 가능)
  // ----------------------------------------------------------
  app.use('/api', require('./user/authRouter'));                 // 로그인/로그아웃/토큰 발급 등 인증 전담
  app.use('/api', require('./user/profileImageRouter'));         // 프로필 이미지 업로드·리사이즈·목록·대표 지정·삭제
  app.use('/api', require('./user/userRouter'));                 // 내 정보 수정(닉네임/지역/자기소개/특징)
  app.use('/api', require('./user/gradeRouter'));                // 유저 등급 수동 작업 라우터 (임시)

  // ----------------------------------------------------------
  // Chat / Social
  // ----------------------------------------------------------
  app.use('/api', require('./chat/chatRouter'));                 // 채팅방/메시지
  app.use('/api', require('./chat/friendRouter'));               // 친구 신청/수락/거절/차단/해제 및 목록

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------
  app.use('/api', require('./search/targetRouter'));             // 검색 조건 업데이트 + 다중 지역 기반 사용자 검색
  app.use('/api', require('./search/emergencyRouter'));          // 긴급모드 on/off, 잔여시간 계산 등

  // ----------------------------------------------------------
  // System
  // ----------------------------------------------------------
  app.use('/api/push', require('./system/pushRouter'));          // 푸시 디바이스 토큰 등록/해제
  app.use('/api/account', require('./system/accountDeletionRouter')); // 회원 탈퇴

  // ----------------------------------------------------------
  // Membership
  // ----------------------------------------------------------
  app.use('/api/membership', require('./membership/membershipRouter')); // 멤버십 라우터

  // ----------------------------------------------------------
  // Payment
  // ----------------------------------------------------------
  app.use('/api', require('./payment/paymentRouter'));           // 구매 라우터
};
