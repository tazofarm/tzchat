// backend/routes/supportRouter.js
// ---------------------------------------------
// 공개 지원 라우터(로그인 불필요)
// - POST /api/public-delete-request : 계정 삭제 요청 접수
//   * 최소 유효성 검사 + 간단한 레이트 리밋(메모리)
//   * 저장 후 운영자 처리(수동/자동)에 넘김
//   * 운영분석 로그 강화(요청/응답/에러/레이트리밋)
// ---------------------------------------------
const express = require('express');
const router = express.Router();
const DeletionRequest = require('../models/DeletionRequest');

// 간단 레이트리밋(메모리) - IP당 n초에 1회
const RATE_WINDOW_MS = 30 * 1000;
const lastHitMap = new Map();

// 🔐 민감정보 마스킹 유틸 (로그 전용)
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

router.post('/public-delete-request', async (req, res) => {
  const started = Date.now();
  const ua = req.headers['user-agent'] || '';
  const path = '/api/public-delete-request';

  // 원 IP 추출(프록시 고려)
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '';

  // [API][REQ] 로그
  console.log('[API][REQ]', {
    path,
    method: 'POST',
    ip,
    ua: ua.slice(0, 120),
    bodyKeys: Object.keys(req.body || {})
  });

  try {
    // 레이트리밋 확인
    const now = Date.now();
    const last = lastHitMap.get(ip) || 0;
    if (now - last < RATE_WINDOW_MS) {
      console.warn('[HTTP][ERR]', { path, code: 429, ip, remainMs: RATE_WINDOW_MS - (now - last) });
      const body = { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' };
      console.log('[API][RES]', { path, status: 429, ms: Date.now() - started, size: JSON.stringify(body).length });
      return res.status(429).json(body);
    }
    lastHitMap.set(ip, now);

    // 입력값 파싱 + 기본 유효성
    const { username, email = '', note = '' } = req.body || {};
    if (!username || typeof username !== 'string') {
      console.log('[HTTP][ERR]', { path, code: 400, reason: 'invalid username', bodySample: (req.body ? JSON.stringify(req.body).slice(0, 200) : null) });
      const body = { error: '아이디는 필수입니다.' };
      console.log('[API][RES]', { path, status: 400, ms: Date.now() - started, size: JSON.stringify(body).length });
      return res.status(400).json(body);
    }

    // 길이 제한/트리밍(비정상 과대입력 방지)
    const usernameSafe = clamp(String(username).trim(), 64);
    const emailSafe = clamp(String(email).trim(), 128);
    const noteSafe = clamp(String(note).trim(), 1000);

    // DB 저장
    const doc = await DeletionRequest.create({
      username: usernameSafe,
      email: emailSafe,
      note: noteSafe,
      ip,
      ua
    });

    // 운영 로그(민감정보 마스킹)
    console.log('[API][INFO]', {
      event: 'PublicDelete.received',
      id: doc._id.toString(),
      username: usernameSafe,
      email: maskEmail(emailSafe),
      ip
    });

    // TODO(운영 선택): 이메일/슬랙 알림, 1회용 코드 발송 등 후속 처리
    const body = { message: '삭제 요청이 접수되었습니다. 확인 후 처리 예정입니다.' };
    console.log('[API][RES]', { path, status: 200, ms: Date.now() - started, size: JSON.stringify(body).length });
    return res.json(body);
  } catch (err) {
    // 에러 로그(민감정보 주의)
    console.error('[HTTP][ERR]', {
      path,
      code: 500,
      name: err?.name,
      message: err?.message,
      stack: (err?.stack || '').split('\n')[0]
    });
    const body = { error: '요청 처리 중 오류가 발생했습니다.' };
    console.log('[API][RES]', { path, status: 500, ms: Date.now() - started, size: JSON.stringify(body).length });
    return res.status(500).json(body);
  }
});

module.exports = router;
