// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.tzchat.app',
  appName: '네네챗',
  webDir: 'dist',

  server: {
    androidScheme: 'https',                 // ✅ HTTPS 스킴 강제
    allowNavigation: ['tzchat.duckdns.org'] // ✅ 외부 도메인 허용
  },
};

export default config;
