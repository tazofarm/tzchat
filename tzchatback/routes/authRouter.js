const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const FriendRequest = require('../models/friendRequest');
const requireLogin = require('../middlewares/authMiddleware'); // 🔐 로그인 확인 미들웨어
const router = express.Router();

/**
 * ✅ 회원가입 API (로그인 불필요)
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
 * ✅ 로그인 API (로그인 불필요)
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
 * ✅ 로그아웃 API (로그인 필요)
 */
router.post('/logout', requireLogin, (req, res) => {
  const userId = req.session.user._id;
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
/**
/**
 * ✅ 로그인한 유저의 정보 반환 (친구/차단 목록 포함, 로그인 필요)
 */
router.get('/me', requireLogin, async (req, res) => {
  const userId = req.session.user._id;

  try {
    // ✅ 친구목록과 차단목록을 nickname, username, birthyear, gender 필드만 포함해 populate
    const user = await User.findById(userId)
      .populate('friendlist', 'username nickname birthyear gender')
      .populate('blocklist', 'username nickname birthyear gender')
      .lean();

    if (!user) {
      console.warn('[me 조회 실패] 유저 없음:', userId);
      return res.status(404).json({ message: '유저 없음' });
    }

    // ⏱️ emergency 남은 시간 계산
    let remainingSeconds = 0;
    if (user.emergency?.isActive && user.emergency?.activatedAt) {
      const now = Date.now();
      const activatedAt = new Date(user.emergency.activatedAt).getTime();
      const elapsed = Math.floor((now - activatedAt) / 1000);
      remainingSeconds = Math.max(0, 3600 - elapsed);
    }

    // 💡 emergency 객체에 remainingSeconds 포함
    const modifiedUser = {
      ...user,
      emergency: {
        ...user.emergency,
        remainingSeconds,
      },
    };

    console.log('[me 반환]', user.username, `| 남은시간: ${remainingSeconds}s`);
    res.json({ user: modifiedUser });

  } catch (err) {
    console.error('[me 조회 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});


/**
 * ✅ 전체 유저 리스트 (공개 API)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('username nickname birthyear gender region1 region2 preference')
    res.json({ users })
  } catch (err) {
    console.error('❌ 전체 유저 목록 조회 실패:', err)
    res.status(500).json({ message: '유저 조회 실패' })
  }
})

/**
 * ✅ 로그인한 사용자의 친구 ID 목록 반환 (로그인 필요)
 */
router.get('/my-friends', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;

    const me = await User.findById(myId).select('friendlist');
    if (!me) {
      return res.status(404).json({ message: '사용자 없음' });
    }

    console.log('[친구 목록 조회]', myId);
    res.json({ friendIds: me.friendlist });
  } catch (err) {
    console.error('❌ 친구목록 조회 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});




// 로그인된 사용자만 접근 가능
router.put('/change-password', async (req, res) => {
  try {
    const userId = req.session?.user?._id
    if (!userId) return res.status(401).json({ message: '로그인이 필요합니다.' })

    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '비밀번호를 모두 입력해주세요.' })
    }

    // 현재 사용자 조회
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    // 현재 비밀번호 확인
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' })
    }

    // 새 비밀번호 해시 후 저장
    const hashed = await bcrypt.hash(newPassword, 10)
    user.password = hashed
    await user.save()

    console.log(`🔐 [비밀번호 변경 완료] 사용자: ${user.username}`)
    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' })
  } catch (err) {
    console.error('❌ 비밀번호 변경 오류:', err)
    res.status(500).json({ message: '서버 오류' })
  }
})





















module.exports = router;
