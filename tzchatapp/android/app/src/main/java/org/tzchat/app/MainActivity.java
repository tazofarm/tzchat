// tzchatapp/android/app/src/main/java/org/tzchat/app/MainActivity.java
package org.tzchat.app;

import com.getcapacitor.BridgeActivity;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.content.pm.ApplicationInfo;

/**
 * 🔧 Capacitor WebView 초기 설정
 * - 쿠키 허용 + 서드파티 쿠키 허용(세션/크로스사이트 대응)
 * - DOM Storage / DB 활성화
 * - (개발편의) WebView 디버깅
 * - (옵션) 혼합콘텐츠 허용(HTTPS 페이지에서 HTTP 리소스 접근 시)
 *
 * ✅ 변경점: BuildConfig(DEBUG) 의존 제거
 *   - namespace/package 불일치 시 컴파일 오류를 막기 위해
 *   - 런타임의 FLAG_DEBUGGABLE로 디버그 여부를 판별
 */
public class MainActivity extends BridgeActivity {

  private static final String TAG = "MainActivity";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // 🐛 개발 편의: WebView 디버깅 (릴리즈 빌드에서는 자동 비활성화)
    try {
      // BuildConfig 대신 런타임 플래그 사용
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
        // Android 5.0+ 에서만 적용되는 서드파티 쿠키 허용
        cm.setAcceptThirdPartyCookies(webView, true);

        // ⚙️ WebView 설정 강화
        WebSettings ws = webView.getSettings();
        if (ws != null) {
          ws.setDomStorageEnabled(true);   // localStorage/sessionStorage
          ws.setDatabaseEnabled(true);     // Web SQL/Indexed DB (단말 정책에 따라 무시될 수 있음)

          // (선택) 혼합콘텐츠 허용: 개발/원격-로컬 혼용 시 임시 허용
          //  - 운영에서는 가능하면 끄는 것을 권장(MIXED_CONTENT_NEVER_ALLOW)
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
}
