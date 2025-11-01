// routes/user/authRouter.js
// base: /api
// ------------------------------------------------------
// 인증 및 계정 관련 라우터 (JWT 병행 + 세션 하위호환)
// - 회원가입, 로그인/로그아웃, 내 정보(/me), 비밀번호 변경
// - ✅ 로그인 시 세션 재발급(regenerate) + 저장(save)로 쿠키 발행 보장
// - ✅ Web/App 동시 지원: httpOnly 쿠키 + JSON 응답 token 병행
// - ✅ 하위호환: /userinfo 추가
// - 로그 최대화(요청 RAW, 파싱값, 토큰/쿠키 유무, 처리 경로)
// - ✅ 포인트 연동: /me 호출 시 매일 11:00 KST 하트 자동 지급 + 잔액 동봉
// ------------------------------------------------------

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const {
  // chat
  ChatRoom, Message,
  // payment
  Entitlement, PaymentTransaction, RefundRequest, Subscription,
  // social
  FriendRequest, Report,
  // system
  AdminLog, AppConfig, Notice,
  // user
  DeletionRequest, DeviceToken, User,
  // legal
  Terms, UserAgreement,
} = require('@/models');

const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('@/config/emergency');

// ✅ 포인트 서비스(하트·스타·루비)
const pointService = require('@/services/pointService');

const router = express.Router();

// ===== 환경값 =====
const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 앱/웹 공통 만료
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

// ===== 유틸: 민감정보 마스킹 =====
function maskPassword(obj) {
  const copy = { ...(obj || {}) };
  if (copy.password) copy.password = '(hidden)';
  if (copy.current) copy.current = '(hidden)';
  if (copy.next) copy.next = '(hidden)';
  return copy;
}

// ===== 유틸: 안전 트림 =====
function s(v) { return (v || '').toString().trim(); }

// ===== 유틸: 관리자 판별 =====
function resolveRole(u) {
  if (!u) return '';
  if (u.role) return String(u.role);
  if (Array.isArray(u.roles)) {
    if (u.roles.includes('master')) return 'master';
    if (u.roles.includes('admin')) return 'admin';
    if (u.roles.length > 0) return String(u.roles[0]);
  }
  if (u.username === 'master') return 'master'; // 폴백 규칙(옵션)
  return 'user';
}
function resolveIsAdmin(u) {
  if (!u) return false;
  if (u.isAdmin === true) return true; // 서버 저장 필드가 이미 있을 수 있음
  const role = resolveRole(u);
  if (role === 'master' || role === 'admin') return true;
  if (Array.isArray(u.roles) && (u.roles.includes('master') || u.roles.includes('admin'))) return true;
  if (u.username === 'master') return true;
  return false;
}

// ===== 유틸: JWT 발급 & 쿠키 설정 =====
function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), nickname: user.nickname || '' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function setJwtCookie(req, res, token) {
  const isSecure = true;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: isSecure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  });
  console.log('[AUTH][COOKIE]', { name: COOKIE_NAME, set: true, httpOnly: true, sameSite: 'none', secure: isSecure });
}

// ===== 유틸: JWT 추출 & 검증 =====
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);

  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader.includes(`${COOKIE_NAME}=`)) {
    try {
      const target = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith(`${COOKIE_NAME}=`));
      if (target) return decodeURIComponent(target.split('=')[1]);
    } catch (e) {
      console.log('[AUTH][DBG] 쿠키 파싱 실패:', e?.message);
    }
  }
  return null;
}

async function authFromJwtOrSession(req, res, next) {
  try {
    if (req.session?.user?._id) {
      req.auth = { userId: String(req.session.user._id), via: 'session' };
      console.log('[AUTH][OK] 세션 인증', { userId: req.auth.userId });
      return next();
    }

    const token = extractToken(req);
    if (!token) {
      console.log('[AUTH][ERR]', { step: 'extract', message: '토큰 없음' });
      return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.log('[AUTH][ERR]', { step: 'verify', message: e?.message });
      return res.status(401).json({ ok: false, message: '토큰이 유효하지 않습니다.' });
    }

    if (!decoded?.sub) {
      console.log('[AUTH][ERR]', { step: 'decode', message: 'sub 누락' });
      return res.status(401).json({ ok: false, message: '토큰이 유효하지 않습니다.' });
    }

    req.auth = { userId: String(decoded.sub), via: 'jwt', token };
    console.log('[AUTH][OK] JWT 인증', { userId: req.auth.userId });
    return next();
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'unknown', message: err?.message });
    return res.status(401).json({ ok: false, message: '인증 실패' });
  }
}

