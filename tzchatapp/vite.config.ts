/// <reference types="vitest" />

import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 빌드 모드에 따라 출력 디렉토리 설정
  const outDir = mode === 'app' ? 'www' : 'dist'

  // 로그 출력 (로그 분석용)
  console.log(`📦 Vite Build Mode: ${mode}`)
  console.log(`📂 Output Directory: ${outDir}`)
  console.log(`🧩 Chunk size limit set to 1000KB`)
  console.log(`🔀 Manual chunking for vendor libs enabled`)

  return {
    plugins: [
      vue()  // Vue 플러그인만 사용
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // @ → src 경로
      },
    },
    server: {
      port: 8081, // 개발 서버 포트
    },
    build: {
      outDir,  // 모드에 따라 dist 또는 www
      chunkSizeWarningLimit: 1000, // 경고 제한 상향
      rollupOptions: {
        output: {
          manualChunks: {
            // 외부 라이브러리들을 vendor로 분리
            vendor: [
              'vue',
              'vue-router',
              '@ionic/vue',
              '@vueuse/core',
              'axios'
            ]
          }
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})
