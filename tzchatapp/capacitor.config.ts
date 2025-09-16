/// <reference types="node" />
import type { CapacitorConfig } from '@capacitor/cli'

const isDebug = process.env.CAP_ENV === 'debug'

const config: CapacitorConfig = {
  appId: 'org.tzchat.app',
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
}

export default config
