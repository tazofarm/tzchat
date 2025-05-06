// routers/mainRouter.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../0500_models/User'); // User 모델을 불러옵니다.
const ChatRoom = require('../0500_models/ChatRoom'); // ChatRoom 모델을 불러옵니다.
const Message = require('../0500_models/Message'); // Message 모델 가져오기
const authMiddleware = require('../0430_middlewares/authMiddleware'); // authMiddleware 가져오

const { 
// 컨트롤러 쓸때
} = require('../0420_controllers/userController');

const router = express.Router();

//a001 모든 친구 찾기
router.get('/a001function', async (req, res) => {
    const user = req.session.user; // 현재 로그인한 사용자 정보 가져오기

    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' }); // 로그인하지 않은 경우
    }

    try {
        // 친구 리스트와 차단 리스트에서 제외할 사용자 이름 생성
        const excludedUsernames = [user.username, ...user.friendlist, ...user.blocklist];

        // MongoDB에서 사용자 목록 조회, 자기 자신과 excludedUsernames에 포함된 사용자 제외
        const users = await User.find({
            username: { $nin: excludedUsernames } // excludedUsernames에 포함되지 않은 사용자 검색
        });

        res.json(users); // 사용자 목록을 JSON 형태로 응답합니다.
    } catch (error) {
        console.error('사용자 목록을 가져오는 데 오류가 발생했습니다:', error); // 오류 상세 로그 출력
        res.status(500).json({ message: '서버 오류' }); // JSON 객체 형태로 응답
    }
});
    

//a002 지정친구 찾기 
router.post('/apigetUsersBy', async (req, res) => {
    const { searchPreference, searchRegion1, searchRegion2, searchBirthYear1, searchBirthYear2 } = req.body;
    const user = req.session.user;
  
    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    let query = {};

    // 조건 1: 선호도에 따른 필터링
    if (searchPreference === "동성") {
        query.gender = user.gender;
        query.preference = searchPreference;
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

     // 친구 리스트와 차단 리스트에서 제외할 사용자 이름
    const excludedUsernames = [user.username, ...user.friendlist, ...user.blocklist];

    // 제외할 사용자 이름을 쿼리에 추가
    if (excludedUsernames.length > 0) {
        query.username = { $nin: excludedUsernames }; // excludedUsernames에 포함되지 않은 사용자 검색
    }

    // 최종 사용자 검색
    try {
        const users = await User.find(query);
        res.status(200).json(users);
    } catch (error) {
        console.error('사용자 검색 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
}); // 새로운 필터링 함수 추가


// 1친구 추가 (차단 해제 포함)
router.post('/apiaddFriend', authMiddleware, async (req, res) => {
    const username = req.body.username;
    const user = req.session.user;

    try {
        const me = await User.findById(user._id);

        if (!me.friendlist.includes(username)) {
            // blocklist에서 제거
            me.blocklist = me.blocklist.filter(u => u !== username);
            // friendlist에 추가
            me.friendlist.push(username);
            await me.save();
            req.session.user = me;
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: '이미 친구입니다.' });
        }
    } catch (err) {
        console.error('친구 추가 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 2친구 삭제
router.post('/apiremoveFriend', authMiddleware, async (req, res) => {
    const username = req.body.username;
    const user = req.session.user;

    try {
        const me = await User.findById(user._id);
        me.friendlist = me.friendlist.filter(u => u !== username);
        await me.save();
        req.session.user = me;
        return res.json({ success: true });
    } catch (err) {
        console.error('친구 삭제 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 3사용자 차단 (친구였다면 제거 후 차단)
router.post('/apiblockUser', authMiddleware, async (req, res) => {
    const username = req.body.username;
    const user = req.session.user;

    try {
        const me = await User.findById(user._id);
        // 친구에서 제거
        me.friendlist = me.friendlist.filter(u => u !== username);
        // 차단 목록에 추가
        if (!me.blocklist.includes(username)) {
            me.blocklist.push(username);
        }
        await me.save();
        req.session.user = me;
        return res.json({ success: true });
    } catch (err) {
        console.error('차단 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 4차단 해제
router.post('/apiunblockUser', authMiddleware, async (req, res) => {
    const username = req.body.username;
    const user = req.session.user;

    try {
        const me = await User.findById(user._id);
        me.blocklist = me.blocklist.filter(u => u !== username);
        await me.save();
        req.session.user = me;
        return res.json({ success: true });
    } catch (err) {
        console.error('차단 해제 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류' });
    }
});

//5 친구 목록 조회
router.get('/apifriends', authMiddleware, async (req, res) => {
    const user = req.session.user;
    try {
        const friends = await User.find({ username: { $in: user.friendlist } });
        res.json(friends);
    } catch (err) {
        console.error('친구 목록 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 6차단 목록 조회
router.get('/apiblocked', authMiddleware, async (req, res) => {
    const user = req.session.user;
    try {
        const blockedUsers = await User.find({ username: { $in: user.blocklist } });
        res.json(blockedUsers);
    } catch (err) {
        console.error('차단 목록 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});

// 7전체 초기화
router.post('/apiclearAllLists', authMiddleware, async (req, res) => {
    const user = req.session.user;
    try {
        const me = await User.findById(user._id);
        me.friendlist = [];
        me.blocklist = [];
        await me.save();
        req.session.user = me;
        res.json({ success: true });
    } catch (err) {
        console.error('리스트 초기화 오류:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});


module.exports = router;