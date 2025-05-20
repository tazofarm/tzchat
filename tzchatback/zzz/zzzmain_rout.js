const express = require('express');
const router = express.Router();
const User = require('../05d00_models/User'); // User 모델을 불러옵니다.
const bcrypt = require('bcrypt');

// 회원가입 페이지 렌더링
router.get('/signup', (req, res) => {
    res.render('0200_signup.ejs');
});

// 회원가입 처리
router.post('/signup', async (req, res) => {
    const { username, password, nickname, birthYear, gender, region1, region2, character } = req.body;

    try {
        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);

        // 새로운 사용자 생성
        const newUser = new User({
            username,
            password: hashedPassword, // 해싱된 비밀번호 저장
            nickname,
            birthYear,
            gender,
            region1,
            region2,
            character,
        });

        // 사용자 저장
        await newUser.save();
        res.status(201).json({ message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ message: '회원가입 중 오류가 발생했습니다.' });
    }
});



// 대시보드 페이지 렌더링
router.get('/', (req, res) => {
    res.render('0100_login.ejs');
});


// 로그인 페이지 렌더링
router.get('/login', (req, res) => {
    res.render('0100_login.ejs');
});




// 로그인 처리
router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            return res.status(404).send('사용자를 찾을 수 없습니다.');
        }
        
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(401).send('비밀번호가 일치하지 않습니다.');
        }

        // 로그인 성공 시 세션 설정
        req.session.user = user; // 사용자 정보를 세션에 저장
        return res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).send('서버 오류');
    }
});

// 로그아웃 처리
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.redirect('/login');
    });
});










// 대시보드 페이지
router.get('/dashboard', (req, res) => {
    if (req.session.user) {
        res.render('3000_dashboard.ejs', { user: req.session.user });
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});


// a001 페이지 렌더링
router.get('/a001', (req, res) => {
    if (req.session.user) {
        res.render('3010_a001.ejs', { user: req.session.user });
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});


router.get('/a002', (req, res) => {
   if (req.session.user) {
       res.render('3020_a002.ejs', { user: req.session.user });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a003', (req, res) => {
   if (req.session.user) {
       res.render('3030_a003.ejs', { user: req.session.user });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a004', (req, res) => {
   if (req.session.user) {
       res.render('3040_a004.ejs', { user: req.session.user });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a005', (req, res) => {
   if (req.session.user) {
       res.render('3050_a005.ejs', { user: req.session.user });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a006', (req, res) => {
   if (req.session.user) {
       res.render('3060_a006.ejs', { user: req.session.user });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});


// 모든 사용자 정보 조회
router.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).send('사용자 정보를 조회하는 데 실패했습니다: ' + error.message);
    }
});

// 사용자 목록을 가져오는 API
router.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;
