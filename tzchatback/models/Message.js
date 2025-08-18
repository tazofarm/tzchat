// models/Message.js
// -------------------------------------------------------------
// 📨 메시지 스키마 (안읽음/읽음 표시, 텍스트/이미지 지원)
// - 기존 필드/의미 최대 유지
// - 읽음 처리 품질 향상을 위한 사전 저장 훅(pre-save)과 인덱스 보강
// - 로그/주석 충분히 추가
// -------------------------------------------------------------
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// -------------------------------------------------------------
// Schema 정의
// -------------------------------------------------------------
/**
 * @property {ObjectId} chatRoom - 소속 채팅방 ID
 * @property {ObjectId|null} sender - 보낸 사람 ID (시스템 메시지는 null 가능)
 * @property {'text'|'image'} type - 메시지 타입
 * @property {string} content - 텍스트 내용(텍스트 타입일 때 사용)
 * @property {string} imageUrl - 이미지 경로/URL(이미지 타입일 때 사용)
 * @property {ObjectId[]} readBy - 이 메시지를 읽은 사용자들의 ID 목록
 * @property {Date} createdAt - 생성 시각 (기존 유지)
 */
const messageSchema = new Schema({
  chatRoom: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },

  // 시스템 메시지는 sender가 null일 수 있음
  sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // ✅ 메시지 타입
  type: { type: String, enum: ['text', 'image'], default: 'text' },

  // 텍스트 메시지 내용
  content: { type: String, default: '' },

  // 이미지 메시지 URL(또는 경로)
  imageUrl: { type: String, default: '' },

  // ✅ 읽음 처리: 이 메시지를 읽은 사용자들(_id)
  // - 배열에 포함되지 않았으면 "안읽음"
  // - 보낸 본인은 생성 시점에 readBy에 포함시키는 것을 권장(서버 라우터/훅에서 처리)
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User', index: true, default: [] }],

  // 기존 유지: 생성일시
  createdAt: { type: Date, default: Date.now }
});

// -------------------------------------------------------------
// 인덱스 (리스트/배지 계산 성능 최적화)
// -------------------------------------------------------------
// 최근 메시지 조회(채팅방별 최신 메시지 정렬)에 유리
messageSchema.index({ chatRoom: 1, createdAt: -1 });
// 미읽음 계산시 자주 쓰이는 패턴: "특정 방 + 보낸이/시간 범위"
messageSchema.index({ chatRoom: 1, sender: 1, createdAt: -1 });

// -------------------------------------------------------------
// 헬퍼 메서드
// -------------------------------------------------------------
/**
 * 이 메시지를 특정 사용자가 읽었는지 여부
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {boolean}
 */
messageSchema.methods.isReadBy = function (userId) {
  if (!userId) return false;
  const uid = userId.toString();
  return Array.isArray(this.readBy) && this.readBy.some(x => x?.toString() === uid);
};

// -------------------------------------------------------------
// 훅: 저장 전 보낸 본인(sender)을 readBy에 자동 포함
// - 서버 라우터에서 놓치더라도 일관성 보장
// - sender가 null(시스템 메시지)일 경우는 무시
// -------------------------------------------------------------
messageSchema.pre('save', function (next) {
  try {
    // 이미지 타입이면 content는 비어 있어도 정상, 텍스트 타입인데 content가 없으면 빈 문자열로 통일
    if (this.type === 'text' && typeof this.content !== 'string') {
      this.content = '';
    }
    if (this.type === 'image' && typeof this.imageUrl !== 'string') {
      this.imageUrl = '';
    }

    // 보낸 본인은 기본적으로 "읽은 상태"로 간주
    if (this.sender) {
      const sid = this.sender.toString();
      const already = Array.isArray(this.readBy) && this.readBy.some(x => x?.toString() === sid);
      if (!already) {
        // 중복 방지하여 추가
        this.readBy = [...(this.readBy || []), this.sender];
        // 디버그 로그 (필요시 주석 해제)
        // console.log('[Message.pre.save] add sender to readBy:', sid);
      }
    }
    next();
  } catch (err) {
    console.error('[Message.pre.save] ❌ error:', err);
    next(err);
  }
});

// -------------------------------------------------------------
// JSON 변환 시 불필요 필드 정리(옵션)
// -------------------------------------------------------------
messageSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // _v 제거
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Message', messageSchema);
