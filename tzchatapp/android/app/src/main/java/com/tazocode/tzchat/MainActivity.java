package com.tazocode.tzchat;

import com.getcapacitor.BridgeActivity;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.content.pm.ApplicationInfo;
import android.view.WindowManager;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;

import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {

  private static final String TAG = "MainActivity";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // ✅ 키보드 모드 강제: adjustResize + stateHidden
    try {
      getWindow().setSoftInputMode(
        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
          | WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
      );
      WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
      Log.i(TAG, "[BOOT] SoftInput=ADJUST_RESIZE | STATE_HIDDEN, edge-to-edge ON");
    } catch (Throwable t) {
      Log.w(TAG, "Failed to set soft input mode or edge-to-edge", t);
    }

    // ✅ 진동 전용 알림 채널 생성
    createVibrateOnlyChannel(); // channelId: "chat_messages"

    // 🐛 개발 편의: WebView 디버깅
    try {
      boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

      if (isDebuggable) {
        WebView.setWebContentsDebuggingEnabled(true);
        Log.i(TAG, "[BOOT] WebContents debugging enabled (FLAG_DEBUGGABLE=ON)");
      } else {
        Log.i(TAG, "[BOOT] Release-like build (FLAG_DEBUGGABLE=OFF)");
      }
    } catch (Throwable t) {
      Log.w(TAG, "Failed to enable WebView debugging", t);
    }

    // 🍪 쿠키/서드파티 쿠키 허용
    try {
      CookieManager cm = CookieManager.getInstance();
      cm.setAcceptCookie(true);

      WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
      if (webView != null) {
        cm.setAcceptThirdPartyCookies(webView, true);

        WebSettings ws = webView.getSettings();
        if (ws != null) {
          ws.setDomStorageEnabled(true);
          ws.setDatabaseEnabled(true);

          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
          }
        }

        Log.i(TAG, "WebView cookie setup done. acceptCookie=TRUE, thirdParty=TRUE");
      } else {
        Log.w(TAG, "Bridge WebView is null; cannot apply cookie settings.");
      }
    } catch (Throwable t) {
      Log.e(TAG, "Error while configuring WebView/Cookies", t);
    }

    // ✅ (중요) In-App Update(Play Core) 코드는 제거했습니다.
    // 업데이트 유도는 JS 플러그인(@capawesome/capacitor-app-update)에서 처리하세요.
  }

  /**
   * ✅ 알림 채널 생성: chat_messages (소리 없음 + 진동 ON)
   */
  private void createVibrateOnlyChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    final String channelId = "chat_messages";
    final String name = "Chat Messages";
    final String desc = "Chat & friend request notifications (vibrate only)";
    final int importance = NotificationManager.IMPORTANCE_DEFAULT;

    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;

    NotificationChannel existing = nm.getNotificationChannel(channelId);
    if (existing != null) {
      existing.enableVibration(true);
      nm.createNotificationChannel(existing);
      return;
    }

    NotificationChannel ch = new NotificationChannel(channelId, name, importance);
    ch.setDescription(desc);
    ch.setSound(null, (AudioAttributes) null);
    ch.enableVibration(true);
    ch.setVibrationPattern(new long[]{0, 80});

    nm.createNotificationChannel(ch);
  }
}
