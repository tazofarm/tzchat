package org.tzchat.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity
 *
 * ✅ 목적
 * - WebView에서 세션 쿠키(특히 크로스 사이트 쿠키)가 차단되지 않도록 설정
 * - 디버깅 편의를 위한 로그/옵션 추가
 *
 * ⚠️ 전제
 * - 서버에서 SameSite=None; Secure 로 쿠키를 내려주고,
 *   Nginx 가 X-Forwarded-Proto: https 를 전달해야 합니다.
 * - AndroidManifest.xml 은 usesCleartextTraffic="false" 상태(HTTPS 전용) 권장.
 */
public class MainActivity extends BridgeActivity {

  private static final String TAG = "TZCHAT/MainActivity";
  private static final String TEST_COOKIE_URL = "https://tzchat.duckdns.org"; // 쿠키 조회용 도메인

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    try {
      // ✅ WebView 쿠키 허용 (기본 쿠키 + 서드파티 쿠키)
      CookieManager cm = CookieManager.getInstance();
      cm.setAcceptCookie(true); // 모든 WebView 공통 쿠키 허용

      WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
      if (webView != null) {
        // ✅ 중요: 크로스 사이트 쿠키(3rd-party) 허용
        cm.setAcceptThirdPartyCookies(webView, true);
        Log.i(TAG, "🍪 Enabled cookies: acceptCookie=true, acceptThirdPartyCookies=true");
      } else {
        Log.w(TAG, "⚠️ WebView is not ready yet; third-party cookie setting deferred.");
      }

      // 🪲 개발 시 WebView 디버깅 허용 (릴리즈 빌드에서는 자동 비활성)
      if (BuildConfig.DEBUG) {
        try {
          WebView.setWebContentsDebuggingEnabled(true);
          Log.i(TAG, "🪲 WebView debugging enabled (DEBUG build).");
        } catch (Throwable t) {
          Log.w(TAG, "⚠️ Failed to enable WebView debugging: " + t.getMessage());
        }
      }

    } catch (Throwable t) {
      Log.e(TAG, "❌ onCreate initialization error", t);
    }
  }

  @Override
  protected void onResume() {
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
