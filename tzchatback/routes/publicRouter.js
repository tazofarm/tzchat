// routes/publicRouter.js
// -------------------------------------------------------------
// 📌 비로그인 전용 공개 라우터 (정적 법/정책 문서 + 레거시 호환 + 공개 폼 위임)
// -------------------------------------------------------------
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// -------------------------------------------------------------
// 경로 상수: 기본은 <프로젝트루트>/public/legal
// - 프로젝트 구조가 다를 수 있어 CWD 대체 경로도 준비
// -------------------------------------------------------------
const ROUTES_DIR = __dirname;                // .../routes
const ROOT_DIR_BY_UP = path.resolve(ROUTES_DIR, '..'); // 보통 프로젝트 루트
const ROOT_DIR_BY_CWD = process.cwd();       // pm2/노드 실행 위치

const PUBLIC_DIR_UP  = path.join(ROOT_DIR_BY_UP, 'public');
const LEGAL_DIR_UP   = path.join(PUBLIC_DIR_UP, 'legal');

const PUBLIC_DIR_CWD = path.join(ROOT_DIR_BY_CWD, 'public');
const LEGAL_DIR_CWD  = path.join(PUBLIC_DIR_CWD, 'legal');

// 우선순위: 상위 폴더 기준 → CWD 기준
const PUBLIC_DIR = fs.existsSync(PUBLIC_DIR_UP) ? PUBLIC_DIR_UP : PUBLIC_DIR_CWD;
const LEGAL_DIR  = fs.existsSync(LEGAL_DIR_UP)  ? LEGAL_DIR_UP  : LEGAL_DIR_CWD;

console.log('[publicRouter] PUBLIC_DIR =', PUBLIC_DIR);
console.log('[publicRouter] LEGAL_DIR  =', LEGAL_DIR);

