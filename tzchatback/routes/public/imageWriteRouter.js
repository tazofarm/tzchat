// routes/public/imageWriteRouter.js
// base: /api
// -------------------------------------------------------------
// 📷 프로필 이미지 업로드·삭제 전용 라우터 (파일 IO/Sharp 의존)
// - POST   /api/profile/images         : 업로드(avatar|gallery) → 중앙 크롭 + 3종 리사이즈
// - DELETE /api/profile/images/:id     : 삭제(파일·DB·대표 후속)
// - ✅ DB에는 상대(/uploads/...) 저장, 응답은 절대 URL로 정규화
// - ✅ updateOne + runValidators:false 로 원자적 반영
// - ✅ 업로드 루트: 프로젝트 루트(기본), ENV로 오버라이드
// -------------------------------------------------------------

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');

const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const { User } = require('@/models');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

// ===== 공용 로그 헬퍼 =====
const log = (...args) => console.log('[profileImage:write]', ...args);

// ===== 경로/ID 유틸 =====
const UPLOAD_ROOT =
  process.env.UPLOAD_ROOT
  || path.resolve(__dirname, '../../uploads'); // routes/user/ → ../../ → 프로젝트 루트
const PROFILE_ROOT = path.join(UPLOAD_ROOT, 'profile');

function ensureDirSync(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error('[profileImage] 디렉터리 생성 실패:', dir, e);
  }
}
ensureDirSync(UPLOAD_ROOT);
ensureDirSync(PROFILE_ROOT);

function getUserProfileDir(userId) {
  const dir = path.join(PROFILE_ROOT, String(userId));
  ensureDirSync(dir);
  return dir;
}
function genId() {
  return crypto.randomBytes(16).toString('hex'); // 32 hex
}

// ===== URL 정규화 & 변환 =====
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

/** 내부 절대경로 → 퍼블릭 상대경로(/uploads/...) */
function toPublicUrl(absPath) {
  const normalized = (absPath || '').replace(/\\/g, '/');
  const base = UPLOAD_ROOT.replace(/\\/g, '/');
  const rel = normalized.startsWith(base) ? normalized.slice(base.length) : null;
  if (!rel) return null;
  return `/uploads${rel}`;
}

/** 퍼블릭 URL(/uploads/...) → 서버 절대경로 */
function publicUrlToAbs(publicUrl) {
  if (!publicUrl) return null;
  const p = publicUrl.replace(/\\/g, '/');
  const i = p.indexOf('/uploads/');
  if (i === -1) return null;
  const rel = p.slice(i + '/uploads/'.length).replace(/\.\./g, '');
  return path.join(UPLOAD_ROOT, rel);
}

/** 응답 절대 URL 정규화 */
function toAbsoluteUploadUrl(u, req) {
  if (!u) return u;
  const base = getPublicBaseUrl(req);

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
    } catch { /* ignore */ }
  }

  const rel = u.startsWith('/') ? u : `/${u}`;
  return `${base}${rel}`;
}

function getMyId(req) {
  return req?.user?._id || req?.session?.user?._id || null;
}

// ===== Multer (임시 저장: 사용자 폴더 내 tmp) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const userId = getMyId(req);
      if (!userId) return cb(new Error('인증 필요'), null);
      const userDir = getUserProfileDir(userId);
      const tmpDir = path.join(userDir, 'tmp');
      ensureDirSync(tmpDir);
      cb(null, tmpDir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const uid = genId();
    cb(null, `${uid}${ext || ''}`);
  }
});
const fileFilter = (_req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(new Error('이미지 파일만 업로드할 수 있습니다.'), false);
  }
  cb(null, true);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ===== 이미지 처리 (크롭 + 리사이즈 3종) =====
const SIZES = [
  { name: 'thumb',  w: 240  },
  { name: 'medium', w: 720  },
  { name: 'full',   w: 1280 },
];

