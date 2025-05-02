const express = require('express');
const session = require('express-session');

const User = require('../models/User'); // users.js 파일을 가져옵니다.

const router = express.Router();



// 로그인 페이지
router.get('/', (req, res) => {
   res.render('login.ejs');
  
});


// 회원가입입
router.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

// 회원가입 라우트
router.post('/signup', async (req, res) => {
    const { username, password, nickname } = req.body;

    try {
        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({ username, password: hashedPassword, nickname });
        await newUser.save();
        res.status(201).send('회원가입 성공');
    } catch (error) {
        res.status(400).send('회원가입 실패: ' + error.message);
    }
});


// 로그인 페이지
router.get('/login', (req, res) => {
   res.render('login.ejs');
  
});
const bcrypt = require('bcrypt'); // bcrypt 라이브러리 추가

// 로그인 처리
router.post('/login', async (req, res) => {
    const { userid, password } = req.body;

    try {
        const user = await User.findOne({ userid });
        if (user && await bcrypt.compare(password, user.password)) { // 비밀번호 비교
            req.session.user = userid; // 세션에 사용자 정보 저장
            return res.redirect('/dashboard'); // 대시보드로 리다이렉트
        } else {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error); // 에러 로그 출력
        return res.status(500).json({ message: 'Server error' });
    }
});


// 대시보드 페이지
router.get('/dashboard', (req, res) => {
    if (req.session.user) {
        res.render('dashboard.ejs', { user: req.session.user });
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});

// 로그아웃 처리
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.redirect('/login'); // 로그아웃 후 로그인 페이지로 리다이렉트
    });
});

// page
router.get('/a001', (req, res) => {
   if (req.session.user) {
       res.render('a001.ejs', { user: req.session.user, users });   
    } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a002', (req, res) => {
   if (req.session.user) {
       res.render('a002.ejs', { user: req.session.user,users });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a003', (req, res) => {
   if (req.session.user) {
       res.render('a003.ejs', { user: req.session.user, users });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a004', (req, res) => {
   if (req.session.user) {
       res.render('a004.ejs', { user: req.session.user, users });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a005', (req, res) => {
   if (req.session.user) {
       res.render('a005.ejs', { user: req.session.user });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});

router.get('/a006', (req, res) => {
   if (req.session.user) {
       res.render('a006.ejs', { user: req.session.user });
   } else {
       res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
   }
});



module.exports = router;



