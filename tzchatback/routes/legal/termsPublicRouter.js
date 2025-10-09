// routes/legal/termsPublicRouter.js
// base: /api/terms
const express = require('express');
const router = express.Router();

const { Terms, UserAgreement } = require('@/models');

// ✅ 하이브리드 로그인 미들웨어
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

// 공통: 실제 라우트 경로 로깅
function logPath(req) {
  return `${req.baseUrl || ''}${req.path || ''}`;
}

// ------------------------------
// 신규 표준 엔드포인트 (프론트 사용)
// ------------------------------

/**
 * GET /api/terms/active
 * 활성 문서 전체(페이지 + 동의서)
 */
router.get('/active', async (req, res) => {
  try {
    const rows = await Terms.find({ isActive: true })
      .select('slug title version kind isRequired defaultRequired publishedAt effectiveAt')
      .lean();

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(`[TERMS][GET]${logPath(req)} error:`, err);
    return res.status(500).json({ ok: false, message: '활성 문서 조회 실패' });
  }
});

/**
 * GET /api/terms/:slug/active
 * 특정 슬러그의 활성 문서(본문 포함)
 */
router.get('/:slug/active', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, message: 'slug is required' });

    const doc = await Terms.findOne({ slug, isActive: true })
      .select('slug title version kind isRequired defaultRequired publishedAt effectiveAt body content')
      .lean();

    if (!doc) return res.status(404).json({ ok: false, message: '활성 문서를 찾을 수 없습니다.' });

    // body/content 호환: 프론트는 body만 사용
    const { content, ...rest } = doc;
    const body = doc.body || content || '';

    return res.json({ ok: true, data: { ...rest, body } });
  } catch (err) {
    console.error(`[TERMS][GET]${logPath(req)} error:`, err);
    return res.status(500).json({ ok: false, message: '문서 조회 실패' });
  }
});

/**
 * GET /api/terms/:slug/versions
 * 특정 슬러그의 모든 버전 (문자열 버전 'YYYY-MM-DD-SEQ' → 사전식 내림차순 OK)
 */
router.get('/:slug/versions', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, message: 'slug is required' });

    const rows = await Terms.find({ slug })
      .select('slug title version kind isRequired defaultRequired publishedAt effectiveAt body content')
      .sort({ version: -1 })
      .lean();

    const mapped = rows.map(r => {
      const { content, ...rest } = r;
      return { ...rest, body: r.body || content || '' };
    });

    return res.json({ ok: true, data: mapped });
  } catch (err) {
    console.error(`[TERMS][GET]${logPath(req)} error:`, err);
    return res.status(500).json({ ok: false, message: '버전 목록 조회 실패' });
  }
});

/**
 * POST /api/terms/consents
 * 단일 동의 저장/갱신 (로그인 필요)
 * body: { slug: string, version: string, optedIn?: boolean }
 * - 활성 문서 존재 및 버전 일치 확인
 * - UserAgreement upsert
 */
router.post('/consents', requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const { slug, version, optedIn } = req.body || {};
    if (!slug || !version || typeof slug !== 'string' || typeof version !== 'string') {
      return res.status(400).json({ ok: false, message: 'slug/version은 문자열이어야 합니다.' });
    }

    const doc = await Terms.findOne({ slug, isActive: true })
      .select('_id slug title version kind isRequired defaultRequired')
      .lean();
    if (!doc) return res.status(404).json({ ok: false, message: '활성 문서를 찾을 수 없습니다.' });
    if (String(doc.version) !== String(version)) {
      return res.status(400).json({ ok: false, message: '요청 버전이 활성 버전과 일치하지 않습니다.' });
    }

    const now = new Date();
    await UserAgreement.updateOne(
      { userId, slug }, // slug 기준 1개 행 유지
      {
        $set: {
          version: String(version),
          agreedAt: now,
          optedIn: typeof optedIn === 'boolean' ? optedIn : true,
          docId: doc._id,
          meta: {
            title: doc.title,
            kind: doc.kind,
            isRequired: !!doc.isRequired,
            defaultRequired: !!doc.defaultRequired,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
          },
        },
      },
      { upsert: true }
    );

    return res.json({ ok: true, message: '동의가 저장되었습니다.' });
  } catch (err) {
    console.error(`[TERMS][POST]${logPath(req)} error:`, err);
    return res.status(500).json({ ok: false, message: '동의 저장 실패' });
  }
});