// ======================================================
// 회원가입
// ======================================================
router.post('/signup', async (req, res) => {
  console.log('[API][REQ] /signup', { body: maskPassword(req.body || {}) });

  let {
    username, password, nickname, gender, birthyear, region1, region2,
    consents = [],
  } = req.body || {};
  try {
    username = s(username);
    nickname = s(nickname);
    gender   = s(gender);
    region1  = s(region1);
    region2  = s(region2);
    const birthYearNum = birthyear ? parseInt(String(birthyear), 10) : undefined;

    if (!username || !password || !nickname || !gender || !birthYearNum || !region1 || !region2) {
      console.log('[API][RES] /signup 400 필수누락');
      return res.status(400).json({ ok: false, message: '필수 항목 누락' });
    }

    const [userExists, nicknameExists] = await Promise.all([
      User.findOne({ username }).select('_id').lean(),
      User.findOne({ nickname }).select('_id').lean(),
    ]);
    if (userExists) {
      console.log('[AUTH][ERR]', { step: 'signup', code: 'DUP_USERNAME_PRECHECK', username });
      return res.status(409).json({ ok: false, message: '아이디 중복' });
    }
    if (nicknameExists) {
      console.log('[AUTH][ERR]', { step: 'signup', code: 'DUP_NICKNAME_PRECHECK', nickname });
      return res.status(409).json({ ok: false, message: '닉네임 중복' });
    }

    let user;
    try {
      const hashed = await bcrypt.hash(String(password), 10);
    user = await User.create({
      username,
      password: hashed,
      nickname,
      gender: ['man', 'woman'].includes(String(gender)) ? String(gender) : 'man',
      birthyear: Number.isFinite(birthYearNum) ? birthYearNum : undefined,
      region1,
      region2,
      last_login: null,

      // ✅ 가입 즉시 기본 지급
      heart: 400,   // 초기 하트
      star: 0,
      ruby: 0,
      // lastDailyGrantAt는 설정하지 않음(아래 12시간 유예 로직으로 제어)
    });
    } catch (e) {
      if (e && e.code === 11000) {
        const dupField = Object.keys(e.keyValue || {})[0];
        const which = dupField === 'nickname' ? '닉네임' : '아이디';
        console.log('[AUTH][ERR]', { step: 'signup', code: 'E11000_DUP_KEY', keyValue: e.keyValue });
        return res.status(409).json({ ok: false, message: `${which} 중복` });
      }
      if (e?.name === 'ValidationError') {
        console.log('[AUTH][ERR]', { step: 'signup', code: 'VALIDATION_ERROR', errors: e.errors });
        return res.status(400).json({ ok: false, message: '회원정보 형식이 올바르지 않습니다.' });
      }
      if (e?.name === 'CastError') {
        console.log('[AUTH][ERR]', { step: 'signup', code: 'CAST_ERROR', path: e.path, value: e.value });
        return res.status(400).json({ ok: false, message: '입력값 변환 중 오류가 발생했습니다.' });
      }
      console.log('[AUTH][ERR]', { step: 'signup', code: 'CREATE_USER_FAILED', message: e?.message });
      return res.status(500).json({ ok: false, message: '서버 오류' });
    }

    // consents 저장(있을 때만)
    if (Array.isArray(consents) && consents.length > 0) {
      try {
        const activeConsents = await Terms.find({ isActive: true, kind: 'consent' })
          .select('slug title version defaultRequired')
          .lean();

        const activeBySlug = new Map(activeConsents.map(d => [String(d.slug), d]));
        const now = new Date();
        const bulk = [];

        for (const c of consents) {
          if (!c || typeof c.slug !== 'string') continue;

          const slug = String(c.slug);
          const version = (c.version != null) ? String(c.version) : null;
          const optedIn = (typeof c.optedIn === 'boolean') ? c.optedIn : true;

          const matched = activeBySlug.get(slug);
          bulk.push({
            updateOne: {
              filter: { userId: user._id, slug },
              update: {
                $set: {
                  version: version || (matched ? String(matched.version) : undefined),
                  agreedAt: now,
                  optedIn,
                  docId: matched ? matched._id : undefined,
                  meta: matched ? {
                    title: matched.title,
                    kind: 'consent',
                    defaultRequired: !!matched.defaultRequired,
                  } : undefined,
                },
              },
              upsert: true,
            },
          });
        }

        if (bulk.length) await UserAgreement.bulkWrite(bulk);
      } catch (e) {
        console.log('[AUTH][WARN] consents save skipped', { message: e?.message });
      }
    }

    console.log('[API][RES] /signup 201', { userId: String(user._id), username });
    return res.status(201).json({ ok: true, message: '회원가입 성공' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'signup', raw: err, message: err?.message, code: err?.code, name: err?.name });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 로그인 / 로그아웃 (JWT + 세션 하위호환)
// ======================================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const safeUsername = s(username);

  console.log('[API][REQ] /login', {
    username: safeUsername,
    ua: req.get('user-agent'),
    origin: req.get('origin') || '(none)',
    hasCookie: !!req.headers.cookie
  });

  try {
    const user = await User.findOne({ username: safeUsername }).select('+password role roles username nickname');
    if (!user) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'NO_USER', username: safeUsername });
      return res.status(401).json({ ok: false, message: '아이디 없음' });
    }

    const hashed = String(user.password || '');
    if (!hashed) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'NO_PASSWORD_FIELD', username: safeUsername });
      return res.status(500).json({ ok: false, message: '계정 비밀번호 필드를 찾을 수 없습니다.' });
    }

    const isMatch = await bcrypt.compare(String(password || ''), hashed);
    if (!isMatch) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'BAD_PASSWORD', username: safeUsername });
      return res.status(401).json({ ok: false, message: '비밀번호 틀림' });
    }

    // 로그인 시간 갱신(베스트 에포트)
    user.last_login = new Date();
    user.save().catch(() => {});

    const token = signToken(user);
    setJwtCookie(req, res, token);

    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.regenerate(err => (err ? reject(err) : resolve()));
      });
      req.session.user = { _id: user._id, nickname: user.nickname };
      await new Promise((resolve, reject) => {
        req.session.save(err => (err ? reject(err) : resolve()));
      });
      console.log('[AUTH][SESSION] regenerated + saved', { sid: req.sessionID, userId: String(user._id) });
    }

    const role = resolveRole(user);
    const roles = Array.isArray(user.roles) ? user.roles : (role ? [role] : []);
    const isAdmin = resolveIsAdmin(user);

    console.log('[API][RES] /login 200', { username: safeUsername, userId: String(user._id), role, isAdmin });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      message: '로그인 성공',
      nickname: user.nickname,
      username: user.username,
      role,
      roles,
      isAdmin,
      token
    });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'login', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

