import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.tzchat.app',
  appName: '네네챗',
  webDir: 'dist',
 
  server: {
    androidScheme: 'https',           // ⭐ WebView에서 https 스킴 사용
    allowNavigation: ['tzchat.duckdns.org'] // ⭐ 외부 도메인 허용
  }
};

export default config;
