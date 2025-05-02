import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'myapp',
  webDir: 'dist',
  server: {
    url: 'http://tzchat.duckdns.org',
    cleartext: false
  }
};

export default config;