// ===== 공통 빌더 =====
async function fetchActiveConsentWithUser(userId) {
  const activeConsents = await Terms.find({ kind: 'consent', isActive: true })
    .select('_id slug title version isRequired defaultRequired')
    .lean();

  const slugs = activeConsents.map(d => d.slug);
  const userAgreements = await UserAgreement.find({ userId, slug: { $in: slugs } })
    .select('slug version optedIn')
    .lean();

  const items = activeConsents.map(doc => {
    const ua = userAgreements.find((r) => r.slug === doc.slug);
    const sameVersion = ua ? String(ua.version) === String(doc.version) : false;

    // ✅ 필수 여부는 isRequired가 없으면 defaultRequired로 대체
    const isReq = !!(doc.isRequired ?? doc.defaultRequired);
    const accepted = ua?.optedIn === true;

    // ✅ 수정: 필수인데 optedIn !== true 인 경우도 pending 으로 판단
    const pending = !sameVersion || (isReq && !accepted);

    return {
      slug: doc.slug,
      title: doc.title,
      version: doc.version,
      isRequired: isReq,
      defaultRequired: !!doc.defaultRequired,
      hasRecord: !!ua,
      sameVersion,
      optedIn: ua?.optedIn ?? null,
      pending,
    };
  });

  return items;
}

/**
 * 모든 활성 동의서 + 사용자 상태
 * GET /api/terms/agreements/list
 */
router.get('/agreements/list', requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const items = await fetchActiveConsentWithUser(userId);
    return res.json({ ok: true, data: { items } });
  } catch (err) {
    console.error(`[TERMS][GET]${logPath(req)} error:`, err);
    return res.status(500).json({ ok: false, message: '상태 조회 실패' });
  }
});

/**
 * 대기 중 항목 + 전체 현황
 * GET /api/terms/agreements/status  (별칭 /status)
 */
router.get(['/agreements/status', '/status'], requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const items = await fetchActiveConsentWithUser(userId);
    const pending = items
      .filter(i => i.pending)
      .map(i => ({ slug: i.slug, title: i.title, version: i.version, isRequired: i.isRequired }));

    return res.json({ ok: true, data: { pending, items } });
  } catch (err) {
    console.error(`[TERMS][GET]${logPath(req)} error:`, err);
    return res.status(500).json({ ok: false, message: '상태 조회 실패' });
  }
});

/**
 * ✅ 배치 저장: 전달한 slugs만 optedIn:true, 나머지는 optedIn:false 로 현재 활성버전 기록
 * POST /api/terms/agreements/accept
 * body: { slugs: string[] }
 */
router.post('/agreements/accept', requireLogin, async (req, res) => {
  const route = logPath(req);
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    // body 파싱 & 유효성 검사
    const body = req.body || {};
    const slugsSelected = Array.isArray(body.slugs) ? body.slugs.map(String) : null;

    console.log(`[TERMS][POST]${route} payload:`, {
      type: typeof body.slugs,
      isArray: Array.isArray(body.slugs),
      count: Array.isArray(body.slugs) ? body.slugs.length : 0,
    });

    if (!slugsSelected) {
      return res.status(400).json({ ok: false, message: 'slugs는 문자열 배열이어야 합니다.' });
    }

    // 활성 동의서 전체 조회
    const activeConsents = await Terms.find({ kind: 'consent', isActive: true })
      .select('_id slug title version isRequired defaultRequired')
      .lean();

    const now = new Date();
    const bulk = activeConsents.map(doc => ({
      updateOne: {
        filter: { userId, slug: doc.slug },
        update: {
          $set: {
            version: String(doc.version),
            agreedAt: now,
            optedIn: slugsSelected.includes(doc.slug),
            docId: doc._id,
            meta: {
              title: doc.title,
              kind: 'consent',
              isRequired: !!(doc.isRequired ?? doc.defaultRequired),
              defaultRequired: !!doc.defaultRequired,
              userAgent: req.get('User-Agent'),
              ip: req.ip,
            },
          },
        },
        upsert: true,
      },
    }));

    if (bulk.length > 0) {
      const result = await UserAgreement.bulkWrite(bulk, { ordered: false });
      console.log(`[TERMS][POST]${route} bulkWrite done:`, {
        nUpserted: result?.upsertedCount ?? 0,
        nModified: result?.modifiedCount ?? 0,
        nMatched: result?.matchedCount ?? 0,
      });
    } else {
      console.log(`[TERMS][POST]${route} no active consent docs`);
    }

    return res.json({ ok: true, message: '동의가 처리되었습니다.' });
  } catch (err) {
    console.error(`[TERMS][POST]${route} error:`, err);
    return res.status(500).json({ ok: false, message: '동의 처리 실패' });
  }
});

