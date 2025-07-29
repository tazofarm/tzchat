const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const router = express.Router();

/**
 * ✅ 회원가입 API
 */
router.post('/signup', async (req, res) => {
  const { username, password, nickname, gender, birthyear } = req.body;

  try {
    console.log('[회원가입 요청]', { username, nickname });

    const userExists = await User.findOne({ username });
    if (userExists) {
      console.warn('[회원가입 실패] 아이디 중복:', username);
      return res.status(409).json({ message: '아이디 중복' });
    }

    const nicknameExists = await User.findOne({ nickname });
    if (nicknameExists) {
      console.warn('[회원가입 실패] 닉네임 중복:', nickname);
      return res.status(409).json({ message: '닉네임 중복' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed, nickname, gender, birthyear });
    await user.save();

    console.log('[회원가입 성공]', username);
    res.status(201).json({ message: '회원가입 성공' });
  } catch (err) {
    console.error('[회원가입 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 로그인 API
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log('[로그인 시도]', username);

    const user = await User.findOne({ username });
    if (!user) {
      console.warn('[로그인 실패] 아이디 없음:', username);
      return res.status(401).json({ message: '아이디 없음' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('[로그인 실패] 비밀번호 틀림:', username);
      return res.status(401).json({ message: '비밀번호 틀림' });
    }

    req.session.user = { _id: user._id };
    user.last_login = new Date();
    await user.save();

    console.log('[로그인 성공]', username);
    res.json({ message: '로그인 성공', nickname: user.nickname });
  } catch (err) {
    console.error('[로그인 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 로그아웃 API
 */
router.post('/logout', (req, res) => {
  const userId = req.session.user?._id;
  req.session.destroy(err => {
    if (err) {
      console.error('[로그아웃 오류]', err);
      return res.status(500).send('로그아웃 실패');
    }
    res.clearCookie('connect.sid');
    console.log('[로그아웃 완료]', userId);
    res.send('로그아웃 완료');
  });
});

/**
 * ✅ 로그인한 유저의 정보 반환
 */
router.get('/me', async (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    console.warn('[me 요청 거부] 로그인 필요');
    return res.status(401).json({ message: '로그인 필요' });
  }

  try {
    const user = await User.findById(sessionUser._id).lean();
    if (!user) {
      console.warn('[me 조회 실패] 유저 없음:', sessionUser._id);
      return res.status(404).json({ message: '유저 없음' });
    }

    console.log('[me 반환]', user.username);
    res.json({ user });
  } catch (err) {
    console.error('[me 조회 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 전체 유저 리스트
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username nickname birthyear gender').lean();
    console.log(`[전체 유저 조회] ${users.length}명`);
    res.status(200).json({ users });
  } catch (err) {
    console.error('[회원 리스트 조회 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
