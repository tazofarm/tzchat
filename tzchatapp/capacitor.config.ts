// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.tzchat.app',
  appName: '네네챗',
  webDir: 'dist',

  server: {
    androidScheme: 'https',                  // ✅ HTTPS 스킴 강제 (쿠키 secure 모드 호환)
    allowNavigation: ['tzchat.duckdns.org'], // ✅ 외부 도메인 접근 허용
    cleartext: false                         // ✅ 평문 HTTP 차단 (보안 일관성 확보)
  },

  // (선택) WebView/네트워크 관련 플래그
  android: {
    allowMixedContent: false,                // HTTPS 내에서 HTTP 리소스 로드 차단
    webContentsDebuggingEnabled: true        // 디버깅 용 (릴리즈 시 false 권장)
  }
};

export default config;
