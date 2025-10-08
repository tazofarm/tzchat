// models/Chat/Message.js
// -------------------------------------------------------------
// 📨 메시지 스키마 (안읽음/읽음 표시, 텍스트/이미지 지원)
// - TTL 만료(expiresAt) 추가 → 보관기간 자동 삭제
// - 기존 필드/의미 최대 유지
// - 읽음 처리 품질 향상을 위한 사전 저장 훅(pre-save)과 인덱스 보강
// -------------------------------------------------------------
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// ✅ 보관기간 설정값 (일 단위)
//  ※ 이 파일은 models/Chat/ 아래에 있으므로, config까지는 두 단계 상위입니다.
const retention = require('@/config/retention');

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
 * @property {Date} createdAt - 생성 시각
 * @property {Date} expiresAt - 만료 시각 (TTL 인덱스, MongoDB가 자동 삭제)
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
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User', index: true, default: [] }],

  // 기존 유지: 생성일시
  createdAt: { type: Date, default: Date.now, index: true },

  // ✅ TTL 만료 시각 (MongoDB가 expiresAt 기준으로 삭제)
  //    문서마다 다른 만기일을 줄 수 있도록 expires: 0 로 설정
  expiresAt: { type: Date, index: { expires: 0 } },
});

// -------------------------------------------------------------
// 인덱스 (리스트/배지 계산 성능 최적화)
// -------------------------------------------------------------
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ chatRoom: 1, sender: 1, createdAt: -1 });

// -------------------------------------------------------------
// 헬퍼 메서드
// -------------------------------------------------------------
messageSchema.methods.isReadBy = function (userId) {
  if (!userId) return false;
  const uid = userId.toString();
  return Array.isArray(this.readBy) && this.readBy.some(x => x?.toString() === uid);
};

// -------------------------------------------------------------
// 훅: 저장 전 기본 정규화 + 보낸 본인(sender)을 readBy에 자동 포함
// - sender가 null(시스템 메시지)일 경우는 무시
// - expiresAt(만기일) 자동 세팅: retention.MESSAGE_DAYS 사용
// -------------------------------------------------------------
messageSchema.pre('save', function (next) {
  try {
    // 타입/내용 정규화
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
        this.readBy = [...(this.readBy || []), this.sender];
      }
    }

    // ✅ TTL 만료 시간 자동 세팅 (없을 때만)
    if (!this.expiresAt) {
      const days = retention?.MESSAGE_DAYS ?? 365; // fallback 안전값
      this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
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
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Message', messageSchema);
