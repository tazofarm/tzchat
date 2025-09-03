// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.tzchat.app',
  appName: '네네챗',
  webDir: 'dist',

  // ⚙️ 네트워킹
  // - androidScheme/iosScheme를 https로 고정: SameSite=None + Secure 쿠키 호환(웹뷰)
  // - allowNavigation: 배포 도메인 + 로컬/사설망(dev-remote) 허용
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'tzchat.duckdns.org',
      'localhost',
      '127.0.0.1',
      // 사설망 IP 대역(개발 편의를 위해 허용)
      // 아래 패턴은 Capacitor가 와일드카드 문자열을 허용하므로 넉넉히 지정
      '192.168.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
    ],
    // server.url 은 사용하지 않음(프로덕션 빌드 웹자산 사용).
    // 원격 디버깅/라이브리로드가 필요하면 아래를 임시로 열어 사용:
    // url: 'https://tzchat.duckdns.org', // 혹은 개발용 http://<PC IP>:5173
  },
};

export default config;
