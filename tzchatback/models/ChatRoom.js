// models/chatroom.js
// -------------------------------------------------------------
// 💬 ChatRoom 스키마
// - 기존 구조 최대 유지(participants, messages, createdAt)
// - 리스트 성능/정렬 개선을 위한 lastMessage/updatedAt/인덱스 추가
// - 주석/로그 충분히 제공
// -------------------------------------------------------------
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// -------------------------------------------------------------
// lastMessage 서브도큐먼트
// - 리스트(채팅방 목록)에서 "마지막 메시지"를 즉시 표기하기 위한 캐시
// -------------------------------------------------------------
const lastMessageSchema = new Schema(
  {
    content:   { type: String, default: '' },             // 마지막 텍스트 내용
    imageUrl:  { type: String, default: '' },             // 마지막 이미지 경로(이미지 메시지일 경우)
    sender:    { type: Schema.Types.ObjectId, ref: 'User', default: null }, // 보낸 사람
    createdAt: { type: Date }                             // 마지막 메시지 생성 시각
  },
  { _id: false } // 서브도큐먼트로만 사용
);

// -------------------------------------------------------------
// ChatRoom 메인 스키마
// -------------------------------------------------------------
const chatRoomSchema = new Schema(
  {
    // ✅ 참여자(2인 DM 기준) - 기존 유지
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],

    // ✅ 메시지 ObjectId 배열 - 기존 유지
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],

    // ✅ 생성일(기존 유지)
    createdAt: { type: Date, default: Date.now },

    // ✅ 최신 메시지 캐시(리스트 미리보기/정렬 최적화)
    lastMessage: { type: lastMessageSchema, default: () => ({}) },

    // ✅ 최신 정렬을 위한 업데이트 시각
    // - 메시지가 새로 오거나 읽힘/상태 변경 등 방에 변경이 생기면 갱신 권장
    updatedAt: { type: Date, default: Date.now }
  },
  {
    // timestamps를 쓰면 createdAt이 중복되므로, 여기서는 수동 관리
    // timestamps: true 를 사용하고 싶다면 위의 createdAt을 제거해야 함.
  }
);

// -------------------------------------------------------------
// 인덱스 최적화
// -------------------------------------------------------------
// 자주 조회되는 패턴: "내가 포함된 방" 목록
chatRoomSchema.index({ participants: 1 });
// 최신 순 정렬(리스트 정렬)
chatRoomSchema.index({ updatedAt: -1 });
// 생성 시각 정렬(히스토리성 조회가 필요할 때)
chatRoomSchema.index({ createdAt: -1 });

// -------------------------------------------------------------
// 훅: save 전에 updatedAt 자동 갱신
// - lastMessage가 변경될 때도 여기서 갱신되도록 동일한 트리거로 사용
// -------------------------------------------------------------
chatRoomSchema.pre('save', function (next) {
  try {
    this.updatedAt = new Date();
    next();
  } catch (err) {
    console.error('[ChatRoom.pre.save] ❌ error:', err);
    next(err);
  }
});

// -------------------------------------------------------------
// 메서드: 마지막 메시지 캐시 갱신 + updatedAt 터치
// - 라우터(메시지 생성 시)에서 호출하면 리스트가 즉시 최신으로 정렬됨
// -------------------------------------------------------------
/**
 * 마지막 메시지와 updatedAt을 한번에 갱신
 * @param {{content?: string, imageUrl?: string, sender?: any, createdAt?: Date}} payload
 */
chatRoomSchema.methods.setLastMessageAndTouch = function (payload = {}) {
  const {
    content = '',
    imageUrl = '',
    sender = null,
    createdAt = new Date()
  } = payload;

  // 글자 기본은 가독성 위해 '' 유지(프론트에서 검정색 스타일 처리 권장)
  this.lastMessage = { content, imageUrl, sender, createdAt };
  this.updatedAt = new Date();

  // 필요시 디버그 로그 (주석 해제)
  // console.log('[ChatRoom.setLastMessageAndTouch] ✅', {
  //   roomId: this._id?.toString(),
  //   content,
  //   imageUrl,
  //   sender: sender?.toString?.() || sender,
  //   createdAt
  // });
};

// -------------------------------------------------------------
// JSON 변환 시 불필요 필드 제거(옵션)
// -------------------------------------------------------------
chatRoomSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
