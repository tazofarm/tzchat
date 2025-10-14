// tzchatapp/android/app/src/main/java/com/tazocode/tzchat/MyFirebaseService.java
package com.tazocode.tzchat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;

/**
 * ✅ MyFirebaseService
 * - 앱이 포그라운드(열린 상태)일 때도 FCM 수신 시 진동-only 알림을 띄움
 * - 서버(sender.js)의 channelId(chat_messages)와 동일 채널 사용
 * - data.deeplink가 있으면 딥링크로 이동, 없으면 런처(MainActivity)로 이동
 */
public class MyFirebaseService extends FirebaseMessagingService {

  @Override
  public void onMessageReceived(RemoteMessage remoteMessage) {
    final String channelId = "chat_messages"; // ✅ 서버/앱 채널과 동일해야 함

    // ---- 1) Payload 파싱 (notification 우선, 없으면 data 사용) ----
    String title = "알림";
    String body  = "";

    if (remoteMessage.getNotification() != null) {
      if (!TextUtils.isEmpty(remoteMessage.getNotification().getTitle())) {
        title = remoteMessage.getNotification().getTitle();
      }
      if (!TextUtils.isEmpty(remoteMessage.getNotification().getBody())) {
        body = remoteMessage.getNotification().getBody();
      }
    }

    if (remoteMessage.getData() != null && !remoteMessage.getData().isEmpty()) {
      // data.title / data.body가 오면 덮어씀(서버에서 함께 내려줌)
      final String dataTitle = remoteMessage.getData().get("title");
      final String dataBody  = remoteMessage.getData().get("body");
      if (!TextUtils.isEmpty(dataTitle)) title = dataTitle;
      if (!TextUtils.isEmpty(dataBody))  body  = dataBody;
    }

    // ---- 2) 딥링크 또는 런처 인텐트 준비 ----
    PendingIntent contentIntent = buildContentPendingIntent(remoteMessage);

    // ---- 3) 알림 빌드 (진동-only, 우선순위 높음) ----
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
        .setSmallIcon(getApplicationInfo().icon) // 가능하면 @drawable/ic_stat_notification 사용 권장
        .setAutoCancel(true)
        .setContentIntent(contentIntent)
        .setPriority(NotificationCompat.PRIORITY_HIGH) // 포그라운드에서도 눈에 띄게
        .setVibrate(new long[]{0, 80})                 // ✅ 진동 패턴 (채널 설정이 우선, 보조로 지정)
        .setSound(null);                                // ✅ 소리 없음(진동-only)

    // ---- 4) 노티 표시 ----
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (nm != null) {
      nm.notify((int) System.currentTimeMillis(), builder.build());
    }
  }

  /**
   * 알림 탭 시 열릴 PendingIntent 생성.
   * - data.deeplink 존재 시: ACTION_VIEW + Uri(tzchat://...) → MainActivity가 인텐트 필터로 처리
   * - 없으면: 앱 런처(MainActivity) 인텐트로 포킹
   */
  private PendingIntent buildContentPendingIntent(RemoteMessage remoteMessage) {
    Intent intent;

    String deeplink = null;
    if (remoteMessage.getData() != null) {
      deeplink = remoteMessage.getData().get("deeplink");
      // 서버에서 type/roomId만 줬고 data.deeplink가 비어 있는 경우를 대비한 보강(fallback)
      if (TextUtils.isEmpty(deeplink)) {
        final String type   = remoteMessage.getData().get("type");
        final String roomId = remoteMessage.getData().get("roomId");
        if ("chat".equals(type) && !TextUtils.isEmpty(roomId)) {
          deeplink = "tzchat://chat/" + roomId;
        } else if ("friend_request".equals(type)) {
          deeplink = "tzchat://friends/received";
        }
      }
    }

    if (!TextUtils.isEmpty(deeplink)) {
      // 딥링크로 열기 (MainActivity의 intent-filter에서 tzchat:// 스킴 처리)
      intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deeplink));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    } else {
      // 딥링크가 없으면 런처(MainActivity)로
      intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
      if (intent == null) {
        intent = new Intent(this, MainActivity.class);
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }

    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }
    return PendingIntent.getActivity(this, (int) System.currentTimeMillis(), intent, flags);
  }
}
