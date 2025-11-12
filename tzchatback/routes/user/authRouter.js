// backend/routes/user/authRouter.js
// base: /api
// ------------------------------------------------------
// 회원가입 + 공개 유저 목록
// - POST /signup (PASS 연동: PassResult 소비 + PassIdentity 매핑)
// - GET  /users   (간단 공개 목록)
// ------------------------------------------------------

const express = require('express');
const bcrypt = require('bcrypt');

const {
  User, Terms, UserAgreement, PassResult, PassIdentity,
} = require('@/models');

const router = express.Router();

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

// ======================================================
// 회원가입 (PASS 연동 강화: PassIdentity upsert + PassResult 소비)
//  - ciHash가 PassIdentity.userId에 매핑되어 있되, "실존 유저"일 때만 가입 차단
//    (유령/삭제된 유저에 묶인 경우는 가입 허용 → upsertByCI에서 재바인딩)
//  - 전화번호는 User 훅에서 정규화 + phoneHash 자동 생성
//  - PassResult.consumeByTxId 로 1회성 소모
//  - PassResult.markRoute 로 분기 기록(옵션)
//  - 미성년자(올해 기준 만 19세 미만) 백엔드 차단
// ======================================================
router.post('/signup', async (req, res) => {
  console.log('[API][REQ] /signup', { body: maskPassword(req.body || {}) });

  let {
    username, password, nickname, gender, birthyear, region1, region2,
    consents = [],
    passTxId,
  } = req.body || {};
  
  try {
    username = s(username);
    nickname = s(nickname);
    gender   = s(gender);
    region1  = s(region1);
    region2  = s(region2);
    passTxId = s(passTxId);

    // ✅ PASS 결과 오버라이드 컨테이너(서버 신뢰값만 사용)
    //    { birthyear, gender, phone(E.164), ciHash, diHash, carrier }
    let prOverride = null;

    if (passTxId) {
      const pr = await PassResult.findOne({ txId: passTxId }).lean();

      if (!pr || pr.status !== 'success') {
        console.log('[AUTH][ERR]', { step: 'signup', code: 'PASS_TX_INVALID', passTxId });
        return res.status(400).json({ ok: false, message: 'PASS 결과를 확인할 수 없습니다.' });
      }
      if (pr.consumed === true) {
        console.log('[AUTH][ERR]', { step: 'signup', code: 'PASS_TX_CONSUMED', passTxId });
        return res.status(410).json({ ok: false, message: '이미 사용된 PASS 토큰입니다.' });
      }

      prOverride = {
        birthyear: Number(pr.birthyear) || null,
        gender: (pr.gender === 'man' || pr.gender === 'woman') ? pr.gender : '',
        phone: pr.phone || '',
        ciHash: pr.ciHash || undefined,
        diHash: pr.diHash || undefined,
        carrier: pr.carrier || '',
      };
    }

    // 클라이언트 제공값(백워드 호환)
    const birthYearNum = birthyear ? parseInt(String(birthyear), 10) : undefined;

    // ✅ 필수값 검증
    const commonMissing = (!username || !password || !nickname || !region1 || !region2);
    const extraMissing  = (!passTxId && (!gender || !birthYearNum));
    if (commonMissing || extraMissing) {
      console.log('[API][RES] /signup 400 필수누락', { passTxId: !!passTxId });
      return res.status(400).json({ ok: false, message: '필수 항목 누락' });
    }

    // ✅ 최종 저장값 확정 (PASS 우선)
    const finalBirthyear = prOverride?.birthyear ?? (Number.isFinite(birthYearNum) ? birthYearNum : undefined);
    const finalGender    = prOverride?.gender    ?? (['man', 'woman'].includes(String(gender)) ? String(gender) : '');
    const finalPhone     = prOverride?.phone     || undefined;
    const finalCiHash    = prOverride?.ciHash    || undefined;
    const finalDiHash    = prOverride?.diHash    || undefined;
    const finalCarrier   = prOverride?.carrier   || undefined;

    // 클라이언트 직접 입력 경로에서 성별이 비어있으면 오류(기존 기본값 'man' 제거)
    if (!passTxId && !finalGender) {
      return res.status(400).json({ ok: false, message: '성별이 올바르지 않습니다.' });
    }

    // ✅ 미성년자 차단(올해 기준 만 19세 미만)
    const CURRENT_YEAR = new Date().getFullYear();
    if (finalBirthyear && CURRENT_YEAR - finalBirthyear < 19) {
      return res.status(400).json({ ok: false, message: '미성년자는 회원가입이 불가합니다.' });
    }

    // ✅ 중복 검사(아이디/닉네임)
    const [userExists, nicknameExists] = await Promise.all([
      User.findOne({ username }).select('_id').lean(),
      User.findOne({ nickname }).select('_id').lean(),
    ]);
    if (userExists)     return res.status(409).json({ ok: false, message: '아이디 중복' });
    if (nicknameExists) return res.status(409).json({ ok: false, message: '닉네임 중복' });

    // ✅ CI 기반 기존 가입자 차단(실존 유저가 연결되어 있을 때만)
    if (finalCiHash) {
      const pid = await PassIdentity.findOne({ ciHash: finalCiHash }).select('userId').lean();
      if (pid?.userId) {
        const exists = await User.exists({ _id: pid.userId });
        if (exists) {
          // 이미 동일인이 가입 완료 → 가입 차단 + templogin 유도
          if (typeof PassResult?.markRoute === 'function' && passTxId) {
            await PassResult.markRoute(passTxId, 'templogin', pid.userId);
          }
          return res.status(409).json({
            ok: false,
            code: 'CI_ALREADY_REGISTERED',
            message: '이미 가입된 사용자입니다. 임시로그인 경로를 이용해 주세요.',
          });
        } else {
          console.log('[SIGNUP][INFO] PassIdentity.userId is ghost → allow rebind at upsertByCI', { ciHash: finalCiHash, ghostUserId: String(pid.userId) });
        }
      }
    }

    console.log('[SIGNUP][DBG] finalPhone/carrier', { finalPhone, finalCarrier, passTxId: !!passTxId });

    // ✅ 사용자 생성
    let user;
    try {
      const hashed = await bcrypt.hash(String(password), 10);
      user = await User.create({
        username,
        password: hashed,
        nickname,
        gender: finalGender,
        birthyear: finalBirthyear,
        region1,
        region2,
        last_login: null,

        // ✅ PASS 연동 필드(스키마 훅: phone 정규화 + phoneHash 자동 생성)
        phone: finalPhone,
        carrier: finalCarrier,
        // 번호가 있을 때만 검증 메타 부여
        phoneVerifiedAt: finalPhone ? new Date() : undefined,
        phoneVerifiedBy: finalPhone ? 'PASS' : undefined,

        // 참조용 해시(정본은 PassIdentity)
        ciHash: finalCiHash,
        diHash: finalDiHash,

        // 기본 지급(임시 정책)
        heart: 400,
        star: 0,
        ruby: 0,
      });
    } catch (e) {
      // ✅ 전화번호 유니크 충돌 분기(명확한 코드로 반환)
      if (e && e.code === 11000) {
        const keyPattern = e.keyPattern || {};
        const keyValue = e.keyValue || {};
        const dupField = Object.keys(keyValue)[0] || Object.keys(keyPattern)[0] || '';

        if (dupField === 'phone' || (e.message && e.message.includes('phone_1'))) {
          console.log('[AUTH][ERR]', { step: 'signup', code: 'E11000_DUP_PHONE', keyValue });
          return res.status(409).json({ ok: false, code: 'PHONE_IN_USE', message: '이미 다른 계정에 등록된 전화번호입니다.' });
        }

        const which = dupField === 'nickname' ? '닉네임' : (dupField === 'username' ? '아이디' : dupField || '중복');
        console.log('[AUTH][ERR]', { step: 'signup', code: 'E11000_DUP_KEY', keyValue });
        return res.status(409).json({ ok: false, message: `${which} 중복` });
      }
      if (e?.name === 'ValidationError') return res.status(400).json({ ok: false, message: '회원정보 형식이 올바르지 않습니다.' });
      if (e?.name === 'CastError')       return res.status(400).json({ ok: false, message: '입력값 변환 중 오류가 발생했습니다.' });
      console.log('[AUTH][ERR]', { step: 'signup', code: 'CREATE_USER_FAILED', message: e?.message });
      return res.status(500).json({ ok: false, message: '서버 오류' });
    }

    // ✅ PassIdentity 정본 매핑 upsert (CI 기준; 유령 userId면 내부에서 재바인딩)
    try {
      if (finalCiHash) {
        // phoneHash는 User 훅에서 생성되므로 조회하여 전달(없어도 됨)
        const fresh = await User.findById(user._id).select('phoneHash').lean();
        const phoneHash = fresh?.phoneHash || undefined;

        if (typeof PassIdentity?.upsertByCI === 'function') {
          await PassIdentity.upsertByCI({
            ciHash: finalCiHash,
            diHash: finalDiHash,
            userId: user._id,
            phoneHash,
            carrier: finalCarrier,
          });
        } else {
          // 구버전 안전망: userId가 비어있을 때만 연결
          await PassIdentity.updateOne(
            { ciHash: finalCiHash, $or: [{ userId: null }, { userId: { $exists: false } }] },
            { $set: { userId: user._id, diHash: finalDiHash, phoneHash, carrier: finalCarrier, lastVerifiedAt: new Date() } },
            { upsert: true }
          );
        }
      }
    } catch (e) {
      // 정본 매핑 실패 시 사용자 생성은 유지하되 서버 로그만 남김
      console.log('[AUTH][WARN] PassIdentity.upsertByCI failed:', e?.message);
    }

    // ✅ PassResult 1회성 소비 + 분기 기록(있을 때만)
    if (passTxId && prOverride) {
      try {
        if (typeof PassResult.markRoute === 'function') {
          await PassResult.markRoute(passTxId, 'signup', user._id);
        }
      } catch (e) {
        console.log('[AUTH][WARN] PassResult.markRoute failed:', e?.message);
      }
      try {
        if (typeof PassResult.consumeByTxId === 'function') {
          await PassResult.consumeByTxId(passTxId, user._id);
          console.log('[SIGNUP][INFO] PassResult consumed', { passTxId, userId: String(user._id) });
        } else {
          // 구버전 호환
          await PassResult.updateOne(
            { txId: passTxId, consumed: { $ne: true } },
            { $set: { consumed: true, usedAt: new Date(), usedBy: user._id } }
          );
        }
      } catch (e) {
        console.log('[AUTH][WARN] PassResult.consume mark failed:', e?.message);
      }
    }

    // ✅ 약관 동의 저장(있을 때만)
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

    console.log('[API][RES] /signup 201', { userId: String(user._id), username, passTxId: !!passTxId });
    return res.status(201).json({ ok: true, message: '회원가입 성공' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'signup', raw: err, message: err?.message, code: err?.code, name: err?.name });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 공개 유저 목록
// ======================================================
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

module.exports = router;
