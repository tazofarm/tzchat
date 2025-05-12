// routers/mainRouter.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../0500_models/User'); // User 모델을 불러옵니다.
const ChatRoom = require('../0500_models/ChatRoom'); // ChatRoom 모델을 불러옵니다.
const authMiddleware = require('../0430_middlewares/authMiddleware'); // authMiddleware 가져오

const { 
  // 컨트롤러 쓸때
} = require('../0420_controllers/userController');

const router = express.Router();



// 회원가입 페이지 렌더링
router.get('/signup', (req, res) => {
    res.render('0200_signup.ejs');
});

// 회원가입 처리
router.post('/signupnew', async (req, res) => {
    const { username, password, nickname, birthyear, gender, region1, region2, preference } = req.body;

    try {
        // 아이디 중복 검사
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.render('0200_signup.ejs', {
                error_msg: ['이미 사용 중인 아이디입니다.'], // 오류 메시지 설정
            });
        }

        // 닉네임 중복 검사
        const existingNickname = await User.findOne({ nickname });
        if (existingNickname) {
            return res.render('0200_signup.ejs', {
                error_msg: ['이미 사용 중인 닉네임입니다.'], // 오류 메시지 설정
            });
        }

        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);

        // 새로운 사용자 생성
        const newUser = new User({
            username,
            password: hashedPassword,
            nickname,
            birthyear,
            gender,
            region1,
            region2,
            preference,
        });

        // 사용자 저장
        await newUser.save();
        res.redirect('/signupok');
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.render('0200_signup.ejs', {
            error_msg: ['회원가입 중 오류가 발생했습니다.'], // 오류 메시지 설정
        });
    }
});
// 로그인 페이지 렌더링
router.get('/', (req, res) => {
    res.render('0100_login.ejs');
});

// 로그인 페이지 렌더링
router.get('/login', (req, res) => {
    res.render('0100_login.ejs');
});

// 로그인 처리
router.post('/loginup', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render('0100_login.ejs', { error: '사용자를 찾을 수 없습니다.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('0100_login.ejs', { error: '비밀번호가 일치하지 않습니다.' });
        }

        // 로그인 성공 시 last_login 업데이트
        user.last_login = new Date(); // 현재 시간으로 last_login 업데이트
        await user.save(); // 사용자 정보 저장

        
        // 로그인 성공 시 세션 설정
        req.session.user = user; // 사용자 정보를 세션에 저장
        return res.redirect('/a001'); // 대시보드로 리다이렉트
    } catch (error) {
        console.error(error);
        return res.render('0100_login.ejs', { error: '서버 오류: ' + error.message });
    }
});


// 모든 사용자 정보 조회
router.get('/users', async (req, res) => {
    try {
        const users = await User.find(); // 모든 사용자 정보를 조회
        res.status(200).json(users); // JSON 형식으로 반환
    } catch (error) {
        res.status(500).send('사용자 정보를 조회하는 데 실패했습니다: ' + error.message);
    }
});


// 로그아웃 처리
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/login');
        }
        res.redirect('/login');
    });
});


// 회원가입 ok
router.get('/signupok', (req, res) => {
    res.render('0210_signupok.ejs');
});