// -------------------------------------------------------------
// 공통 헤더
// -------------------------------------------------------------
function setCommonHeaders(res, { cacheSeconds = 3600 } = {}) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}`);
}

// -------------------------------------------------------------
// 안전한 정적 문서 전송 헬퍼
// -------------------------------------------------------------
function sendLegalHtml(res, filename, opts = {}) {
  setCommonHeaders(res, opts);

  // 1순위: LEGAL_DIR/filename
  let filePath = path.join(LEGAL_DIR, filename);

  // 파일이 없고, 요청이 index 류라면 00_index.html ↔ index.html 상호 대체
  if (!fs.existsSync(filePath)) {
    if (filename === '00_index.html' && fs.existsSync(path.join(LEGAL_DIR, 'index.html'))) {
      filePath = path.join(LEGAL_DIR, 'index.html');
    } else if (filename === 'index.html' && fs.existsSync(path.join(LEGAL_DIR, '00_index.html'))) {
      filePath = path.join(LEGAL_DIR, '00_index.html');
    }
  }

  if (!fs.existsSync(filePath)) {
    console.error('[publicRouter] 404 File Not Found:', filePath);
    if (!res.headersSent) res.status(404).send('Not Found');
    return;
  }

  return res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      console.error('[publicRouter] sendFile error:', err);
      res.status(err.statusCode || 404).end();
    }
  });
}

// -------------------------------------------------------------
// /legal 랜딩 (문서 목록)
// - 기본은 00_index.html, 없으면 index.html을 자동 대체
// -------------------------------------------------------------
router.get('/legal', (_req, res) => {
  // 우선 00_index.html 시도
  const prefer = fs.existsSync(path.join(LEGAL_DIR, '00_index.html')) ? '00_index.html' : 'index.html';
  return sendLegalHtml(res, prefer);
});

// -------------------------------------------------------------
// 모든 문서: 명시 라우트로 1:1 연결
// -------------------------------------------------------------
// -------------------------------------------------------------
// 모든 문서: 명시 라우트로 1:1 연결 (URL → 파일명 → 문서 목적)
// -------------------------------------------------------------

// 개인정보 처리방침
router.get('/legal/privacy',        (_req, res) => sendLegalHtml(res, '01_privacy.html'));        
// /legal/privacy → 01_privacy.html  : 서비스가 어떤 개인정보를 왜/어떻게 처리하는지, 보관·파기·권리 행사 절차

// 서비스 이용약관
router.get('/legal/terms',          (_req, res) => sendLegalHtml(res, '02_terms.html'));          
// /legal/terms → 02_terms.html      : 서비스 이용 규칙, 금지행위, 면책, 분쟁 해결 등 계약 조건

// 위치정보 이용약관
router.get('/legal/location',       (_req, res) => sendLegalHtml(res, '03_location.html'));       
// /legal/location → 03_location.html : 위치기반서비스(LBS) 동의/철회, 보관·제공 원칙, 권리·문의

// 계정 삭제 안내 & 공개 삭제요청 폼 랜딩
router.get('/legal/delete-account', (_req, res) => sendLegalHtml(res, '04_delete-account.html')); 
// /legal/delete-account → 04_delete-account.html : 탈퇴 시 유의사항 + POST /legal/public-delete-request 폼

// 청소년 보호정책
router.get('/legal/youth',             (_req, res) => sendLegalHtml(res, '05_youth.html'));      
 // /legal/youth → 05_youth.html       : 유해정보 차단, 신고/차단 체계, 법정대리인 대응 등 보호조치

// 최종 사용자 라이선스(EULA)
router.get('/legal/eula',              (_req, res) => sendLegalHtml(res, '06_eula.html'));        
// /legal/eula → 06_eula.html         : 앱 소프트웨어 사용권(라이선스) 조건, 금지사항, 해지

// 쿠키 정책
router.get('/legal/cookies',           (_req, res) => sendLegalHtml(res, '07_cookies.html'));     
// /legal/cookies → 07_cookies.html   : 쿠키의 목적(세션/보안/품질향상), 관리(거부/삭제) 방법

// 데이터 보관 및 파기 정책
router.get('/legal/data-retention',    (_req, res) => sendLegalHtml(res, '08_data-retention.html'));
// /legal/data-retention → 08_data-retention.html : 항목별 보관기간/근거, 파기 기준·방법

// 광고성 정보 수신 동의(마케팅)
router.get('/legal/marketing-consent', (_req, res) => sendLegalHtml(res, '09_marketing-consent.html')); 
// /legal/marketing-consent → 09_marketing-consent.html : 수신 채널, 동의·철회 방법

// 제3자 제공 현황 공시
router.get('/legal/third-parties',     (_req, res) => sendLegalHtml(res, '10_third-parties.html'));
// /legal/third-parties → 10_third-parties.html : 제공받는 자/목적/항목/기간 공개(없으면 ‘-’)

// 업무 처리위탁(수탁자) 현황 공시
router.get('/legal/processors',        (_req, res) => sendLegalHtml(res, '11_processors.html'));  
// /legal/processors → 11_processors.html : 수탁자, 위탁업무, 항목, 보유기간

// 오픈소스 라이선스 고지
router.get('/legal/opensource',        (_req, res) => sendLegalHtml(res, '12_opensource.html'));  
// /legal/opensource → 12_opensource.html : 사용 OSS 목록/라이선스 고지

// 커뮤니티 가이드라인
router.get('/legal/community',         (_req, res) => sendLegalHtml(res, '13_community.html'));   
// /legal/community → 13_community.html : 금지행위, 안전/프라이버시, 제재 기준

// 신고 및 차단 정책
router.get('/legal/report-block',      (_req, res) => sendLegalHtml(res, '14_report-block.html')); 
// /legal/report-block → 14_report-block.html : 신고 대상/방법, 사용자 차단, 제재 처리

// -------------------------------------------------------------
// 레거시 짧은 주소 → 301 공식 주소
// -------------------------------------------------------------
router.get('/privacy',        (_req, res) => res.redirect(301, '/legal/privacy'));
router.get('/terms',          (_req, res) => res.redirect(301, '/legal/terms'));
router.get('/location',       (_req, res) => res.redirect(301, '/legal/location'));
router.get('/delete-account', (_req, res) => res.redirect(301, '/legal/delete-account'));

// -------------------------------------------------------------
// 공개 삭제요청 폼 POST 위임 → 기존 API 로 그대로 전달(307)
// -------------------------------------------------------------
router.post('/legal/public-delete-request', (req, res) => {
  return res.redirect(307, '/api/public-delete-request');
});

// -------------------------------------------------------------
// 헬스체크
// -------------------------------------------------------------
router.get('/legal/_health', (_req, res) => {
  setCommonHeaders(res, { cacheSeconds: 0 });
  res.json({ ok: true, router: 'public', ts: new Date().toISOString(), LEGAL_DIR });
});

module.exports = router;
