// routes/admin/termsRouter.js
// base: /api/admin
const express = require('express');
const router = express.Router();

const { Terms } = require('@/models');

// ✅ 인증 + 마스터 권한 가드
// 통일: 다른 라우터와 동일하게 requireLogin 사용
const requireLogin = require('@/middlewares/requireLogin');   // JWT/세션에서 req.user 세팅
const requireMaster = require('@/middlewares/requireMaster'); // req.user.role === 'master' 확인

// ---- 공통 가드 전역 적용 ----
// /api/admin 에 마운트되므로 실제 경로는 /api/admin/...
router.use(requireLogin, requireMaster);

// --- helpers ---
function deriveKindFromSlug(slug = '') {
  return String(slug).toLowerCase().endsWith('-consent') ? 'consent' : 'page';
}
function isValidKind(kind) {
  return kind === 'page' || kind === 'consent';
}

/**
 * 새 버전 발행 (MASTER ONLY)
 * - 이전 활성본 비활성화
 * - 신규본 활성화
 * - slug + version 중복 방지
 * - kind, defaultRequired(front) ↔ isRequired(백엔드 호환)
 * - version: 문자열 (예: 2025-09-30-01)
 */
router.post('/terms', async (req, res) => {
  try {
    const {
      slug,
      title,
      version,              // 문자열 버전 (예: "2025-09-30-01")
      content,              // 프론트: content
      body,                 // 과거 호환 (있으면 content로 대체)
      kind: kindInput,      // 'page' | 'consent' (없으면 slug로 유추)
      defaultRequired,      // consent 전용 (boolean)
      effectiveAt,          // (선택) 효력 발생일
    } = req.body || {};

    // ----- 필수값 검증 -----
    const docBody = typeof content === 'string' ? content : body;
    if (!slug || !title || !version || !docBody) {
      return res.status(400).json({ ok: false, message: '필수 필드 누락(slug/title/version/content)' });
    }
    if (typeof version !== 'string') {
      return res.status(400).json({ ok: false, message: 'version은 문자열이어야 합니다. (예: 2025-09-30-01)' });
    }

    // ----- kind 결정 -----
    const kind = kindInput || deriveKindFromSlug(slug);
    if (!isValidKind(kind)) {
      return res.status(400).json({ ok: false, message: "kind는 'page' 또는 'consent'여야 합니다." });
    }

    // ----- consent 전용 기본 required 값 -----
    let isRequired = false;
    if (kind === 'consent') {
      if (typeof defaultRequired === 'boolean') {
        isRequired = !!defaultRequired;
      } else {
        // 규칙: privacy-/sharing-/xborder- 는 기본 필수, 그 외(예: marketing-)는 선택
        isRequired = /^(privacy|sharing|xborder)-consent$/i.test(slug);
      }
    }

    // ----- 중복 버전 방지 -----
    const dup = await Terms.findOne({ slug, version });
    if (dup) {
      return res.status(409).json({ ok: false, message: `이미 존재하는 버전입니다. (slug=${slug}, version=${version})` });
    }

    // ----- 이전 활성본 비활성화 -----
    await Terms.updateMany({ slug, isActive: true }, { $set: { isActive: false } });

    // ----- 신규 버전 발행 -----
    const now = new Date();
    const doc = await Terms.create({
      slug,
      title,
      version,            // 문자열 버전
      body: docBody,      // 모델이 body 필드를 쓰는 경우 대비
      content: docBody,   // 모델이 content 필드를 쓰는 경우 대비
      kind,               // 'page' | 'consent'
      defaultRequired: isRequired, // 프론트 명칭
      isRequired: isRequired,      // 백엔드/기존 명칭 호환
      isActive: true,
      publishedAt: now,
      effectiveAt: effectiveAt ? new Date(effectiveAt) : now,
    });

    return res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    console.error('[ADMIN/TERMS][POST]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * 목록 조회 (MASTER ONLY)
 * - 쿼리: slug, active(true|false), kind(page|consent)
 * - 정렬: slug ASC, version DESC (문자열 버전은 'YYYY-MM-DD-SEQ' 가정 → 사전식 정렬 OK)
 */
router.get('/terms', async (req, res) => {
  try {
    const { slug, active, kind } = req.query || {};
    const q = {};
    if (slug) q.slug = slug;
    if (active === 'true') q.isActive = true;
    if (active === 'false') q.isActive = false;
    if (kind && isValidKind(kind)) q.kind = kind;

    const list = await Terms.find(q).sort({ slug: 1, version: -1 });
    return res.json({ ok: true, data: list });
  } catch (err) {
    console.error('[ADMIN/TERMS][GET]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
