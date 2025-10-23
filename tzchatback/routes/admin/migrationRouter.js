/**
 * 관리자 전용 마이그레이션 라우터
 * ------------------------------------------------------------
 * 베타 종료 시점에 '베타회원' → '일반회원' 일괄 전환
 *
 * 마운트 예시:
 *   app.use('/api/admin', require('./admin/migrationRouter'));
 *
 * 엔드포인트:
 *   - GET  /api/admin/migration/beta-to-basic/preview
 *       → 대상 건수만 조회 (dry-run)
 *   - POST /api/admin/migration/beta-to-basic
 *       body: { dryRun?: boolean }
 *       → 실제 업데이트 또는 dry-run
 *
 * 주의:
 *   - 관리자만 접근 가능(아래 간단 가드 사용)
 *   - 실행 전 반드시 백업 권장
 */

const express = require('express');
const router = express.Router();
const { User } = require('@/models');

const BETA = '베타회원';
const BASIC = '일반회원';

// ───────────────────────────────────────────────
// 간단 인증/권한 가드 (프로젝트 상황에 맞게 교체 가능)
// ───────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
}
function requireMaster(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'master') return next();
  return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
}

// 날짜 문자열(Asia/Seoul 표기용 단순 헬퍼)
function nowKstISO() {
  const now = new Date();
  const tzOffset = 9 * 60; // +09:00
  const kst = new Date(now.getTime() + (tzOffset - now.getTimezoneOffset()) * 60000);
  // YYYY-MM-DDTHH:mm:ss+09:00 형태
  const pad = (n) => String(n).padStart(2, '0');
  const y = kst.getFullYear();
  const m = pad(kst.getMonth() + 1);
  const d = pad(kst.getDate());
  const hh = pad(kst.getHours());
  const mm = pad(kst.getMinutes());
  const ss = pad(kst.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
}

// ───────────────────────────────────────────────
// PREVIEW: 대상 건수 확인 (dry-run)
// GET /api/admin/migration/beta-to-basic/preview
// ───────────────────────────────────────────────
router.get('/migration/beta-to-basic/preview', requireAuth, requireMaster, async (req, res) => {
  try {
    const match = { user_level: BETA };
    const total = await User.countDocuments(match);
    return res.json({
      ok: true,
      ts: nowKstISO(),
      targetLevelFrom: BETA,
      targetLevelTo: BASIC,
      total,
      dryRun: true,
    });
  } catch (err) {
    console.error('[admin:migration:preview] error:', err);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// ───────────────────────────────────────────────
// EXECUTE: 실제 업데이트 or dry-run
// POST /api/admin/migration/beta-to-basic
// body: { dryRun?: boolean }
// ───────────────────────────────────────────────
router.post('/migration/beta-to-basic', requireAuth, requireMaster, async (req, res) => {
  try {
    const dryRun = !!req.body?.dryRun;
    const match = { user_level: BETA };

    // 사전 집계
    const total = await User.countDocuments(match);
    if (total === 0) {
      return res.json({
        ok: true,
        ts: nowKstISO(),
        targetLevelFrom: BETA,
        targetLevelTo: BASIC,
        total,
        matched: 0,
        modified: 0,
        dryRun,
        note: '변경 대상이 없습니다.',
      });
    }

    if (dryRun) {
      return res.json({
        ok: true,
        ts: nowKstISO(),
        targetLevelFrom: BETA,
        targetLevelTo: BASIC,
        total,
        matched: total,
        modified: 0,
        dryRun: true,
        note: 'dry-run이므로 DB 업데이트는 수행하지 않았습니다.',
      });
    }

    // 실제 업데이트
    const now = new Date();
    const result = await User.updateMany(match, {
      $set: { user_level: BASIC, updatedAt: now },
    });

    const matched = result.matchedCount ?? result.nMatched ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    return res.json({
      ok: true,
      ts: nowKstISO(),
      targetLevelFrom: BETA,
      targetLevelTo: BASIC,
      total,
      matched,
      modified,
      dryRun: false,
      note: '베타 → 일반 회원 일괄 전환 완료',
    });
  } catch (err) {
    console.error('[admin:migration:execute] error:', err);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// 헬스체크(옵션)
router.get('/migration/health', requireAuth, requireMaster, (req, res) => {
  return res.json({ ok: true, service: 'admin-migration', ts: nowKstISO() });
});

module.exports = router;
