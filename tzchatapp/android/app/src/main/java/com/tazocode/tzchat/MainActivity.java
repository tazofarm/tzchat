// tzchatapp/android/app/src/main/java/com/tazocode/tzchat/MainActivity.java
package com.tazocode.tzchat;

import com.getcapacitor.BridgeActivity;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.content.pm.ApplicationInfo;

// ✅ 알림 채널/진동 관련 import
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;

public class MainActivity extends BridgeActivity {

  private static final String TAG = "MainActivity";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // ✅ 진동 전용 알림 채널 생성 (서버 sender.js의 channelId와 동일해야 함)
    createVibrateOnlyChannel(); // channelId: "chat_messages"

    // 🐛 개발 편의: WebView 디버깅 (릴리즈 빌드에서는 자동 비활성화)
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

    // 🍪 쿠키/서드파티 쿠키 허용 (세션/크로스사이트 로그인 안정화)
    try {
      CookieManager cm = CookieManager.getInstance();
      cm.setAcceptCookie(true);

      WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
      if (webView != null) {
        // Android 5.0+ 서드파티 쿠키 허용
        cm.setAcceptThirdPartyCookies(webView, true);

        // ⚙️ WebView 설정 강화
        WebSettings ws = webView.getSettings();
        if (ws != null) {
          ws.setDomStorageEnabled(true);   // localStorage/sessionStorage
          ws.setDatabaseEnabled(true);     // Web SQL/Indexed DB (단말 정책에 따라 무시될 수 있음)

          // (선택) 혼합콘텐츠 허용: 개발/원격-로컬 혼용 시 임시 허용
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
  }

  /**
   * ✅ 알림 채널 생성: chat_messages (소리 없음 + 진동 ON)
   * - 서버 FCM payload의 android.notification.channelId 와 일치해야 함
   * - 최초 한 번 생성되면 OS 설정으로 고정됨(사용자가 변경 시 그 설정이 우선)
   */
  private void createVibrateOnlyChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    final String channelId = "chat_messages"; // ⚠ 서버 sender.js와 동일해야 함
    final String name = "Chat Messages";
    final String desc = "Chat & friend request notifications (vibrate only)";
    final int importance = NotificationManager.IMPORTANCE_DEFAULT; // 표시 + 진동 허용

    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;

    // 이미 존재하면 재생성 불필요(사용자 설정 보존)
    NotificationChannel existing = nm.getNotificationChannel(channelId);
    if (existing != null) {
      // 보수적으로 진동만 보장하고 사운드는 건드리지 않음(사용자 설정 존중)
      existing.enableVibration(true);
      nm.createNotificationChannel(existing);
      return;
    }

    NotificationChannel ch = new NotificationChannel(channelId, name, importance);
    ch.setDescription(desc);

    // 🔕 소리 완전 끔
    ch.setSound(null, (AudioAttributes) null);

    // 📳 진동 켬 (간단 패턴)
    ch.enableVibration(true);
    ch.setVibrationPattern(new long[]{0, 80}); // 대기 0ms → 80ms 진동

    nm.createNotificationChannel(ch);
  }
}
