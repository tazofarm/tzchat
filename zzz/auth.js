const express = require('express');
const router = express.Router();
const User = require('../models/User'); // User 모델을 불러옵니다.
const bcrypt = require('bcrypt');

// 회원가입 페이지 렌더링
router.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

// 회원가입 처리
router.post('/signup', async (req, res) => {
    const { username, password, nickname } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, password: hashedPassword, nickname });
        await newUser.save();
        res.status(201).send('회원가입 성공');
    } catch (error) {
        res.status(400).send('회원가입 실패: ' + error.message);
    }
});

// 로그인 페이지 렌더링
router.get('/login', (req, res) => {
    res.render('login.ejs');
});

// 로그인 처리
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).send('사용자를 찾을 수 없습니다.');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('비밀번호가 일치하지 않습니다.');
        }

        req.session.userId = user._id;
        return res.redirect('/dashboard');
    } catch (error) {
        res.status(500).send('로그인 실패: ' + error.message);
    }
});

// 로그아웃 처리
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.redirect('/auth/login');
    });
});

module.exports = router;
