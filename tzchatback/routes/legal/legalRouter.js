// routes/legal/legalRouter.js
// base: /api/legal
const express = require('express');
const router = express.Router();

const { Terms, UserAgreement } = require('@/models');
const requireLogin = require('@/middlewares/requireLogin');

// 공통: 다양한 위치에서 userId 추출 (세션/JWT 하이브리드 호환)
function getUserIdFromReq(req) {
  return (
    (req._uid && String(req._uid)) ||
    (req.auth?.userId && String(req.auth.userId)) ||
    (req.user?._id && String(req.user._id)) ||
    (req.session?.user?._id && String(req.session.user._id)) ||
    (req.get('x-user-id') && String(req.get('x-user-id'))) || // dev 보조
    ''
  );
}

// 공통: 실제 마운트 경로 로깅용
function logPath(req) {
  return `${req.baseUrl || ''}${req.path || ''}`;
}

/**
 * GET /api/legal/consents/required
 * 활성 필수/선택 동의 항목 목록
 * 응답: { ok, items: [{slug,title,version,kind,required}] }
 */
router.get('/consents/required', async (_req, res) => {
  try {
    const active = await Terms.find({ isActive: true, kind: 'consent' })
      .select('slug title version kind defaultRequired')
      .sort({ slug: 1 })
      .lean();

    const items = active.map(t => ({
      slug: t.slug,
      title: t.title,
      version: String(t.version),
      kind: t.kind,                 // 'consent'
      required: !!t.defaultRequired // 필수 여부
    }));

    res.json({ ok: true, items });
  } catch (e) {
    console.error(`[LEGAL][GET]${logPath(_req)} error:`, e);
    res.status(500).json({ ok: false, message: '동의 항목 조회 실패' });
  }
});

/**
 * POST /api/legal/consents/agree
 * 동의 저장(필수/선택 공통)
 * body: { slug, version, optedIn? }
 * - version 문자열이며 활성본과 일치해야 함
 * - optedIn: 선택 동의에서 true/false 저장
 */
router.post('/consents/agree', requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const { slug, version, optedIn } = req.body || {};
    if (!slug || !version || typeof version !== 'string') {
      return res.status(400).json({ ok: false, message: 'slug/version(문자열) 필요' });
    }

    // 활성본 검증
    const active = await Terms.findOne({ slug, isActive: true }).lean();
    if (!active) return res.status(400).json({ ok: false, message: '활성 문서를 찾을 수 없습니다.' });
    if (String(active.version) !== String(version)) {
      return res.status(400).json({ ok: false, message: '활성 버전과 불일치합니다.' });
    }

    // upsert 저장
    const now = new Date();
    const upserted = await UserAgreement.findOneAndUpdate(
      { userId, slug },
      {
        $set: {
          version: String(version),
          agreedAt: now,
          ...(typeof optedIn === 'boolean' ? { optedIn } : {}),
          docId: active._id,
          meta: {
            title: active.title,
            kind: active.kind,
            defaultRequired: !!active.defaultRequired,
            effectiveAt: active.effectiveAt || active.publishedAt,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
          },
        },
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, data: upserted });
  } catch (e) {
    console.error(`[LEGAL][POST]${logPath(req)} error:`, e);
    res.status(500).json({ ok: false, message: '동의 저장 실패' });
  }
});

/**
 * GET /api/legal/agreements/me
 * 내 동의 현황 조회
 */
router.get('/agreements/me', requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const rows = await UserAgreement.find({ userId }).lean();
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(`[LEGAL][GET]${logPath(req)} error:`, e);
    res.status(500).json({ ok: false, message: '동의 현황 조회 실패' });
  }
});

/**
 * POST /api/legal/agreements/me/consent
 * (하위호환) 동의하기
 * body: { slug, version, optedIn? }
 */
router.post('/agreements/me/consent', requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const { slug, version, optedIn } = req.body || {};
    if (!slug || !version || typeof version !== 'string') {
      return res.status(400).json({ ok: false, message: 'slug/version(문자열) 필요' });
    }

    const active = await Terms.findOne({ slug, isActive: true }).lean();
    if (!active || String(active.version) !== String(version)) {
      return res.status(400).json({ ok: false, message: '활성 버전과 불일치' });
    }

    const upserted = await UserAgreement.findOneAndUpdate(
      { userId, slug },
      {
        $set: {
          version: String(version),
          agreedAt: new Date(),
          ...(typeof optedIn === 'boolean' ? { optedIn } : {}),
          docId: active._id,
          meta: {
            title: active.title,
            kind: active.kind,
            defaultRequired: !!active.defaultRequired,
            effectiveAt: active.effectiveAt || active.publishedAt,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
          },
        },
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, data: upserted });
  } catch (e) {
    console.error(`[LEGAL][POST]${logPath(req)} error:`, e);
    res.status(500).json({ ok: false, message: '동의 저장 실패' });
  }
});

/**
 * GET /api/legal/agreements/me/status
 * - 필수 동의 재동의 필요 목록(pending)
 * - 선택 동의 현재 상태(optional)
 */
router.get('/agreements/me/status', requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const [active, my] = await Promise.all([
      Terms.find({ isActive: true }).lean(),
      UserAgreement.find({ userId }).lean(),
    ]);

    const myMap = new Map(my.map(r => [r.slug, String(r.version)]));
    const pending = active
      .filter(t => t.kind === 'consent' && !!t.defaultRequired && myMap.get(t.slug) !== String(t.version))
      .map(t => ({ slug: t.slug, title: t.title, version: String(t.version) }));

    const optional = active
      .filter(t => t.kind === 'consent' && !t.defaultRequired)
      .map(t => {
        const mine = my.find(r => r.slug === t.slug) || {};
        return {
          slug: t.slug,
          title: t.title,
          version: String(t.version),
          optedIn: typeof mine.optedIn === 'boolean' ? mine.optedIn : false,
          agreedVersion: mine.version ? String(mine.version) : null,
        };
      });

    res.json({ ok: true, data: { pending, optional } });
  } catch (e) {
    console.error(`[LEGAL][GET]${logPath(req)} error:`, e);
    res.status(500).json({ ok: false, message: '동의 상태 조회 실패' });
  }
});

module.exports = router;