router.post('/logout', async (req, res) => {
  const userId = req.session?.user?._id || '(jwt-only)';
  console.log('[API][REQ] /logout', { userId });

  try {
    res.clearCookie(COOKIE_NAME, {
      path: '/',
      sameSite: 'none',
      secure: true,
      httpOnly: true,
    });

    if (req.session) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
    }

    console.log('[API][RES] /logout 200');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, message: '로그아웃 완료' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'logout', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 내 정보(/me) & 공개 유저 목록 & 내 친구 ID 목록
//  - ✅ /me: 하트 일일 지급 보장(매일 11:00 KST) + wallet 동봉
// ======================================================
router.get('/me', authFromJwtOrSession, async (req, res) => {
  console.time('[API][TIMING] GET /api/me');
  const userId = req.auth.userId;

  try {
    // 1) 유저 문서 로드(lean 아님: 지급/저장 필요)
  const userDoc = await User.findById(userId)
    .select([
      'username', 'nickname', 'birthyear', 'gender',
      'region1', 'region2', 'preference', 'selfintro',
      'profileImages', 'profileMain', 'profileImage', 'last_login',
      'user_level', 'refundCountTotal',
      'search_birthyear1', 'search_birthyear2',
      'search_region1', 'search_region2', 'search_regions',
      'search_preference',
      'search_disconnectLocalContacts', 'search_allowFriendRequests',
      'search_allowNotifications', 'search_onlyWithPhoto', 'search_matchPremiumOnly',
      'marriage', 'search_marriage',
      'friendlist', 'blocklist',
      'emergency',
      'role', 'roles',
      // ✅ 포인트 잔액 + 일일지급 기준시각 꼭 포함
      'heart', 'star', 'ruby', 'lastDailyGrantAt',
      'createdAt', 'updatedAt'
    ])
    .populate('friendlist', 'username nickname birthyear gender')
    .populate('blocklist', 'username nickname birthyear gender');


    if (!userDoc) {
      console.timeEnd('[API][TIMING] GET /api/me');
      console.log('[AUTH][ERR]', { step: 'me', code: 'NO_USER', userId });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ ok: false, message: '유저 없음' });
    }

    // 2) 하트 일일 지급(등급별 daily/cap, 오전 11:00 KST 기준)
    try {
      await pointService.grantDailyIfNeeded(userDoc, { save: true });
    } catch (e) {
      console.warn('[POINTS][WARN] grantDailyIfNeeded failed:', e?.message);
    }

    // 3) Emergency 남은 시간 계산 + 자동 꺼짐
    const raw = userDoc.toObject();
    const remaining = computeRemaining(raw?.emergency?.activatedAt);
    let isActive = raw?.emergency?.isActive === true;
    let activatedAt = raw?.emergency?.activatedAt || null;

    if (isActive && remaining <= 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
      });
      isActive = false;
      activatedAt = null;
      console.log('[AUTH][DBG]', { step: 'me', message: 'emergency auto-off' });
    }

    // 4) 관리자/역할 정보
    const role = resolveRole(raw);
    const roles = Array.isArray(raw.roles) ? raw.roles : (role ? [role] : []);
    const isAdmin = resolveIsAdmin(raw);

    // 5) 지갑 요약(프론트 편의)
    const wallet = pointService.getWalletSummary(userDoc);

    // 6) 응답 보강/정규화
    const searchRegions = Array.isArray(raw.search_regions) ? raw.search_regions : [];
    const user = {
      ...raw,
      role,
      roles,
      isAdmin,
      wallet,
      searchRegions,
      emergency: {
        ...(raw.emergency || {}),
        isActive,
        activatedAt,
        remainingSeconds: isActive ? computeRemaining(activatedAt) : 0,
      },
      // null/undefined 가드
      search_birthyear1: raw.search_birthyear1 ?? null,
      search_birthyear2: raw.search_birthyear2 ?? null,
      search_region1: raw.search_region1 ?? '전체',
      search_region2: raw.search_region2 ?? '전체',
      search_preference: raw.search_preference ?? '이성친구 - 전체',
      search_disconnectLocalContacts: raw.search_disconnectLocalContacts ?? 'OFF',
      search_allowFriendRequests: raw.search_allowFriendRequests ?? 'OFF',
      search_allowNotifications: raw.search_allowNotifications ?? 'OFF',
      search_onlyWithPhoto: raw.search_onlyWithPhoto ?? 'OFF',
      search_matchPremiumOnly: raw.search_matchPremiumOnly ?? 'OFF',
      marriage: raw.marriage ?? '미혼',
      search_marriage: raw.search_marriage ?? '전체',
    };

    console.timeEnd('[API][TIMING] GET /api/me');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, user, durationSeconds: EMERGENCY_DURATION_SECONDS });
  } catch (err) {
    console.timeEnd('[API][TIMING] GET /api/me');
    console.log('[AUTH][ERR]', { step: 'me', message: err?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const users = await User.find({})
      .select('username nickname birthyear gender region1 region2 preference selfintro');
    return res.json({ ok: true, users });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'listUsers', message: err?.message });
    return res.status(500).json({ ok: false, message: '유저 조회 실패' });
  }
});

