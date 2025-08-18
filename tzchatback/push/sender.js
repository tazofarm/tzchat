// tzchatback/push/sender.js
// -------------------------------------------------------------
// ✅ FCM 발송 헬퍼 (백엔드)
// - firebase-admin 초기화 실패 시에도 서버 다운 없이 no-op 처리
// -------------------------------------------------------------
const DeviceToken = require('../models/DeviceToken');
const { admin, isInitialized } = require('./firebase');

async function sendPushToUser(userId, payload) {
  try {
    if (!isInitialized() || !admin) {
      console.warn('[push] FCM 미초기화 상태 - 발송 생략:', payload?.title);
      return;
    }

    const tokens = await DeviceToken.find({ userId }).lean();
    if (!tokens.length) {
      console.log('[push] 토큰 없음:', userId);
      return;
    }

    const fcmTokens = tokens.map(t => t.token);
    const message = {
      tokens: fcmTokens,
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

    const resp = await admin.messaging().sendEachForMulticast(message);
    console.log('[push] 발송 결과:', {
      success: resp.successCount,
      failure: resp.failureCount,
    });

    if (resp.failureCount > 0) {
      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          console.warn('[push] 실패 토큰 제거:', fcmTokens[idx].slice(0, 12), r.error?.code);
          DeviceToken.deleteOne({ token: fcmTokens[idx] }).catch(() => {});
        }
      });
    }
  } catch (err) {
    console.error('[push] 발송 오류:', err?.message || err);
  }
}

module.exports = { sendPushToUser };