// 대시보드 페이지 렌더링
router.get('/dashboard', (req, res) => {
    if (req.session.user) {
        res.render('3000_dashboard.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});


// a001
router.get('/a001', (req, res) => {
    if (req.session.user) {
        res.render('3010_a001.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});


//a002
router.get('/a002', (req, res) => {
    if (req.session.user) {
        res.render('3020_a002.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});

//a003
router.get('/a003', (req, res) => {
    if (req.session.user) {
        res.render('3030_a003.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});

//a004
router.get('/a004', (req, res) => {
    if (req.session.user) {
        res.render('3040_a004.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});

//a005 Profile
router.get('/a005', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.redirect('/login'); // 삭제된 유저 예외처리
        }

        res.render('3050_a005.ejs', { user });
    } catch (err) {
        console.error(err);
        res.status(500).send('서버 오류');
    }
});


router.get('/a005pw', (req, res) => {
    if (req.session.user) {
        res.render('3051_a005_pw.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});

// 로그인된 사용자 비밀번호 변경
router.post('/change-password', async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user._id; // 로그인된 사용자 ID

    try {
        const user = await User.findById(userId); // 사용자 정보 조회
        
        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        // 현재 비밀번호 확인
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
        }

        // 새 비밀번호와 확인 비밀번호가 일치하는지 확인
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: '변경 비밀번호와 확인 비밀번호가 일치하지 않습니다.' });
        }

        // 비밀번호 길이 확인 (20자 이하)
        if (newPassword.length > 20) {
            return res.status(400).json({ message: '변경 비밀번호는 20자 이하로 입력해야 합니다.' });
        }

        // 새 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword; // 사용자 비밀번호 업데이트
        await user.save();

        
        return res.redirect('/a005'); // 대시보드로 리다이렉트
    } catch (error) {
        console.error('비밀번호 변경 중 오류:', error);
        res.status(500).json({ message: '서버 오류' });
    }
}); // 비밀번호 변경 라우터 추가

// a005 profile

router.get('/a005profile', (req, res) => {
    if (req.session.user) {
        res.render('3052_a005_profile.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});

router.post('/update-profile', async (req, res) => {
    if (req.session.user) {
        const { region1, region2, selfintro } = req.body; // 클라이언트에서 전송받은 데이터

        try {
            // MongoDB에서 사용자 정보를 업데이트
            await User.updateOne(
                { _id: req.session.user._id },
                {
                    region1,
                    region2,
                    selfintro
                }
            );

            // 수정 후 세션 정보를 업데이트하여 반영
            req.session.user.region1 = region1;
            req.session.user.region2 = region2;
            req.session.user.selfintro = selfintro;

            res.redirect('/a005'); // 수정 후 프로필 페이지로 리다이렉트
        } catch (error) {
            console.error('프로필 업데이트 중 오류 발생:', error);
            res.status(500).send('서버 오류'); // 오류 발생 시 응답
        }
    } else {
        res.redirect('/login');
    }
});


//a006 설정

router.get('/a006', (req, res) => {
    if (req.session.user) {
        res.render('3060_a006.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});


router.get('/a006search', (req, res) => {
    if (req.session.user) {
        res.render('3061_a006_search.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});

router.post('/update-search', async (req, res) => {
    if (req.session.user) {
        const { searchbirthyear1,searchbirthyear2, searchregion1, searchregion2, searchpreference } = req.body; // 클라이언트에서 전송받은 데이터

        try {
            // MongoDB에서 사용자 정보를 업데이트
            await User.updateOne(
                { _id: req.session.user._id },
                {
                    searchbirthyear1,
                    searchbirthyear2,
                    searchregion1,
                    searchregion2,
                    searchpreference
                }
            );

            // 수정 후 세션 정보를 업데이트하여 반영

            req.session.user.searchbirthyear1 = searchbirthyear1;
            req.session.user.searchbirthyear2 = searchbirthyear2;
            req.session.user.searchregion1 = searchregion1;
            req.session.user.searchregion2 = searchregion2;
            req.session.user.searchpreference = searchpreference; //프리미엄용 

            res.redirect('/a006'); // 수정 후 프로필 페이지로 리다이렉트
        } catch (error) {
            console.error('프로필 업데이트 중 오류 발생:', error);
            res.status(500).send('서버 오류'); // 오류 발생 시 응답
        }
    } else {
        res.redirect('/login');
    }
});


//fprofile 설정

router.get('/fprofile', async (req, res) => {
    const username = req.query.username;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).send('사용자를 찾을 수 없습니다.');

        const me = await User.findById(req.session.user._id); // 로그인 사용자 정보
        res.render('4010_f_profile', { user, me });
    } catch (error) {
        console.error(error);
        res.status(500).send('서버 오류');
    }
});




//test 설정

router.get('/atest', (req, res) => {
    if (req.session.user) {
        res.render('9000_atest.ejs', { user: req.session.user }); // 사용자 정보를 템플릿에 전달
    } else {
        res.redirect('/login'); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    }
});


module.exports = router;