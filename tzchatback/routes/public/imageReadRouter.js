// routes/public/imageReadRouter.js
// base: /api
// -------------------------------------------------------------
// 📷 프로필 이미지 조회·대표지정 전용 라우터 (가벼운 read-only 성격)
// - GET  /api/profile/images                 : 내 이미지 목록
// - GET  /api/users/:id/profile/images       : 상대 이미지 목록
// - PUT  /api/profile/main                   : 대표 사진 지정
// - ✅ 응답 시 이미지 URL 절대경로로 정규화(혼합콘텐츠 방지)
// -------------------------------------------------------------

const express = require('express');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const { User } = require('@/models');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

// ===== 공용 로그 헬퍼 =====
const log = (...args) => console.log('[profileImage:read]', ...args);

// ===== 유틸 =====
function stripTrailingSlashes(u) { return (u || '').replace(/\/+$/, ''); }
function firstHeaderVal(h) {
  return (h || '').split(',')[0].trim();
}
function parseForwarded(forwarded) {
  const out = {};
  if (!forwarded) return out;
  const first = firstHeaderVal(forwarded);
  for (const part of first.split(';')) {
    const [k, v] = part.split('=').map(s => (s || '').trim());
    if (!k || !v) continue;
    const val = v.replace(/^"|"$/g, '');
    out[k.toLowerCase()] = val;
  }
  return out;
}

/**
 * 퍼블릭 베이스 URL 계산 (프록시/HTTPS 안전)
 * 우선순위:
 *  1) ENV: PUBLIC_BASE_URL/FILE_BASE_URL/API_BASE_URL
 *  2) RFC7239 Forwarded 헤더(proto/host)
 *  3) X-Forwarded-Proto / X-Forwarded-Host / X-Forwarded-Port
 *  4) req.protocol + req.get('host')
 * 추가 규칙:
 *  - 호스트가 존재하고 프로토콜이 모호하면 https 우선
 *  - tzchat.tazocode.com 도메인은 무조건 https
 */
function getPublicBaseUrl(req) {
  const envBase =
    process.env.PUBLIC_BASE_URL ||
    process.env.FILE_BASE_URL ||
    process.env.API_BASE_URL ||
    '';
  if (envBase) return stripTrailingSlashes(envBase);

  const fwd = parseForwarded(req.headers['forwarded']);
  let proto =
    (fwd.proto) ||
    firstHeaderVal(req.headers['x-forwarded-proto']) ||
    req.protocol ||
    'https';
  let host =
    (fwd.host) ||
    firstHeaderVal(req.headers['x-forwarded-host']) ||
    req.get('host') ||
    '';

  const xfPort = firstHeaderVal(req.headers['x-forwarded-port']);
  if (xfPort && host && !/:\d+$/.test(host)) host = `${host}:${xfPort}`;

  const bareHost = (host || '').replace(/:\d+$/, '');
  if (/^tzchat\.tazocode\.com$/i.test(bareHost)) {
    proto = 'https';
  } else {
    if (!/^https?$/i.test(proto)) proto = 'https';
  }

  if (!host) {
    host = 'tzchat.tazocode.com';
    proto = 'https';
  }
  return `${proto}://${host}`.replace(/\/+$/, '');
}

/**
 * ✅ 응답 절대 URL 정규화
 */
function toAbsoluteUploadUrl(u, req) {
  if (!u) return u;
  const base = getPublicBaseUrl(req);

  // 절대 URL?
  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      if (url.pathname.startsWith('/uploads/')) {
        const absBase = new URL(base);
        url.protocol = absBase.protocol;
        url.host     = absBase.host;
        return url.toString();
      }
      return u;
    } catch {
      // ignore → 아래 상대 처리
    }
  }

  // 상대 경로
  const rel = u.startsWith('/') ? u : `/${u}`;
  return `${base}${rel}`;
}

function getMyId(req) {
  return req?.user?._id || req?.session?.user?._id || null;
}

// ======================================================
// [1] 내 프로필 이미지 목록 조회
// GET /api/profile/images
// ======================================================
router.get('/profile/images', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const me = await User.findById(myId, { profileImages: 1, profileMain: 1 }).lean();
    if (!me) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const images = (me.profileImages || []).map(img => ({
      ...img,
      urls: {
        thumb:  toAbsoluteUploadUrl(img?.urls?.thumb  || '', req),
        medium: toAbsoluteUploadUrl(img?.urls?.medium || '', req),
        full:   toAbsoluteUploadUrl(img?.urls?.full   || '', req),
      }
    }));

    return res.json({
      profileMain: me.profileMain || '',
      profileImages: images
    });
  } catch (err) {
    log('GET /profile/images ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 목록 조회 실패' });
  }
});

// ======================================================
// [2] 상대방 프로필 이미지 목록 조회
// GET /api/users/:id/profile/images
// ======================================================
router.get('/users/:id/profile/images', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id, { profileImages: 1, profileMain: 1 }).lean();
    if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const images = (user.profileImages || []).map(img => ({
      ...img,
      urls: {
        thumb:  toAbsoluteUploadUrl(img?.urls?.thumb  || '', req),
        medium: toAbsoluteUploadUrl(img?.urls?.medium || '', req),
        full:   toAbsoluteUploadUrl(img?.urls?.full   || '', req),
      }
    }));

    return res.json({
      profileMain: user.profileMain || '',
      profileImages: images
    });
  } catch (err) {
    log('GET /users/:id/profile/images ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 목록 조회 실패' });
  }
});

// ======================================================
// [3] 대표 사진 지정
// PUT /api/profile/main
// ======================================================
router.put('/profile/main', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const { imageId } = req.body || {};
    if (!imageId) return res.status(400).json({ message: 'imageId가 필요합니다.' });

    const me = await User.findById(myId, { profileImages: 1 }).lean();
    if (!me) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const exists = (me.profileImages || []).some(img => String(img.id) === String(imageId));
    if (!exists) return res.status(404).json({ message: '해당 이미지가 존재하지 않습니다.' });

    await User.updateOne(
      { _id: myId },
      { $set: { profileMain: imageId } },
      { runValidators: false }
    );

    return res.json({ success: true, profileMain: imageId });
  } catch (err) {
    log('PUT /profile/main ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '대표 사진 지정 실패' });
  }
});

module.exports = router;