router.get('/my-friends', authFromJwtOrSession, async (req, res) => {
  try {
    const myId = req.auth.userId;
    const me = await User.findById(myId).select('friendlist');
    if (!me) return res.status(404).json({ ok: false, message: '사용자 없음' });

    console.log('[API][RES] /my-friends', { userId: myId, count: me.friendlist?.length || 0 });
    return res.json({ ok: true, friendIds: me.friendlist });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'myFriends', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 비밀번호 변경
// ======================================================
router.put('/update-password', authFromJwtOrSession, async (req, res) => {
  const userId = req.auth.userId;
  const { current, next } = req.body || {};

  if (!current || !next) {
    return res.status(400).json({ ok: false, message: '현재/새 비밀번호를 모두 입력해 주세요.' });
  }
  if (String(next).length < 4) {
    return res.status(400).json({ ok: false, message: '새 비밀번호는 4자 이상을 권장합니다.' });
  }

  try {
    console.log('[AUTH][REQ] update-password', { userId });

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const isMatch = await bcrypt.compare(String(current), String(user.password));
    if (!isMatch) {
      return res.status(400).json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' });
    }

    const isReuse = await bcrypt.compare(String(next), String(user.password));
    if (isReuse) {
      return res.status(400).json({ ok: false, message: '이전과 다른 새 비밀번호를 사용해 주세요.' });
    }

    user.password = await bcrypt.hash(String(next), 10);
    await user.save();

    console.log('[AUTH][RES] update-password OK', { userId });
    return res.json({ ok: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'updatePassword', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류로 비밀번호 변경에 실패했습니다.' });
  }
});

// ======================================================
// 🔁 하위호환: /userinfo (세션/JWT 겸용 간단 응답)
// ======================================================
router.get('/userinfo', async (req, res) => {
  try {
    let via = null;
    let uid = null;
    let nickname = null;

    if (req.session?.user?._id) {
      via = 'session';
      uid = String(req.session.user._id);
      nickname = req.session.user.nickname || null;
    } else {
      const token = extractToken(req);
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          via = 'jwt';
          uid = String(decoded.sub || '');
          const u = await User.findById(uid).select('nickname');
          nickname = u?.nickname || null;
        } catch (e) {
          // ignore
        }
      }
    }

    if (!uid) {
      return res.json({ ok: true, loggedIn: false });
    }
    return res.json({ ok: true, loggedIn: true, via, userId: uid, nickname });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'userinfo', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

module.exports = router;
