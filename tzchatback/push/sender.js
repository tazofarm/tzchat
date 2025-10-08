// tzchatback/push/sender.js
// -------------------------------------------------------------
// ✅ FCM 발송 헬퍼 (백엔드)
// - firebase-admin 초기화 실패 시에도 서버 다운 없이 no-op 처리
// - 대량 토큰(>500) 분할 전송, 중복 제거
// - 성공 토큰 lastSeenAt 갱신
// - 실패코드(Invalid/NotRegistered)인 토큰만 정리
// -------------------------------------------------------------
const { DeviceToken } = require('@/models'); // 경로 일관화
const { admin, isInitialized } = require('./firebase');

// FCM 멀티캐스트 제한: 한 번에 최대 500개
const MAX_TOKENS_PER_BATCH = 500;

// 삭제 대상 에러코드 화이트리스트(유효하지 않은 토큰들)
const SHOULD_DELETE_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

// 배열 분할 유틸
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 중복 제거 유틸
function uniq(arr) {
  return Array.from(new Set(arr));
}

async function sendPushToUser(userId, payload) {
  try {
    if (!isInitialized() || !admin) {
      console.warn('[push] FCM 미초기화 상태 - 발송 생략:', payload?.title);
      return;
    }

    // 유저의 모든 기기 토큰 수집
    const tokensDoc = await DeviceToken.find({ userId }).lean();
    if (!tokensDoc.length) {
      console.log('[push] 토큰 없음:', String(userId));
      return;
    }

    // 중복 제거
    const fcmTokens = uniq(tokensDoc.map(t => t.token).filter(Boolean));
    if (!fcmTokens.length) {
      console.log('[push] 유효 토큰 없음(중복/공백 제거 후):', String(userId));
      return;
    }

    // 공통 메시지 구성
    const baseMessage = {
      notification: {
        title: payload.title || '알림',
        body: payload.body || '',
      },
      data: {
        type: String(payload.type || ''),           // 'chat' | 'friend_request' ...
        roomId: String(payload.roomId || ''),
        fromUserId: String(payload.fromUserId || ''),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        notification: { channelId: 'chat_messages' },
      },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1, 'content-available': 1 },
        },
      },
      webpush: {
        fcmOptions: {
          link: payload.webLink || (payload.roomId ? `/home/chat/${payload.roomId}` : '/'),
        },
      },
    };

    let totalSuccess = 0;
    let totalFailure = 0;
    let tokensToDelete = [];

    // 500개 단위 분할 전송
    for (const batch of chunk(fcmTokens, MAX_TOKENS_PER_BATCH)) {
      const message = { ...baseMessage, tokens: batch };

      const resp = await admin.messaging().sendEachForMulticast(message);
      totalSuccess += resp.successCount || 0;
      totalFailure += resp.failureCount || 0;

      // 실패 토큰 수집(삭제 사유만)
      resp.responses.forEach((r, idx) => {
        if (!r.success && r.error && SHOULD_DELETE_CODES.has(r.error.code)) {
          tokensToDelete.push(batch[idx]);
        }
      });

      // 성공 토큰 lastSeenAt 갱신
      const successTokens = batch.filter((_, idx) => resp.responses[idx]?.success);
      if (successTokens.length) {
        await DeviceToken.updateMany(
          { token: { $in: successTokens } },
          { $set: { lastSeenAt: new Date() } }
        ).catch(() => {});
      }
    }

    console.log('[push] 발송 결과:', { success: totalSuccess, failure: totalFailure, userId: String(userId) });

    // 무효 토큰 정리(중복 제거 후 일괄 삭제)
    if (tokensToDelete.length) {
      tokensToDelete = uniq(tokensToDelete);
      console.warn('[push] 무효 토큰 정리:', tokensToDelete.length);
      await Promise.allSettled(tokensToDelete.map(t =>
        DeviceToken.deleteOne({ token: t })
      ));
    }
  } catch (err) {
    console.error('[push] 발송 오류:', err?.message || err);
  }
}

module.exports = { sendPushToUser };
