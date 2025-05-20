// controllers/userController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../0500_models/User');

// 회원가입 처리
exports.signup = async (req, res) => {
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
};

// 로그인 처리
exports.login = async (req, res) => {
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
        
        // 로그인 성공 시 세션 설정
        req.session.user = user; // 사용자 정보를 세션에 저장
        return res.redirect('/dashboard'); // 대시보드로 리다이렉트
    } catch (error) {
        console.error(error);
        return res.render('0100_login.ejs', { error: '서버 오류: ' + error.message });
    }
};

// 모든 사용자 정보 조회
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find(); // 모든 사용자 정보를 조회
        res.status(200).json(users); // JSON 형식으로 반환
    } catch (error) {
        res.status(500).send('사용자 정보를 조회하는 데 실패했습니다: ' + error.message);
    }
};


// password change
exports.changePassword = async (req, res) => {
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
};

// 친구찾기 
exports.getFilteredUsers = async (req, res) => {
    const { searchPreference, searchRegion1, searchRegion2, searchBirthYear1, searchBirthYear2 } = req.body;
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    let query = {};

    // 조건 1: 선호도에 따른 필터링
    if (searchPreference === "동성") {
        query.gender = user.gender;
    } else if (searchPreference === "이성-전체") {
        query.gender = { $ne: user.gender };
    } else if (searchPreference) {
        query.gender = { $ne: user.gender };
        query.preference = searchPreference;
    }

    // 조건 2: 지역 필터링
    if (searchRegion1 !== "전체") {
        query.region1 = searchRegion1;
    }
    if (searchRegion2 !== "전체") {
        query.region2 = searchRegion2;
    }

    // 조건 3: 출생년도 필터링
    if (searchBirthYear1 !== "전체") {
        query.birthyear = query.birthyear || {};
        query.birthyear.$gte = searchBirthYear1; // start year
    }
    if (searchBirthYear2 !== "전체") {
        query.birthyear = query.birthyear || {};
        query.birthyear.$lte = searchBirthYear2; // end year
    }

    // 최종 사용자 검색
    try {
        const users = await User.find(query);
        res.status(200).json(users);
    } catch (error) {
        console.error('사용자 검색 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
};