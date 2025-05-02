const express = require('express');
const router = express.Router();
const User = require('../models/User'); // User 모델을 불러옵니다.

// 대시보드 페이지 렌더링
router.get('/', (req, res) => {
    if (req.session.userId) {
        res.render('dashboard.ejs', { user: req.session.userId });
    } else {
        res.redirect('/auth/login');
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



// a001 페이지 렌더링
router.get('/a001', async (req, res) => {
    if (req.session.userId) {
        try {
            const users = await User.find();
            res.render('a001.ejs', { user: req.session.userId, users });
        } catch (error) {
            res.status(500).send('사용자 정보를 조회하는 데 실패했습니다: ' + error.message);
        }
    } else {
        res.redirect('/auth/login');
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


// 모든 사용자 정보 조회
router.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).send('사용자 정보를 조회하는 데 실패했습니다: ' + error.message);
    }
});




module.exports = router;
