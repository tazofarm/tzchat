// routes/authRouter.js
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User'); // 사용자 모델
const router = express.Router();

/**
 * ✅ 회원가입 API
 * - 아이디 및 닉네임 중복 검사
 * - 비밀번호 해시 처리 후 저장
 */
router.post('/signup', async (req, res) => {
  const { username, password, nickname, gender, birthyear } = req.body;

  try {
    // 아이디 중복 검사
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(409).json({ message: '아이디 중복' });

    // 닉네임 중복 검사
    const nicknameExists = await User.findOne({ nickname });
    if (nicknameExists) return res.status(409).json({ message: '닉네임 중복' });

    // 비밀번호 해시 처리
    const hashed = await bcrypt.hash(password, 10);

    // 새로운 사용자 생성 및 저장
    const user = new User({ username, password: hashed, nickname, gender, birthyear });
    await user.save();

    console.log(`[회원가입] 성공: ${username}`);
    res.status(201).json({ message: '회원가입 성공' });
  } catch (err) {
    console.error('[회원가입 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 로그인 API
 * - 아이디 존재 여부 확인
 * - 비밀번호 일치 여부 확인
 * - 세션 저장 및 마지막 로그인 기록
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: '아이디 없음' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: '비밀번호 틀림' });

    // 세션에 최소 정보 저장
    req.session.user = { _id: user._id };

    // 마지막 로그인 시간 저장
    user.last_login = new Date();
    await user.save();

    console.log(`[로그인] 성공: ${username}`);
    res.json({ message: '로그인 성공', nickname: user.nickname });
  } catch (err) {
    console.error('[로그인 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 로그아웃 API
 * - 세션 제거 및 쿠키 초기화
 */
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('[로그아웃 오류]', err);
      return res.status(500).send('로그아웃 실패');
    }
    res.clearCookie('connect.sid');
    console.log('[로그아웃] 완료');
    res.send('로그아웃 완료');
  });
});

/**
 * ✅ 로그인한 유저의 전체 정보 반환 API (/api/me)
 * - 세션 정보로 사용자 식별
 * - 전체 사용자 필드 반환
 */
router.get('/me', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인 필요' });
  }

  try {
    const user = await User.findById(req.session.user._id).lean();
    if (!user) return res.status(404).json({ message: '유저 없음' });

    res.json({ user });
  } catch (err) {
    console.error('[유저 정보 조회 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 전체 가입 회원 리스트 반환 API (/api/users)
 * - 보안상 최소 정보만 반환 (username, nickname, birthyear, gender)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username nickname birthyear gender').lean();
    res.status(200).json({ users });
  } catch (err) {
    console.error('[회원 리스트 조회 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ❌ 잘못된 위치에서 await 사용했던 코드 제거 (함수 밖에서 await 사용 불가)





module.exports = router;
