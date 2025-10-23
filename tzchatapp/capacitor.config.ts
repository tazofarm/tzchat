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
      resize: 'body',               // 키보드가 나올 때 body만 리사이즈 (상단 고정 유지)
      resizeOnFullScreen: false,    // 전체화면일 때 리사이즈 비활성화
      style: 'dark',                // (선택) 다크 배경 키보드에서 자연스러운 전환
    },
  },
}

export default config
