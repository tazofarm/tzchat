// routes/user/profileImageRouter.js
// base: /api
// -------------------------------------------------------------
// 📷 프로필 이미지 라우터
// - 업로드: 다중 파일 → 중앙 크롭(avatar=1:1, gallery=4:5) + 3종 리사이즈(thumb/medium/full)
// - 저장 경로: /uploads/profile/<userId>/<imageId>_{thumb|medium|full}.jpg
// - 목록 조회: 내/상대방
// - 대표 지정: profileMain = <imageId>
// - 삭제: 배열/디스크 정리 + 대표 삭제 시 후속 처리
// - ✅ 응답 시 이미지 URL 절대경로로 정규화(과거 localhost 절대URL도 강제 교정)
// - ✅ Mongoose 전체 검증 회피: updateOne + runValidators:false
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

// models/index.js 가 모든 모델을 export 한다는 가정
const {
  ChatRoom, Message,
  Entitlement, PaymentTransaction, RefundRequest, Subscription,
  FriendRequest, Report,
  AdminLog, AppConfig, Notice,
  DeletionRequest, DeviceToken, User,
  Terms, UserAgreement,
} = require('@/models');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion); // 전역 차단

// ===== 공용 로그 헬퍼 =====
const log = (...args) => console.log('[profileImage]', ...args);

// ===== 경로 유틸 =====
// ⚠ 기존: path.join(__dirname, '..', 'uploads') → routes/uploads 로 생김
// ✅ 수정: 프로젝트 루트의 /uploads 이용(기본), 필요 시 ENV로 오버라이드
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

// ===== URL 정규화 =====
function stripTrailingSlashes(u) { return (u || '').replace(/\/+$/, ''); }
function getPublicBaseUrl(req) {
  const envBase =
    process.env.PUBLIC_BASE_URL ||
    process.env.FILE_BASE_URL ||
    process.env.API_BASE_URL ||
    '';
  if (envBase) return stripTrailingSlashes(envBase);

  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http');
  const host = req.get('host'); // ex) localhost:2000
  return `${proto}://${host}`;
}

/**
 * 서버 내부 저장용 절대경로 → 퍼블릭 상대경로 (/uploads/...) 로 변환
 */
function toPublicUrl(absPath) {
  // absPath: <UPLOAD_ROOT>/profile/<userId>/<id>_thumb.jpg
  // => /uploads/profile/<userId>/<file>
  const normalized = (absPath || '').replace(/\\/g, '/');
  const base = UPLOAD_ROOT.replace(/\\/g, '/');
  const rel = normalized.startsWith(base) ? normalized.slice(base.length) : null;
  if (!rel) return null;
  return `/uploads${rel}`;
}

/**
 * 퍼블릭 URL(/uploads/...) → 서버 파일 시스템 절대경로
 */
function publicUrlToAbs(publicUrl) {
  if (!publicUrl) return null;
  const p = publicUrl.replace(/\\/g, '/');
  const i = p.indexOf('/uploads/');
  if (i === -1) return null;
  const rel = p.slice(i + '/uploads/'.length).replace(/\.\./g, ''); // 보안: 상위 경로 제거
  return path.join(UPLOAD_ROOT, rel);
}

/**
 * ✅ 핵심: 응답 시 절대 URL로 정규화하되,
 * 과거에 http://localhost:2000/uploads/... 처럼 "잘못 저장된 절대URL"도
 * 현재 요청 도메인/프로토콜 기준으로 강제 교체한다.
 *
 * 규칙:
 *  - 입력이 http(s) 절대 URL인데 path가 /uploads/로 시작하면, origin을 현재 요청 기준으로 교체.
 *  - 입력이 상대(/uploads/...)면 현재 기준으로 절대화.
 *  - 그 외 외부 URL은 그대로 둠.
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
      return u; // 업로드 경로 아님 → 그대로
    } catch {
      // 파싱 실패 시 아래 로직으로
    }
  }
  // 상대 경로
  const rel = u.startsWith('/') ? u : `/${u}`;
  return `${base}${rel}`;
}

// ===== Multer (임시 저장: 사용자 폴더 내 tmp) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const userId = req?.user?._id || req?.session?.user?._id;
      if (!userId) return cb(new Error('인증 필요'), null);
      const userDir = getUserProfileDir(userId);
      const tmpDir = path.join(userDir, 'tmp');
      ensureDirSync(tmpDir);
      cb(null, tmpDir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const uid = genId();
    cb(null, `${uid}${ext || ''}`);
  }
});
const fileFilter = (req, file, cb) => {
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
  return results; // { thumb, medium, full } absolute paths
}

// ===== 권한 & 유틸 =====
function getMyId(req) {
  return req?.user?._id || req?.session?.user?._id || null;
}

function assertOwner(userDoc, userId) {
  if (!userDoc || String(userDoc._id) !== String(userId)) {
    const err = new Error('권한 없음');
    err.status = 403;
    throw err;
  }
}

// ======================================================
// [1] 내 프로필 이미지 목록 조회
// GET /api/profile/images
// ======================================================
router.get('/profile/images', requireLogin, async (req, res) => {
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
    console.error('[GET]/profile/images ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 목록 조회 실패' });
  }
});

// ======================================================
// [2] 상대방 프로필 이미지 목록 조회
// GET /api/users/:id/profile/images
// ======================================================
router.get('/users/:id/profile/images', requireLogin, async (req, res) => {
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
    console.error('[GET]/users/:id/profile/images ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 목록 조회 실패' });
  }
});

// ======================================================
// [3] 이미지 업로드 (다중)
// POST /api/profile/images
// body: kind = 'avatar' | 'gallery' (default: 'gallery')
// ✅ 변경점:
//   - DB에는 상대경로(/uploads/...) 저장 유지
//   - 응답에는 현재 도메인 기준 절대 URL 제공(과거 localhost 절대URL 방지)
//   - updateOne($push) + runValidators:false 로 원자적 반영
// ======================================================
router.post('/profile/images', requireLogin, upload.array('images', 10), async (req, res) => {
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
    console.error('[POST]/profile/images ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 업로드 실패' });
  }
});

// ======================================================
// [4] 대표 사진 지정
// PUT /api/profile/main
// ✅ 변경점: updateOne + runValidators:false
// ======================================================
router.put('/profile/main', requireLogin, async (req, res) => {
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
    console.error('[PUT]/profile/main ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '대표 사진 지정 실패' });
  }
});

// ======================================================
// [5] 이미지 삭제
// DELETE /api/profile/images/:id
// ✅ 변경점:
//   - 파일 경로 계산을 UPLOAD_ROOT 기준으로 안전하게 변경
//   - 배열 갱신은 updateOne($pull, $set) + runValidators:false
// ======================================================
router.delete('/profile/images/:id', requireLogin, async (req, res) => {
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
    console.error('[DELETE]/profile/images/:id ERR', err?.message);
    const code = err?.status || 500;
    return res.status(code).json({ message: '이미지 삭제 실패' });
  }
});

module.exports = router;
