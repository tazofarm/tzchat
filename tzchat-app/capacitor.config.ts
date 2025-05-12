import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'tzchat-app',
  webDir: 'dist',
  server: {
    url: 'http://tzchat.duckdns.org',
    cleartext: false
  }
};

export default config;