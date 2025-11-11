// backend/routes/user/accountRouter.js
// base: /api
// ------------------------------------------------------
// 내 계정 중심 라우터
// - GET /me           (일일 하트 지급 + Emergency 남은시간 포함 + 디버그 옵션)
// - GET /my-friends   (친구 ID 목록)
// - PUT /update-password
// ------------------------------------------------------

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { User, PassIdentity } = require('@/models');
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('@/config/emergency');
const pointService = require('@/services/pointService');

const router = express.Router();

// ===== 환경값 =====
const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

// ===== 유틸: 관리자 판별 =====
function resolveRole(u) {
  if (!u) return '';
  if (u.role) return String(u.role);
  if (Array.isArray(u.roles)) {
    if (u.roles.includes('master')) return 'master';
    if (u.roles.includes('admin')) return 'admin';
    if (u.roles.length > 0) return String(u.roles[0]);
  }
  if (u.username === 'master') return 'master';
  return 'user';
}
function resolveIsAdmin(u) {
  if (!u) return false;
  if (u.isAdmin === true) return true;
  const role = resolveRole(u);
  if (role === 'master' || role === 'admin') return true;
  if (Array.isArray(u.roles) && (u.roles.includes('master') || u.roles.includes('admin'))) return true;
  if (u.username === 'master') return true;
  return false;
}
const sha256Hex = (s = '') => crypto.createHash('sha256').update(String(s)).digest('hex');

// ===== 유틸: JWT 추출 & 인증 미들웨어 =====
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
// /me (일일 하트 지급 + Emergency 남은시간 포함 + 디버그 옵션)
// ======================================================
router.get('/me', authFromJwtOrSession, async (req, res) => {
  console.time('[API][TIMING] GET /api/me');
  const userId = req.auth.userId;
  const passDebug = (process.env.PASS_DEBUG === '1') || (req.get('X-Debug') === 'pass');

  try {
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
        'phone', 'carrier', 'phoneVerifiedAt', 'phoneVerifiedBy',
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

    // 일일 하트 지급 (에러는 무시하고 진행)
    try {
      await pointService.grantDailyIfNeeded(userDoc, { save: true });
    } catch (e) {
      console.warn('[POINTS][WARN] grantDailyIfNeeded failed:', e?.message);
    }

    // Emergency 남은시간/자동꺼짐
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

    const role = resolveRole(raw);
    const roles = Array.isArray(raw.roles) ? raw.roles : (role ? [role] : []);
    const isAdmin = resolveIsAdmin(raw);
    const wallet = pointService.getWalletSummary(userDoc);

    const searchRegions = Array.isArray(raw.search_regions) ? raw.search_regions : [];
    function formatE164KR(p = '') {
      const s = String(p || '');
      if (!s.startsWith('+82')) return s;
      const tail = s.replace('+82', '');
      // 010-XXXX-XXXX 또는 지역번호-패턴
      const m =
        tail.match(/^10(\d{4})(\d{4})$/) || // 010
        tail.match(/^(\d{2})(\d{4})(\d{4})$/); // 11~19, 2자리 지역
      if (m) {
        // 첫 패턴이면 '10', 아니면 m[1] 그대로
        const first = (m[0].length === 9 || m[1].length === 2) ? m[1] : '10';
        return `+82 ${first}-${m[2]}-${m[3]}`;
      }
      return s;
    }
    function maskPhone(p = '') {
      const s = String(p || '');
      if (s.length < 4) return '****';
      const last4 = s.slice(-4);
      return `****-****-${last4}`;
    }
    const preview = (hash) => (hash ? String(hash).slice(0, 8) + '…' : null);

    const user = {
      ...raw,
      role,
      roles,
      isAdmin,
      wallet,
      searchRegions,
      phoneFormatted: raw.phone ? formatE164KR(raw.phone) : null,
      phoneMasked: raw.phone ? maskPhone(raw.phone) : null,
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

    // 개발/점검 편의를 위한 조건부 디버그 블록
    if (passDebug) {
      // phoneHashPreview: 서버와 클라이언트 정규화/해시 일치 여부 빠른 확인용
      user._debug = user._debug || {};
      user._debug.phoneHashPreview = raw.phone ? preview(sha256Hex(raw.phone)) : null;

      // PassIdentity에서 ciHash/diHash 프리뷰
      const pid = await PassIdentity.findOne({ userId }).select('ciHash diHash updatedAt').lean();
      user._debug.pass = pid
        ? {
            ciHashPreview: preview(pid.ciHash),
            diHashPreview: preview(pid.diHash),
            updatedAt: pid.updatedAt,
          }
        : null;
    }

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

// ======================================================
// 내 친구 ID 목록
// ======================================================
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

module.exports = router;
