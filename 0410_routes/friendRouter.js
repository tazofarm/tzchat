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


// 친구 추가
router.post('/apiaddFriend', async (req, res) => {
    const username = req.body.username; // username을 요청 본문에서 가져옵니다.
    const currentUser = req.session.user;

    if (!currentUser) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    try {
        // 입력된 사용자가 친구 목록에 이미 있는지 확인
        const isAlreadyFriend = await User.findOne({
            _id: currentUser._id,
            friendlist: username
        });

        if (isAlreadyFriend) {
            return res.status(400).json({ success: false, message: '이미 친구 목록에 있습니다.' });
        }
        
        // 친구 리스트에 username 추가
        await User.updateOne(
            { _id: currentUser._id },
            { $addToSet: { friendlist: username } } // friendlist에 username 추가
        );

   
        // 세션 정보 업데이트
        currentUser.friendlist.push(username); // 세션의 friendlist에 추가

        // 친구 목록 반환
        res.json({ success: true, friendlist: currentUser.friendlist });

    } catch (error) {
        console.error('친구 추가 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
});


// 친구 목록 가져오기
router.get('/apifriends', authMiddleware, async (req, res) => {
    const user = req.session.user; // 로그인한 사용자 정보 가져오기
    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    try {
        // 친구 목록에서 사용자 이름 가져오기
        const friendsUsernames = user.friendlist; // 친구 리스트의 사용자 이름

        // 친구 목록에서 사용자 정보 가져오기
        const friends = await User.find({ username: { $in: friendsUsernames } });
        res.json(friends);
    } catch (error) {
        console.error('친구 목록 가져오기 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
});


//친구리스트 삭제
router.post('/apiremoveFriend', authMiddleware, async (req, res) => {
    const username = req.body.username; // 삭제할 친구의 username
    const user = req.session.user; // 로그인한 사용자 정보

    // 사용자 로그인 확인
    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    try {
        // 친구 리스트에서 username 제거
        const result = await User.updateOne(
            { _id: user._id },
            { $pull: { friendlist: username } } 
        );

        // 결과 확인 (변경된 문서가 있는지)
        if (result.modifiedCount > 0) {
            // 성공적으로 삭제되었으므로 세션 업데이트
            user.friendlist = user.friendlist.filter(friend => friend !== username);
            res.json({ success: true });
        } else {
            // 삭제할 친구가 목록에 없을 경우
            res.json({ success: false, message: '친구 목록에 존재하지 않습니다.' });
        }
    } catch (error) {
        console.error('친구 삭제 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
});



// 친구 삭제 및 차단
router.post('/apidelandblockUser', authMiddleware, async (req, res) => {
    const username = req.body.username; // 삭제할 친구의 username
    const user = req.session.user; // 로그인한 사용자 정보

    // 사용자 로그인 확인
    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    try {
        // 친구 리스트에서 username 제거
        const removeFriendResult = await User.updateOne(
            { _id: user._id },
            { $pull: { friendlist: username } } // 친구 리스트에서 username 제거
        );

        // blocklist에 username 추가
        const blockUserResult = await User.updateOne(
            { _id: user._id },
            { $addToSet: { blocklist: username } } // blocklist에 username 추가
        );

        // 만약 친구가 성공적으로 제거되었다면, 세션에서도 업데이트
        if (removeFriendResult.modifiedCount > 0) {
            user.friendlist = user.friendlist.filter(friend => friend !== username); // 세션의 friendlist에서 제거
        }

        // 세션 정보 업데이트: 차단된 목록에 추가
        user.blocklist.push(username); // 세션의 blocklist에 추가

        // 응답: 성공적으로 요청이 처리되면 응답합니다.
        res.json({ success: true, blocklist: user.blocklist }); 
        
    } catch (error) {
        console.error('친구 삭제 및 차단 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
});

// 친구 차단
router.post('/apiblockUser', async (req, res) => {
    const username = req.body.username; // username을 요청 본문에서 가져옵니다.
    const currentUser = req.session.user;

    if (!currentUser) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    try {
        // 입력된 사용자가 차단 목록에 이미 있는지 확인
        const isAlreadyBlocked = await User.findOne({
            _id: currentUser._id,
            blocklist: username
        });

        if (isAlreadyBlocked) {
            return res.status(400).json({ success: false, message: '이미 차단 목록에 있습니다.' });
        }

        // 차단 리스트에 username 추가
        await User.updateOne(
            { _id: currentUser._id },
            { $addToSet: { blocklist: username } } // blocklist에 username 추가
        );

        
         // 세션 정보 업데이트
         currentUser.blocklist.push(username); // 세션의 friendlist에 추가

         // 친구 목록 반환
         res.json({ success: true, blocklist: currentUser.blocklist });
 
     } catch (error) {
         console.error('친구 차단 중 오류 발생:', error);
         res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
     }
});






// 차단 목록 가져오기
router.get('/apiblocked', authMiddleware, async (req, res) => {
    const user = req.session.user; // 로그인한 사용자 정보 가져오기
    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    try {
        // 차단 목록에서 사용자 이름 가져오기
        const blockedUsernames = user.blocklist; // 차단 리스트의 사용자 이름

        // 차단 목록에서 사용자 정보 가져오기
        const blockedUsers = await User.find({ username: { $in: blockedUsernames } });
        res.json(blockedUsers);
    } catch (error) {
        console.error('차단 목록 가져오기 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
});





// 차단 해제
router.post('/apiunblockUser', authMiddleware, async (req, res) => {
    const username = req.body.username; // 제거할 사용자 username
    const user = req.session.user; // 로그인한 사용자 정보

    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' }); // 로그인 체크
    }

    try {
        // 차단 리스트에서 username 제거
        const result = await User.updateOne(
            { _id: user._id },
            { $pull: { blocklist: username } } // 차단 리스트에서 사용자 제거
        );

        // 결과 확인 (변경된 문서가 있는지)
        if (result.modifiedCount > 0) {
            // 성공적으로 삭제되었으므로 세션 업데이트
            user.blocklist = user.blocklist.filter(block => block !== username);
            res.json({ success: true });
        } else {
            // 삭제할 사용자가 차단 목록에 없을 경우
            res.json({ success: false, message: '차단 목록에 존재하지 않습니다.' });
        }
    } catch (error) {
        console.error('사용자 차단 해제 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message }); // 오류 응답
    }
});




router.post('/apiclearAllLists', authMiddleware, async (req, res) => {
    const user = req.session.user;

    if (!user) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    try {
        // 친구 목록 및 차단 목록 모두 비우기
        await User.updateOne(
            { _id: user._id },
            { $set: { friendlist: [], blocklist: [] } } // friendlist와 blocklist를 빈 배열로 설정
        );

        // 세션 정보 업데이트
        req.session.user.friendlist = []; // 세션의 friendlist를 비움
        req.session.user.blocklist = []; // 세션의 blocklist를 비움

        res.json({ success: true });
    } catch (error) {
        console.error('목록 삭제 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류: ' + error.message });
    }
});



module.exports = router;