// -----------------------------------------
// 기존 호환 엔드포인트 (기존 프론트/앱 대비)
// -----------------------------------------

/**
 * GET /api/terms/latest
 */
router.get('/latest', async (req, res) => {
  try {
    const { slug } = req.query || {};
    if (!slug) {
      return res.status(400).json({ ok: false, message: 'slug is required' });
    }
    const doc = await Terms.findOne({ slug, isActive: true })
      .sort({ version: -1 })
      .lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'document not found' });

    const { content, ...rest } = doc;
    const body = doc.body || content || '';

    return res.json({ ok: true, data: { ...rest, body } });
  } catch (err) {
    console.error(`[TERMS][GET]${logPath(req)} error:`, err);
    res.status(500).json({ ok: false, message: 'internal server error' });
  }
});

/**
 * POST /api/terms/agree
 * body: { slug, version }
 * ※ 활성버전 일치 검증 + 메타 저장
 */
router.post('/agree', requireLogin, async (req, res) => {
  try {
    const { slug, version } = req.body || {};
    const userId = getUserIdFromReq(req);

    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });
    if (!slug || !version) return res.status(400).json({ ok: false, message: 'slug and version are required' });

    const latest = await Terms.findOne({ slug, isActive: true }).sort({ version: -1 }).lean();
    if (!latest) return res.status(404).json({ ok: false, message: 'document not found' });

    if (String(latest.version) !== String(version)) {
      return res.status(400).json({ ok: false, message: 'version mismatch with active document' });
    }

    const now = new Date();
    await UserAgreement.updateOne(
      { userId, slug },
      {
        $set: {
          version: String(version),
          agreedAt: now,
          optedIn: true,
          docId: latest._id,
          meta: {
            title: latest.title,
            kind: latest.kind,
            isRequired: !!latest.isRequired,
            defaultRequired: !!latest.defaultRequired,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
          },
        },
      },
      { upsert: true }
    );

    res.json({ ok: true, message: '동의가 저장되었습니다.' });
  } catch (err) {
    console.error(`[TERMS][POST]${logPath(req)} error:`, err);
    res.status(500).json({ ok: false, message: 'internal server error' });
  }
});

/**
 * GET /api/terms/require-consent
 * - 활성화된 필수(defaultRequired=true) 동의 문서 기준
 * - 현재 사용자 동의 버전과 비교하여 재동의 필요 여부 반환
 */
router.get('/require-consent', requireLogin, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, message: 'unauthorized' });

    const requiredDocs = await Terms.find({ kind: 'consent', defaultRequired: true, isActive: true })
      .select('slug title version')
      .lean();
    const userAgreements = await UserAgreement.find({ userId })
      .select('slug version optedIn')
      .lean();

    const needSlugs = [];
    for (const doc of requiredDocs) {
      const ua = userAgreements.find(
        (x) => x.slug === doc.slug && String(x.version) === String(doc.version)
      );
      // ✅ 필수는 미동의(optedIn !== true)도 재동의 필요
      if (!ua || ua.optedIn !== true) needSlugs.push(doc.slug);
    }

    res.json({
      ok: true,
      needReconsent: needSlugs.length > 0,
      requiredSlugs: needSlugs,
    });
  } catch (err) {
    console.error(`[TERMS][GET]${logPath(req)} error:`, err);
    res.status(500).json({ ok: false, message: 'internal server error' });
  }
});

module.exports = router;
