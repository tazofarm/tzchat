// models/FriendRequest.js
// ------------------------------------------------------------
// 친구 신청 모델
// - 기존 구조 유지 + 운영 편의 개선
// - 변경 포인트:
//   1) partial unique index(from,to,status=pending) → 대기중 중복 신청만 차단
//   2) timestamps: true → createdAt/updatedAt 자동 관리
//   3) 조회 성능 보강 인덱스(to/status, from/status, status)
// - 로그/주석 풍부하게 작성
// ------------------------------------------------------------

const mongoose = require('mongoose');

// 📌 스키마 정의
const friendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // 신청자
      required: true,
      index: true, // 조회 최적화(보낸 목록)
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // 받는 사람
      required: true,
      index: true, // 조회 최적화(받은 목록)
    },
    message: {
      type: String, // 신청 메시지
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'], // (운영 정책상 block은 rejected로 처리)
      default: 'pending',
      index: true, // 상태 기반 필터잉을 자주 하므로 인덱스
    },
    // ⚠️ createdAt은 timestamps 옵션으로 자동 관리됩니다.
    // createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true } // createdAt, updatedAt 자동 생성
);

// ✅ 대기중(pending) 상태에서 같은 (from,to) 쌍의 "중복 신청" 방지
//    - 수락/거절 후에는 재신청 허용이 필요하므로 partial unique로 제한
friendRequestSchema.index(
  { from: 1, to: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
    name: 'uniq_pending_from_to',
  }
);

// 📈 자주 쓰는 조회 패턴에 대한 복합 인덱스 (선택적 성능 개선)
friendRequestSchema.index({ to: 1, status: 1 }, { name: 'idx_to_status' });
friendRequestSchema.index({ from: 1, status: 1 }, { name: 'idx_from_status' });

// 🧪 저장 전 로그 (운영 시 과도하면 주석 처리 가능)
friendRequestSchema.pre('save', function (next) {
  try {
    console.log('📝 [FriendRequest][save] from=%s → to=%s, status=%s, _id=%s',
      String(this.from), String(this.to), this.status, String(this._id));
  } catch (_) {}
  next();
});

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
