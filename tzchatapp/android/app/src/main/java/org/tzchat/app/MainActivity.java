package org.tzchat.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.content.pm.ApplicationInfo;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity
 *
 * ✅ 목적
 * - WebView에서 세션 쿠키(특히 크로스 사이트 쿠키) 허용
 * - 디버깅 편의를 위한 로그/옵션 추가
 *
 * ⚠️ 전제
 * - 서버는 SameSite=None; Secure 로 쿠키를 내려야 함
 * - Nginx는 X-Forwarded-Proto: https 를 전달해야 함
 * - AndroidManifest.xml 은 usesCleartextTraffic="false" 권장(HTTPS만)
 */
public class MainActivity extends BridgeActivity {

  private static final String TAG = "TZCHAT/MainActivity";
  private static final String TEST_COOKIE_URL = "https://tzchat.duckdns.org"; // 쿠키 조회 도메인

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    try {
      // ✅ WebView 쿠키 허용 (기본 + 서드파티)
      CookieManager cm = CookieManager.getInstance();
      cm.setAcceptCookie(true); // 모든 WebView 공통 쿠키 허용

      WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
      if (webView != null) {
        cm.setAcceptThirdPartyCookies(webView, true); // ✅ 크로스 사이트 쿠키 허용
        Log.i(TAG, "🍪 Enabled cookies: acceptCookie=true, acceptThirdPartyCookies=true");
      } else {
        Log.w(TAG, "⚠️ WebView is not ready yet; third-party cookie setting deferred.");
      }

      // 🪲 DEBUG 빌드 여부를 안전하게 판별 (BuildConfig 의존 제거)
      boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
      if (isDebuggable) {
        try {
          WebView.setWebContentsDebuggingEnabled(true);
          Log.i(TAG, "🪲 WebView debugging enabled (DEBUGgable build).");
        } catch (Throwable t) {
          Log.w(TAG, "⚠️ Failed to enable WebView debugging: " + t.getMessage());
        }
      }

    } catch (Throwable t) {
      Log.e(TAG, "❌ onCreate initialization error", t);
    }
  }

  // ❗ BridgeActivity의 onResume은 public 이므로 동일하게 public으로 오버라이드해야 함
  @Override
  public void onResume() {
    super.onResume();
    // 🔎 현재 도메인 쿠키 상태를 확인(진단용 로그)
    try {
      CookieManager cm = CookieManager.getInstance();
      String cookie = cm.getCookie(TEST_COOKIE_URL); // null일 수 있음
      Log.i(TAG, "🔎 Current cookies for " + TEST_COOKIE_URL + ": " + (cookie != null ? cookie : "(none)"));
    } catch (Throwable t) {
      Log.w(TAG, "⚠️ Failed to read cookies: " + t.getMessage());
    }
  }
}