async function createVariantsAndSave(srcPath, outBasePathNoExt, aspect) {
  const input = sharp(srcPath, { failOnError: false }).rotate();
  const meta = await input.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  // 중앙 크롭 (목표 비율)
  const targetW1 = Math.min(w, Math.floor(h * aspect));
  const targetH1 = Math.min(h, Math.floor(w / aspect));
  const cropW = Math.max(1, targetW1);
  const cropH = Math.max(1, targetH1);
  const left = Math.max(0, Math.floor((w - cropW) / 2));
  const top  = Math.max(0, Math.floor((h - cropH) / 2));

  const results = {};
  for (const s of SIZES) {
    const outPath = `${outBasePathNoExt}_${s.name}.jpg`;
    await sharp(srcPath)
      .rotate()
      .extract({ left, top, width: cropW, height: cropH })
      .resize({ width: s.w, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);

    results[s.name] = outPath;
  }
  return results; // { thumb, medium, full }
}

// ======================================================
// [1] 이미지 업로드 (다중)
// POST /api/profile/images
// body: kind = 'avatar' | 'gallery' (default: 'gallery')
// ======================================================
router.post('/profile/images', upload.array('images', 10), async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const me = await User.findById(myId, { profileImages: 1, profileMain: 1 }).lean();
    if (!me) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const kind = (req.body?.kind === 'avatar' || req.body?.kind === 'gallery') ? req.body.kind : 'gallery';
    const aspect = kind === 'avatar' ? 1.0 : 0.8; // 1:1 or 4:5
    const userDir = getUserProfileDir(myId);

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: '업로드된 파일이 없습니다.' });

    const toInsert = [];
    const created = [];

    for (const file of files) {
      const uid = genId();
      const baseNoExt = path.join(userDir, uid);

      // 3종 생성
      const variants = await createVariantsAndSave(file.path, baseNoExt, aspect);

      // 원본 임시파일 삭제
      try { fs.unlinkSync(file.path); } catch {}

      const urls = {
        thumb:  toPublicUrl(variants.thumb),
        medium: toPublicUrl(variants.medium),
        full:   toPublicUrl(variants.full),
      };

      const doc = {
        id: uid,
        kind,
        aspect,
        urls,
        createdAt: new Date(),
      };

      toInsert.push(doc);

      created.push({
        id: uid,
        kind,
        aspect,
        urlsAbs: {
          thumb:  toAbsoluteUploadUrl(urls.thumb,  req),
          medium: toAbsoluteUploadUrl(urls.medium, req),
          full:   toAbsoluteUploadUrl(urls.full,   req),
        }
      });
    }

    // 대표사진 자동 설정: 기존 대표가 없고 avatar를 올리면 첫 업로드를 대표로
    const shouldSetMain = (!me.profileMain && kind === 'avatar' && toInsert.length > 0);
    const setOps = shouldSetMain ? { profileMain: toInsert[0].id } : {};

    await User.updateOne(
      { _id: myId },
      {
        $push: { profileImages: { $each: toInsert } },
        ...(Object.keys(setOps).length ? { $set: setOps } : {})
      },
      { runValidators: false }
    );

    return res.json({
      success: true,
      created,
      ...(shouldSetMain ? { profileMain: toInsert[0].id } : {})
    });
  } catch (err) {
    log('POST /profile/images ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 업로드 실패' });
  }
});

// ======================================================
// [2] 이미지 삭제
// DELETE /api/profile/images/:id
// ======================================================
router.delete('/profile/images/:id', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const { id: imageId } = req.params;

    const me = await User.findById(myId, { profileImages: 1, profileMain: 1 }).lean();
    if (!me) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const arr = me.profileImages || [];
    const idx = arr.findIndex(img => String(img.id) === String(imageId));
    if (idx === -1) return res.status(404).json({ message: '이미지를 찾을 수 없습니다.' });

    // 파일 삭제
    const urls = arr[idx]?.urls || {};
    const absPaths = [urls.thumb, urls.medium, urls.full]
      .map(publicUrlToAbs)
      .filter(Boolean);

    for (const p of absPaths) {
      try { fs.unlinkSync(p); } catch (e) { /* 이미 삭제된 경우 무시 */ }
    }

    // 대표가 이 이미지였으면 후속 처리(남은 사진 중 첫 번째로 대체)
    let nextMain = me.profileMain || '';
    if (String(me.profileMain || '') === String(imageId)) {
      const remain = arr.filter(x => String(x.id) !== String(imageId));
      nextMain = remain.length ? remain[0].id : '';
    }

    await User.updateOne(
      { _id: myId },
      {
        $pull: { profileImages: { id: imageId } },
        $set: { profileMain: nextMain }
      },
      { runValidators: false }
    );

    return res.json({ success: true, removedId: imageId, profileMain: nextMain });
  } catch (err) {
    log('DELETE /profile/images/:id ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 삭제 실패' });
  }
});

module.exports = router;
