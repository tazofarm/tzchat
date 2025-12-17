package com.tazocode.tzchat;

import com.getcapacitor.BridgeActivity;

import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.content.pm.ApplicationInfo;
import android.view.WindowManager;

import android.content.Intent;
import android.net.Uri;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;

import androidx.core.view.WindowCompat;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {

  private static final String TAG = "MainActivity";

  // In-App Update
  private static final int REQ_CODE_UPDATE = 9911;
  private AppUpdateManager appUpdateManager;

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

    // ✅ In-App Update 매니저 초기화
    try {
      appUpdateManager = AppUpdateManagerFactory.create(this);
      Log.i(TAG, "[UPDATE] AppUpdateManager initialized.");
    } catch (Throwable t) {
      Log.w(TAG, "[UPDATE] Failed to init AppUpdateManager", t);
    }
  }

  @Override
  public void onResume() { // ✅ 여기만 public 이어야 합니다
    super.onResume();

    // ✅ 앱이 포그라운드로 올 때마다 업데이트 체크 + 진행중이면 재개
    try {
      checkAndStartImmediateUpdate();
    } catch (Throwable t) {
      Log.w(TAG, "[UPDATE] checkAndStartImmediateUpdate error", t);
    }
  }

  /**
   * ✅ A 방식: Immediate(강제) 업데이트
   */
  private void checkAndStartImmediateUpdate() {
    if (appUpdateManager == null) return;

    appUpdateManager.getAppUpdateInfo()
      .addOnSuccessListener((AppUpdateInfo info) -> {
        int availability = info.updateAvailability();

        boolean canImmediate =
          (availability == UpdateAvailability.UPDATE_AVAILABLE)
            && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);

        boolean inProgress =
          (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS);

        if (canImmediate || inProgress) {
          Log.i(TAG, "[UPDATE] Immediate flow start. canImmediate=" + canImmediate + ", inProgress=" + inProgress);
          try {
            appUpdateManager.startUpdateFlowForResult(
              info,
              AppUpdateType.IMMEDIATE,
              this,
              REQ_CODE_UPDATE
            );
          } catch (Throwable t) {
            Log.w(TAG, "[UPDATE] startUpdateFlowForResult failed", t);
          }
        } else {
          Log.i(TAG, "[UPDATE] No immediate update. availability=" + availability);
        }
      })
      .addOnFailureListener((e) -> {
        Log.w(TAG, "[UPDATE] getAppUpdateInfo failed", e);
      });
  }

  /**
   * 1️⃣ 업데이트 취소/실패 시 앱 강제 종료
   * 2️⃣ 업데이트 완료 후 자동 재시작 UX
   */
  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (requestCode != REQ_CODE_UPDATE) return;

    Log.i(TAG, "[UPDATE] onActivityResult resultCode=" + resultCode);

    if (resultCode == RESULT_OK) {
      // ✅ 2️⃣ 업데이트 완료 후 자동 재시작 UX
      Log.i(TAG, "[UPDATE] Update success -> restarting app UX.");
      restartAppHard();
      return;
    }

    // ✅ 1️⃣ 업데이트 취소/실패 시 앱 강제 종료
    Log.w(TAG, "[UPDATE] Update canceled/failed -> force exit app.");
    forceExitApp();
  }

  /**
   * ✅ 강제 종료 (백스택까지 완전 종료)
   */
  private void forceExitApp() {
    try {
      finishAffinity(); // 현재 task의 모든 액티비티 종료
    } catch (Throwable t) {
      try { finish(); } catch (Throwable ignore) {}
    }

    // 프로세스까지 종료(“진짜 강제”)
    try {
      android.os.Process.killProcess(android.os.Process.myPid());
    } catch (Throwable ignore) {}

    try {
      System.exit(0);
    } catch (Throwable ignore) {}
  }

  /**
   * ✅ “업데이트 완료 후 자동 재시작 UX”
   * - 런처 인텐트로 앱을 다시 시작하고, 현재 프로세스 종료
   */
  private void restartAppHard() {
    try {
      Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
      if (launch == null) {
        // 혹시 런처 인텐트가 null이면 PlayStore로라도 보내기(안전망)
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
        forceExitApp();
        return;
      }

      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK
          | Intent.FLAG_ACTIVITY_CLEAR_TASK
          | Intent.FLAG_ACTIVITY_CLEAR_TOP
      );

      // UX: 아주 짧게 텀 주고 재시작(화면 전환이 더 자연스러움)
      new Handler(Looper.getMainLooper()).postDelayed(() -> {
        try {
          startActivity(launch);
        } catch (Throwable t) {
          Log.w(TAG, "[UPDATE] restart startActivity failed", t);
        } finally {
          forceExitApp();
        }
      }, 250);

    } catch (Throwable t) {
      Log.w(TAG, "[UPDATE] restartAppHard failed", t);
      forceExitApp();
    }
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
