/// <reference types="node" />
import type { CapacitorConfig } from '@capacitor/cli'

const isDebug = process.env.CAP_ENV === 'debug'

const config: CapacitorConfig = {
  appId: 'com.tazocode.tzchat',
  appName: '네네챗',
  webDir: 'dist',

  server: isDebug
    ? {
        url: 'https://tzchat.tazocode.com',
        cleartext: false,
      }
    : {
        androidScheme: 'https',
        iosScheme: 'https',
        cleartext: false,
      },

  plugins: {
    Keyboard: {
      resize: 'native',             // ✅ 안드로이드에서 가장 안정적 (ion-content 자동 리사이즈)
      resizeOnFullScreen: true,     // ✅ 전체화면 모드에서도 정상 리사이즈
      style: 'dark',                // 다크 테마 유지
    },
  },
}

export default config
