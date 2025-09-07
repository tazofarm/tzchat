// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.tzchat.app',
  appName: '네네챗',
  webDir: 'dist',

  /**
   * ✅ 핵심 수정
   * - server.url 을 설정하여 WebView가 원격 도메인에서 직접 로드되도록 합니다.
   *   => 앱의 오리진이 https://tzchat.duckdns.org 로 고정되어
   *      쿠키/세션(withCredentials), Socket.IO(wss) 모두 동일 도메인으로 정렬됩니다.
   *
   * - androidScheme/iosScheme 은 https 유지(쿠키 Secure 요건 충족).
   */
  server: {
    url: 'https://tzchat.duckdns.org', // ★ 오리진 고정
    androidScheme: 'https',
    iosScheme: 'https',

    /**
     * 참고:
     * - allowNavigation 은 server.url 사용 시 필수는 아니지만, 내부 웹뷰 내 추가 내비게이션을
     *   허용하고 싶다면 유지할 수 있습니다(아래는 최소 셋).
     * - 개발 중 로컬/사설망 접속이 필요하면 항목을 추가하세요.
     */
    allowNavigation: [
      'tzchat.duckdns.org',
    ],
  },
};

export default config;
