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
const ROUTES_DIR = __dirname;                                // .../routes
const ROOT_DIR_BY_UP = path.resolve(ROUTES_DIR, '..');       // 보통 프로젝트 루트
const ROOT_DIR_BY_CWD = process.cwd();                       // pm2/노드 실행 위치

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
function setCommonHeaders(res, { noStore = true, cacheSeconds = 0 } = {}) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (noStore) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}`);
  }
}

// -------------------------------------------------------------
// ✅ /legal 경로 전체를 정적 서빙 (문서 내부 리소스 대비)
//  - HTML 확장자 생략 허용
//  - 반드시 라우트들보다 먼저 선언
// -------------------------------------------------------------
router.use(
  '/legal',
  express.static(LEGAL_DIR, {
    extensions: ['html'],
    setHeaders(res/*, filePath*/) {
      setCommonHeaders(res, { noStore: true });
    },
  })
);

// -------------------------------------------------------------
// 안전한 정적 문서 전송 헬퍼
// -------------------------------------------------------------
function sendLegalHtml(res, filename, opts = {}) {
  setCommonHeaders(res, { noStore: true, ...opts });

  // 1순위: LEGAL_DIR/filename
  let filePath = path.join(LEGAL_DIR, filename);

  // index/00_index 상호 대체
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
  const prefer = fs.existsSync(path.join(LEGAL_DIR, '00_index.html')) ? '00_index.html' : 'index.html';
  return sendLegalHtml(res, prefer);
});

// -------------------------------------------------------------
// 모든 문서: 명시 라우트로 1:1 연결 (URL → 파일명 → 문서 목적)
// -------------------------------------------------------------

// 개인정보 처리방침
router.get('/legal/privacy',        (_req, res) => sendLegalHtml(res, '01_privacy.html'));

// 서비스 이용약관
router.get('/legal/terms',          (_req, res) => sendLegalHtml(res, '02_terms.html'));

// 위치정보 이용약관
router.get('/legal/location',       (_req, res) => sendLegalHtml(res, '03_location.html'));

// 계정 삭제 안내 & 공개 삭제요청 폼 랜딩
router.get('/legal/delete-account', (_req, res) => sendLegalHtml(res, '04_delete-account.html'));

// 청소년 보호정책
router.get('/legal/youth',          (_req, res) => sendLegalHtml(res, '05_youth.html'));

// 최종 사용자 라이선스(EULA)
router.get('/legal/eula',           (_req, res) => sendLegalHtml(res, '06_eula.html'));

// 쿠키 정책
router.get('/legal/cookies',        (_req, res) => sendLegalHtml(res, '07_cookies.html'));

// 데이터 보관 및 파기 정책
router.get('/legal/data-retention', (_req, res) => sendLegalHtml(res, '08_data-retention.html'));

// 광고성 정보 수신 동의(마케팅)
router.get('/legal/marketing-consent', (_req, res) => sendLegalHtml(res, '09_marketing-consent.html'));

// 제3자 제공 현황 공시
router.get('/legal/third-parties',  (_req, res) => sendLegalHtml(res, '10_third-parties.html'));

// 업무 처리위탁(수탁자) 현황 공시
router.get('/legal/processors',     (_req, res) => sendLegalHtml(res, '11_processors.html'));

// 오픈소스 라이선스 고지
router.get('/legal/opensource',     (_req, res) => sendLegalHtml(res, '12_opensource.html'));

// 커뮤니티 가이드라인
router.get('/legal/community',      (_req, res) => sendLegalHtml(res, '13_community.html'));

// 신고 및 차단 정책
router.get('/legal/report-block',   (_req, res) => sendLegalHtml(res, '14_report-block.html'));

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
  setCommonHeaders(res, { noStore: true });
  res.json({ ok: true, router: 'public', ts: new Date().toISOString(), LEGAL_DIR });
});

module.exports = router;
