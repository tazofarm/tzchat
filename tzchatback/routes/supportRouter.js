// backend/routes/supportRouter.js
// -------------------------------------------------------------
// 🧩 공개 "지원" API 라우터 (로그인 불필요, /api prefix 하위에서 사용)
// - POST /api/public-delete-request : 계정 삭제 요청 접수
//   • 입력 유효성 최소 검증 (username 필수, 길이 제한 등)
//   • 간단한 레이트 리밋(메모리 저장형)으로 과도한 요청 차단
//   • 요청 메타(원 IP, UA)와 함께 DB 저장 (DeletionRequest)
//   • 운영 로그(REQ/RES/ERR) 상세화로 추적성 강화
// - 주의: 여기서는 "정적 문서 제공"을 하지 않습니다.
//   → 정적 문서는 routes/publicRouter.js 가 담당합니다.
// -------------------------------------------------------------
const express = require('express');
const router = express.Router();
const DeletionRequest = require('../models/DeletionRequest');

// -------------------------------------------------------------
// 🔒 간단 레이트리밋(메모리 기반)
// - IP별로 RATE_WINDOW_MS 내 1회만 허용
// - 목적: 부하/스팸 방지 (정교한 솔루션은 Redis 등으로 대체 가능)
// -------------------------------------------------------------
const RATE_WINDOW_MS = 30 * 1000; // 30초
const lastHitMap = new Map();     // key: ip, value: timestamp(ms)

// -------------------------------------------------------------
// 🧹 로그용 민감정보 마스킹 & 입력 길이 제한 유틸
// - 운영 로그에서 이메일 전체 노출을 피함
// - 과대 입력으로 인한 부하/로그 오염 방지
// -------------------------------------------------------------
function maskEmail(email = '') {
  if (!email) return '';
  const [id = '', domain = ''] = String(email).split('@');
  if (!domain) return email.slice(0, 3) + '***';
  return (id.length <= 2 ? id[0] || '' : id.slice(0, 2)) + '***@' + domain;
}
function clamp(str = '', max = 500) {
  const s = String(str);
  return s.length > max ? s.slice(0, max) : s;
}

// -------------------------------------------------------------
// 🚪 POST /api/public-delete-request
// - 공개 폼 제출을 직접 받는 API (인증 불필요)
// - publicRouter의 POST /legal/public-delete-request 가 307으로 여기로 위임
// -------------------------------------------------------------
router.post('/public-delete-request', async (req, res) => {
  const started = Date.now();
  const ua = req.headers['user-agent'] || '';
  const path = '/api/public-delete-request';

  // 원 IP 추출 (리버스 프록시(Nginx) 환경 고려)
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '';

  // [API][REQ] 요청 로그 (개요만)
  console.log('[API][REQ]', {
    path,
    method: 'POST',
    ip,
    ua: ua.slice(0, 120),
    bodyKeys: Object.keys(req.body || {})
  });

  try {
    // -----------------------------
    // 1) 레이트 리밋 체크
    // -----------------------------
    const now = Date.now();
    const last = lastHitMap.get(ip) || 0;
    if (now - last < RATE_WINDOW_MS) {
      console.warn('[HTTP][ERR]', { path, code: 429, ip, remainMs: RATE_WINDOW_MS - (now - last) });
      const body = { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' };
      console.log('[API][RES]', { path, status: 429, ms: Date.now() - started, size: JSON.stringify(body).length });
      return res.status(429).json(body);
    }
    lastHitMap.set(ip, now);

    // -----------------------------
    // 2) 입력 파싱 & 기본 유효성 검사
    // -----------------------------
    const { username, email = '', note = '' } = req.body || {};
    if (!username || typeof username !== 'string') {
      console.log('[HTTP][ERR]', { path, code: 400, reason: 'invalid username', bodySample: (req.body ? JSON.stringify(req.body).slice(0, 200) : null) });
      const body = { error: '아이디는 필수입니다.' };
      console.log('[API][RES]', { path, status: 400, ms: Date.now() - started, size: JSON.stringify(body).length });
      return res.status(400).json(body);
    }

    // 과대 입력 방지: 길이 제한 + 트리밍
    const usernameSafe = clamp(String(username).trim(), 64);
    const emailSafe    = clamp(String(email).trim(), 128);
    const noteSafe     = clamp(String(note).trim(), 1000);

    // -----------------------------
    // 3) DB 저장
    // -----------------------------
    const doc = await DeletionRequest.create({
      username: usernameSafe,
      email: emailSafe,
      note: noteSafe,
      ip,
      ua
    });

    // 운영(보안) 로그: 이메일은 마스킹 처리
    console.log('[API][INFO]', {
      event: 'PublicDelete.received',
      id: doc._id.toString(),
      username: usernameSafe,
      email: maskEmail(emailSafe),
      ip
    });

    // TODO(운영): 이메일/슬랙 알림, 승인 플로우, 자동화 등 연결 가능
    const body = { message: '삭제 요청이 접수되었습니다. 확인 후 처리 예정입니다.' };
    console.log('[API][RES]', { path, status: 200, ms: Date.now() - started, size: JSON.stringify(body).length });
    return res.json(body);

  } catch (err) {
    // -----------------------------
    // 4) 에러 처리
    // -----------------------------
    console.error('[HTTP][ERR]', {
      path,
      code: 500,
      name: err?.name,
      message: err?.message,
      stack: (err?.stack || '').split('\n')[0] // 첫 줄만
    });
    const body = { error: '요청 처리 중 오류가 발생했습니다.' };
    console.log('[API][RES]', { path, status: 500, ms: Date.now() - started, size: JSON.stringify(body).length });
    return res.status(500).json(body);
  }
});

module.exports = router;
