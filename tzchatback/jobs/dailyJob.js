// backend/jobs/dailyJob.js
// ------------------------------------------------------------
// 매일 자정 실행 → 탈퇴 dueAt 지난 계정 하드 삭제
// ------------------------------------------------------------
const User = require('../models/User');

async function hardDeleteExpiredUsers() {
  const now = new Date();
  const expired = await User.find({
    status: 'pendingDeletion',
    deletionDueAt: { $lte: now }
  });

  for (let u of expired) {
    console.log(`[탈퇴완료] user=${u._id} nickname=${u.nickname}`);
    // 실제 삭제 → 관련 데이터 정리
    await User.deleteOne({ _id: u._id });
    // TODO: ChatRoom, FriendRequest, ProfileImage 등 참조 데이터 정리
  }
}

module.exports = { hardDeleteExpiredUsers };
